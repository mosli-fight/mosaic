/**
 * The vocabulary the diagram examples are written in.
 *
 * A diagram example is a list of nodes and the links between them, written
 * the way a person would describe the diagram out loud — "the browser talks
 * to the gateway, the gateway talks to the API" — rather than as a pile of
 * coordinates. The helper below lays the nodes out in columns, derives the
 * arrows from the links, and hands the result to the template builder.
 *
 * Keeping the examples at this level is what makes sixty of them readable:
 * each one says what the diagram *is*, and the layout rules say where its
 * parts go.
 */

import { COLOR_PALETTE } from "@excalidraw/common";

import type { TranslationKeys } from "../i18n";

import type {
  ExcalidrawTemplate,
  TemplateCategoryId,
  TemplateElementSpec,
  TemplateShapeSpec,
  TemplateTextSpec,
} from "./types";

/** the colour families a node can be painted in */
export type Tone =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "orange"
  | "violet"
  | "pink"
  | "teal"
  | "cyan"
  | "gray"
  | "grape"
  | "bronze";

/** the paper and the ink of a tone */
export const toneColors = (tone: Tone) => ({
  background: COLOR_PALETTE[tone][0],
  stroke: COLOR_PALETTE[tone][3],
});

/** a node of a diagram */
export type DiagramNodeSpec = {
  /** the node's identity within the diagram, used by the links */
  id: string;
  label: string;
  /** an explicit position; a node without one is laid out in its column */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  kind?: "rectangle" | "ellipse" | "diamond";
  tone?: Tone;
  background?: string;
  stroke?: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  /** ERD only: the fields written under the table's name */
  fields?: readonly string[];
  roundness?: boolean;
};

/** a link between two nodes */
export type DiagramLinkSpec = {
  id?: string;
  from: string;
  to: string;
  label?: string;
  /** a dotted line, for an asynchronous or optional link */
  dashed?: boolean;
  /** an arrowhead at both ends */
  both?: boolean;
  /** no arrowhead at all, for a plain association line */
  plain?: boolean;
};

/** a heading written above the diagram, with an optional line under it */
export type DiagramHeading = {
  title: string;
  hint?: string;
};

/** the size a node takes when the example does not say */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;

/** the distance between two columns, and between two nodes of a column */
const COLUMN_GAP = 100;
const ROW_GAP = 44;

/** where the content starts, under the heading */
const FIRST_X = 40;
const CONTENT_TOP = 140;

/** the size of the heading, and of the line under it */
const TITLE_FONT_SIZE = 32;
const HINT_FONT_SIZE = 16;

/** a node's box, as the layout sees it */
type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** whether a node was given a position of its own */
const isPinned = (node: DiagramNodeSpec): boolean =>
  node.x !== undefined && node.y !== undefined;

/**
 * Where every node goes.
 *
 * The columns are laid out left to right, each as wide as its widest node.
 * Inside a column the nodes are stacked in order and the stack is centred
 * on the diagram's middle line, so a short column sits beside the middle of
 * a tall one rather than at its top.
 *
 * A node that names both of its coordinates is left exactly where it says;
 * a node that names only one is laid out in its column and then moved along
 * the axis it named.
 */
const layoutNodes = (
  nodes: readonly DiagramNodeSpec[],
  columns: readonly (readonly string[])[],
): Map<string, Box> => {
  const boxes = new Map<string, Box>();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (isPinned(node)) {
      boxes.set(node.id, {
        x: node.x!,
        y: node.y!,
        width: node.width ?? NODE_WIDTH,
        height: node.height ?? NODE_HEIGHT,
      });
    }
  }

  const columnNodes = columns.map((column) =>
    column.flatMap((id) => {
      const node = byId.get(id);
      return node ? [node] : [];
    }),
  );

  const columnWidths = columnNodes.map((column) =>
    Math.max(NODE_WIDTH, ...column.map((node) => node.width ?? NODE_WIDTH)),
  );

  const columnHeights = columnNodes.map((column) => {
    const heights = column.map((node) => node.height ?? NODE_HEIGHT);
    return (
      heights.reduce((sum, height) => sum + height, 0) +
      ROW_GAP * Math.max(0, heights.length - 1)
    );
  });

  const tallest = Math.max(0, ...columnHeights);
  const centerY = CONTENT_TOP + tallest / 2;

  let columnX = FIRST_X;

  columnNodes.forEach((column, columnIndex) => {
    const width = columnWidths[columnIndex];
    const top = centerY - columnHeights[columnIndex] / 2;

    let y = top;

    for (const node of column) {
      const height = node.height ?? NODE_HEIGHT;

      if (!boxes.has(node.id)) {
        boxes.set(node.id, {
          x: node.x ?? columnX,
          y: node.y ?? y,
          width: node.width ?? width,
          height,
        });
      }

      y += height + ROW_GAP;
    }

    columnX += width + COLUMN_GAP;
  });

  return boxes;
};

/** the label of a table card: its name, then its fields under it */
const nodeLabel = (node: DiagramNodeSpec): string =>
  node.fields?.length
    ? [node.label, "", ...node.fields].join("\n")
    : node.label;

/** the shape spec of a node */
const nodeSpec = (node: DiagramNodeSpec, box: Box): TemplateShapeSpec => ({
  kind: node.kind ?? "rectangle",
  id: node.id,
  x: box.x,
  y: box.y,
  width: box.width,
  height: box.height,
  label: nodeLabel(node),
  fontSize: node.fontSize ?? 16,
  textAlign: node.textAlign ?? (node.fields?.length ? "left" : "center"),
  verticalAlign:
    node.verticalAlign ?? (node.fields?.length ? "top" : "middle"),
  backgroundColor:
    node.background ?? (node.tone ? toneColors(node.tone).background : undefined),
  strokeColor:
    node.stroke ?? (node.tone ? toneColors(node.tone).stroke : undefined),
  textColor: node.textColor,
  roundness: node.roundness ?? node.kind !== "ellipse",
});

/** the heading of a diagram, and the line under it */
const headingSpecs = (heading: DiagramHeading): TemplateTextSpec[] => {
  const specs: TemplateTextSpec[] = [
    {
      kind: "text",
      id: "title",
      x: FIRST_X,
      y: 24,
      width: 900,
      height: 40,
      text: heading.title,
      fontSize: TITLE_FONT_SIZE,
    },
  ];

  if (heading.hint) {
    specs.push({
      kind: "text",
      id: "hint",
      x: FIRST_X,
      y: 68,
      width: 1000,
      height: 24,
      text: heading.hint,
      fontSize: HINT_FONT_SIZE,
      color: COLOR_PALETTE.gray[4],
    });
  }

  return specs;
};

/**
 * The elements of a diagram example.
 *
 * @param nodes every node, in the order they are written
 * @param columns the ids of the nodes grouped into columns, left to right.
 *   A node named in `nodes` but in no column keeps the position it was given.
 * @param links the arrows between the nodes, by node id
 * @param extra specs to put after the nodes — a lane, a legend, a note
 */
export const diagramElements = ({
  heading,
  nodes,
  columns,
  links,
  extra = [],
}: {
  heading: DiagramHeading;
  nodes: readonly DiagramNodeSpec[];
  columns: readonly (readonly string[])[];
  links: readonly DiagramLinkSpec[];
  extra?: readonly TemplateElementSpec[];
}): TemplateElementSpec[] => {
  const boxes = layoutNodes(nodes, columns);

  const shapes = nodes.flatMap((node) => {
    const box = boxes.get(node.id);

    return box ? [nodeSpec(node, box)] : [];
  });

  const connectors: TemplateElementSpec[] = links.flatMap((link, index) => {
    if (!boxes.has(link.from) || !boxes.has(link.to)) {
      return [];
    }

    return [
      {
        kind: "connector" as const,
        id: link.id ?? `link-${link.from}-${link.to}-${index + 1}`,
        from: link.from,
        to: link.to,
        label: link.label,
        strokeStyle: link.dashed ? ("dashed" as const) : ("solid" as const),
        startArrowhead: link.both,
        arrowhead: !link.plain,
        strokeColor: COLOR_PALETTE.gray[4],
        strokeWidth: 2,
      },
    ];
  });

  return [...headingSpecs(heading), ...shapes, ...connectors, ...extra];
};

/** the fields of a diagram example, before its elements are built */
export type DiagramExample = {
  id: string;
  nameKey: TranslationKeys;
  descriptionKey: TranslationKeys;
  category: TemplateCategoryId;
  heading: DiagramHeading;
  nodes: readonly DiagramNodeSpec[];
  columns: readonly (readonly string[])[];
  links: readonly DiagramLinkSpec[];
  extra?: readonly TemplateElementSpec[];
};

/** a diagram example as a template */
export const diagramTemplate = (example: DiagramExample): ExcalidrawTemplate => ({
  id: example.id,
  nameKey: example.nameKey,
  descriptionKey: example.descriptionKey,
  category: example.category,
  elements: diagramElements(example),
});

/**
 * A sequence diagram: the participants across the top, the messages that
 * pass between them underneath, in the order they happen.
 */
export type SequenceParticipant = {
  id: string;
  label: string;
  tone?: Tone;
};

export type SequenceMessage = {
  from: string;
  to: string;
  label: string;
  /** a reply is drawn without a head and with a dashed line */
  reply?: boolean;
};

/** the width of a participant's box, and the distance between two of them */
const PARTICIPANT_WIDTH = 160;
const PARTICIPANT_HEIGHT = 56;
const PARTICIPANT_GAP = 120;
const PARTICIPANT_Y = 140;

/** the first message's line, and the distance between two messages */
const MESSAGE_TOP = 250;
const MESSAGE_GAP = 70;

/** how far a lifeline runs past its last message */
const LIFELINE_TAIL = 80;

/** the elements of a sequence diagram */
export const sequenceElements = ({
  heading,
  participants,
  messages,
}: {
  heading: DiagramHeading;
  participants: readonly SequenceParticipant[];
  messages: readonly SequenceMessage[];
}): TemplateElementSpec[] => {
  const centers = new Map<string, number>();

  participants.forEach((participant, index) => {
    centers.set(
      participant.id,
      FIRST_X + index * (PARTICIPANT_WIDTH + PARTICIPANT_GAP) +
        PARTICIPANT_WIDTH / 2,
    );
  });

  const lifelineBottom =
    MESSAGE_TOP + Math.max(0, messages.length - 1) * MESSAGE_GAP +
    LIFELINE_TAIL;

  const actorSpecs = participants.flatMap((participant) => {
    const center = centers.get(participant.id)!;

    return [
      {
        kind: "rectangle" as const,
        id: `participant-${participant.id}`,
        x: center - PARTICIPANT_WIDTH / 2,
        y: PARTICIPANT_Y,
        width: PARTICIPANT_WIDTH,
        height: PARTICIPANT_HEIGHT,
        label: participant.label,
        fontSize: 16,
        backgroundColor: participant.tone
          ? toneColors(participant.tone).background
          : COLOR_PALETTE.gray[0],
        strokeColor: participant.tone
          ? toneColors(participant.tone).stroke
          : COLOR_PALETTE.gray[3],
        roundness: true,
      },
      {
        kind: "arrow" as const,
        id: `lifeline-${participant.id}`,
        x: center,
        y: PARTICIPANT_Y + PARTICIPANT_HEIGHT,
        dx: 0,
        dy: lifelineBottom - (PARTICIPANT_Y + PARTICIPANT_HEIGHT),
        strokeColor: COLOR_PALETTE.gray[3],
        strokeWidth: 1,
        strokeStyle: "dashed" as const,
        arrowhead: false,
      },
    ];
  });

  const messageSpecs = messages.flatMap((message, index) => {
    const from = centers.get(message.from);
    const to = centers.get(message.to);

    if (from === undefined || to === undefined) {
      return [];
    }

    const y = MESSAGE_TOP + index * MESSAGE_GAP;

    return [
      {
        kind: "arrow" as const,
        id: `message-${index + 1}`,
        x: from,
        y,
        dx: to - from,
        dy: 0,
        strokeColor: message.reply
          ? COLOR_PALETTE.gray[4]
          : COLOR_PALETTE.black,
        strokeWidth: 2,
        strokeStyle: message.reply
          ? ("dashed" as const)
          : ("solid" as const),
        arrowhead: !message.reply,
      },
      {
        kind: "text" as const,
        id: `message-label-${index + 1}`,
        x: Math.min(from, to),
        y: y - 24,
        width: Math.abs(to - from),
        height: 20,
        text: message.label,
        fontSize: 14,
        align: "center" as const,
        color: COLOR_PALETTE.gray[4],
      },
    ];
  });

  return [...headingSpecs(heading), ...actorSpecs, ...messageSpecs];
};

/** a sequence diagram as a template */
export const sequenceTemplate = ({
  id,
  nameKey,
  descriptionKey,
  category,
  heading,
  participants,
  messages,
}: {
  id: string;
  nameKey: TranslationKeys;
  descriptionKey: TranslationKeys;
  category: TemplateCategoryId;
  heading: DiagramHeading;
  participants: readonly SequenceParticipant[];
  messages: readonly SequenceMessage[];
}): ExcalidrawTemplate => ({
  id,
  nameKey,
  descriptionKey,
  category,
  elements: sequenceElements({ heading, participants, messages }),
});
