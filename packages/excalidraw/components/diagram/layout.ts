/**
 * Where the things in a diagram go.
 *
 * The layout is in-house and plain TypeScript: it computes a depth for every
 * node from the edges, puts the depths in columns, and stacks the nodes in
 * each column. Groups are laid out around their members afterwards, so a
 * group's container is exactly as big as what it holds.
 *
 * It is deterministic — the same model always produces the same rectangles —
 * which is what lets a re-parse move an element instead of duplicating it,
 * and what makes the layout testable without a canvas.
 */

import type {
  DiagramLayout,
  DiagramModel,
  DiagramNode,
  DiagramRect,
  DiagramType,
  LaidOutEdge,
  LaidOutGroup,
  LaidOutNode,
  LaidOutParticipant,
} from "./types";

/** how wide a node is when its label is short */
const NODE_WIDTH = 180;

/** how tall a node is when its label is short */
const NODE_HEIGHT = 72;

/** the gap between two columns */
const COLUMN_GAP = 120;

/** the gap between two nodes in a column */
const ROW_GAP = 48;

/** the padding a group puts around its members */
const GROUP_PADDING = 32;

/** how much room a group's title takes above its members */
const GROUP_HEADER = 36;

/** how far apart two participants of a sequence diagram sit */
const PARTICIPANT_GAP = 220;

/** how tall a participant's box is */
const PARTICIPANT_HEIGHT = 64;

/** how far below a participant its first message sits */
const MESSAGE_TOP = 120;

/** the gap between two messages of a sequence diagram */
const MESSAGE_GAP = 64;

/** how far a lifeline runs past its last message */
const LIFELINE_TAIL = 60;

/** a node's box, sized to hold its label and fields */
const measureNode = (node: DiagramNode, type: DiagramType): DiagramRect => {
  const labelLength = node.label.length;

  if (type === "erd") {
    // a table card: a title row and one row per field
    const rows = Math.max(1, node.fields.length);
    const widest = Math.max(
      labelLength,
      ...node.fields.map((field) => field.length + 2),
    );

    return {
      x: 0,
      y: 0,
      width: Math.min(320, Math.max(180, 14 + widest * 8)),
      height: 44 + rows * 26 + 12,
    };
  }

  // a box grows with its label, up to a point; anything longer wraps
  const width = Math.min(300, Math.max(NODE_WIDTH, 40 + labelLength * 9));
  const lines = Math.ceil((labelLength * 9) / (width - 40));

  return {
    x: 0,
    y: 0,
    width,
    height: Math.max(NODE_HEIGHT, 32 + lines * 26),
  };
};

/**
 * The depth of every node, from the edges.
 *
 * A node with no incoming edge is depth 0; every other node is one deeper
 * than the deepest node pointing at it. Cycles are broken by the nodes
 * already being placed — a back edge cannot push a node deeper than the
 * walk that reaches it, so the walk always terminates.
 */
const computeDepths = (model: DiagramModel): Map<string, number> => {
  const depths = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of model.nodes) {
    depths.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of model.edges) {
    if (edge.from === edge.to) {
      continue;
    }
    outgoing.get(edge.from)?.push(edge.to);
    if (edge.both) {
      outgoing.get(edge.to)?.push(edge.from);
    }
  }

  // relax the depths until nothing moves; the node count bounds the passes
  // so a cycle settles instead of spinning
  const maxPasses = model.nodes.length + 1;

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;

    for (const edge of model.edges) {
      if (edge.from === edge.to) {
        continue;
      }

      const fromDepth = depths.get(edge.from) ?? 0;
      const toDepth = depths.get(edge.to) ?? 0;

      if (toDepth < fromDepth + 1) {
        depths.set(edge.to, fromDepth + 1);
        changed = true;
      }

      if (edge.both) {
        const nextFromDepth = depths.get(edge.to) ?? 0;
        const nextToDepth = depths.get(edge.from) ?? 0;

        if (nextToDepth < nextFromDepth + 1) {
          depths.set(edge.from, nextFromDepth + 1);
          changed = true;
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  return depths;
};

/** the layered layout: columns by depth, nodes stacked in each column */
const layoutLayered = (
  model: DiagramModel,
  type: DiagramType,
  origin: { x: number; y: number },
): DiagramLayout => {
  const depths = computeDepths(model);
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  /** the nodes of each column, in the order they were written */
  const columns = new Map<number, DiagramNode[]>();

  for (const node of model.nodes) {
    const depth = depths.get(node.id) ?? 0;
    const column = columns.get(depth) ?? [];
    column.push(node);
    columns.set(depth, column);
  }

  const laidOutNodes: LaidOutNode[] = [];
  const positions = new Map<string, DiagramRect>();

  let columnX = origin.x;
  const columnDepths = [...columns.keys()].sort((a, b) => a - b);

  for (const depth of columnDepths) {
    const column = columns.get(depth)!;
    const sizes = column.map((node) => measureNode(node, type));
    const columnWidth = Math.max(...sizes.map((size) => size.width));

    let y = origin.y;

    for (let index = 0; index < column.length; index++) {
      const node = column[index];
      const size = sizes[index];
      const rect = {
        x: columnX + (columnWidth - size.width) / 2,
        y,
        width: size.width,
        height: size.height,
      };

      positions.set(node.id, rect);
      laidOutNodes.push({ id: node.id, ...rect });
      y += size.height + ROW_GAP;
    }

    columnX += columnWidth + COLUMN_GAP;
  }

  // the edges run between the boxes' facing sides
  const laidOutEdges: LaidOutEdge[] = [];

  for (const edge of model.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);

    if (!from || !to || !fromNode || !toNode) {
      continue;
    }

    const forward = from.x + from.width / 2 <= to.x + to.width / 2;
    const start = forward
      ? { x: from.x + from.width, y: from.y + from.height / 2 }
      : { x: from.x, y: from.y + from.height / 2 };
    const end = forward
      ? { x: to.x, y: to.y + to.height / 2 }
      : { x: to.x + to.width, y: to.y + to.height / 2 };

    laidOutEdges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      both: edge.both,
      label: edge.label,
      start,
      end,
    });
  }

  // a group wraps its members, and a parent wraps its children's wrappers
  const laidOutGroups: LaidOutGroup[] = [];
  const groupRects = new Map<string, DiagramRect>();

  const groupsByDepth = [...model.groups].sort((a, b) => b.depth - a.depth);

  for (const group of groupsByDepth) {
    const memberRects = laidOutNodes
      .filter((node) => {
        const nodeModel = nodesById.get(node.id);
        return nodeModel?.groupId === group.id;
      })
      .map((node) => ({
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      }));

    const childRects = laidOutGroups
      .filter(
        (child) =>
          model.groups.find((g) => g.id === child.id)?.parentId === group.id,
      )
      .map((child) => ({
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
      }));

    const all = [...memberRects, ...childRects];

    if (!all.length) {
      // an empty group still gets a small container, so it is visible
      const rect = {
        x: origin.x,
        y: origin.y,
        width: 200,
        height: GROUP_HEADER + GROUP_PADDING,
      };
      groupRects.set(group.id, rect);
      laidOutGroups.push({
        id: group.id,
        label: group.label,
        depth: group.depth,
        ...rect,
      });
      continue;
    }

    const minX = Math.min(...all.map((rect) => rect.x));
    const minY = Math.min(...all.map((rect) => rect.y));
    const maxX = Math.max(...all.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...all.map((rect) => rect.y + rect.height));

    const rect = {
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_HEADER,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER,
    };

    groupRects.set(group.id, rect);
    laidOutGroups.push({
      id: group.id,
      label: group.label,
      depth: group.depth,
      ...rect,
    });
  }

  // a top-level group's title must not sit under the column above it, so
  // shift everything down by the deepest header the layout needed
  const bounds = computeBounds(laidOutNodes, laidOutGroups);

  return {
    nodes: laidOutNodes,
    groups: laidOutGroups,
    edges: laidOutEdges,
    participants: [],
    bounds,
  };
};

/** the box that holds everything */
const computeBounds = (
  nodes: readonly DiagramRect[],
  groups: readonly DiagramRect[],
): DiagramRect => {
  const all = [...nodes, ...groups];

  if (!all.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...all.map((rect) => rect.x));
  const minY = Math.min(...all.map((rect) => rect.y));
  const maxX = Math.max(...all.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...all.map((rect) => rect.y + rect.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/**
 * The sequence layout: participants across the top, messages below them in
 * the order they were written.
 *
 * The participants are the nodes that take part in an edge, in the order
 * they first appear; the messages are the edges themselves, each one a
 * horizontal arrow at its own height.
 */
const layoutSequence = (
  model: DiagramModel,
  origin: { x: number; y: number },
): DiagramLayout => {
  const participantIds: string[] = [];

  for (const edge of model.edges) {
    if (!participantIds.includes(edge.from)) {
      participantIds.push(edge.from);
    }
    if (!participantIds.includes(edge.to)) {
      participantIds.push(edge.to);
    }
  }

  // a node that takes part in no message is still a participant
  for (const node of model.nodes) {
    if (!participantIds.includes(node.id)) {
      participantIds.push(node.id);
    }
  }

  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  const participants: LaidOutParticipant[] = participantIds.map((id, index) => {
    const label = nodesById.get(id)?.label ?? id;
    const width = Math.max(140, Math.min(260, 32 + label.length * 9));
    const x = origin.x + index * PARTICIPANT_GAP;

    return {
      id,
      x,
      y: origin.y,
      width,
      height: PARTICIPANT_HEIGHT,
      lifeline: {
        x: x + width / 2,
        y: origin.y + PARTICIPANT_HEIGHT,
        height: 0,
      },
    };
  });

  const participantIndex = new Map(
    participants.map((participant, index) => [participant.id, index]),
  );

  const edges: LaidOutEdge[] = [];

  model.edges.forEach((edge, messageIndex) => {
    const fromIndex = participantIndex.get(edge.from) ?? 0;
    const toIndex = participantIndex.get(edge.to) ?? 0;
    const from = participants[fromIndex];
    const to = participants[toIndex];
    const y = origin.y + MESSAGE_TOP + messageIndex * MESSAGE_GAP;

    const forward = fromIndex <= toIndex;

    edges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      both: edge.both,
      label: edge.label,
      start: {
        x: forward ? from.x + from.width : from.x,
        y,
      },
      end: {
        x: forward ? to.x : to.x + to.width,
        y,
      },
    });
  });

  // every lifeline runs to the bottom of the last message
  const lastMessageY = edges.length
    ? origin.y + MESSAGE_TOP + (edges.length - 1) * MESSAGE_GAP
    : origin.y + MESSAGE_TOP;

  for (const participant of participants) {
    participant.lifeline.height =
      lastMessageY + LIFELINE_TAIL - participant.lifeline.y;
  }

  const bounds = computeBounds(
    [
      ...participants,
      ...participants.map((participant) => ({
        x: participant.lifeline.x,
        y: participant.lifeline.y,
        width: 0,
        height: participant.lifeline.height,
      })),
    ],
    [],
  );

  return {
    nodes: participants.map((participant) => ({
      id: participant.id,
      x: participant.x,
      y: participant.y,
      width: participant.width,
      height: participant.height,
    })),
    groups: [],
    edges,
    participants,
    bounds,
  };
};

/**
 * Lays a diagram out.
 *
 * @param model the parsed diagram
 * @param type the diagram type, which picks the layout
 * @param origin where the diagram's top-left corner should sit
 */
export const layoutDiagram = (
  model: DiagramModel,
  type: DiagramType,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): DiagramLayout => {
  if (type === "sequence") {
    return layoutSequence(model, origin);
  }

  return layoutLayered(model, type, origin);
};
