/**
 * The language the diagram pane is written in.
 *
 * One line is one thing:
 *
 *     # a comment
 *     Login Service
 *     API Gateway [icon: server] [color: blue]
 *     Backend {
 *       Auth Service
 *       Database [shape: ellipse]
 *     }
 *     Web App > API Gateway
 *     Client < Server
 *     Browser <> CDN
 *     users: id, name, email
 *
 * The parser is deliberately forgiving. A line it cannot read becomes an
 * error with its line number and is skipped; every line it can read still
 * reaches the canvas. That is what keeps a half-typed line from wiping the
 * board: the caller keeps the last good model and only shows the errors.
 */

import type {
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  DiagramParseError,
  DiagramParseResult,
  DiagramType,
} from "./types";

/** attributes a node line may carry, and the words that mean them */
const SHAPE_ALIASES: Record<string, DiagramNode["shape"]> = {
  rectangle: "rectangle",
  rect: "rectangle",
  box: "rectangle",
  square: "rectangle",
  ellipse: "ellipse",
  oval: "ellipse",
  circle: "ellipse",
  diamond: "diamond",
  rhombus: "diamond",
  decision: "diamond",
};

/** the arrow spellings, longest first so `<>` wins over `<` and `>` */
const ARROWS: readonly { token: string; both: boolean }[] = [
  { token: "<>", both: true },
  { token: ">-", both: false },
  { token: "-<", both: false },
  { token: ">", both: false },
  { token: "<", both: false },
];

/**
 * A node's identity: its label, folded down to something safe to keep in
 * `customData` and to compare across re-parses.
 *
 * Two lines with the same label are the same node — that is what lets an
 * edge written before the node's own line still refer to it, and what lets
 * a re-parse find the element it made last time.
 */
export const slugify = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** trims a label and collapses the whitespace inside it */
const cleanLabel = (label: string): string => label.trim().replace(/\s+/g, " ");

/**
 * Reads the `[key: value]` attributes out of a line.
 *
 * @returns the attributes and the line with them removed, so what is left
 * is the label
 */
const extractAttributes = (
  line: string,
): { attrs: Record<string, string>; rest: string } => {
  const attrs: Record<string, string> = {};
  let rest = "";
  let index = 0;

  while (index < line.length) {
    const open = line.indexOf("[", index);

    if (open === -1) {
      rest += line.slice(index);
      break;
    }

    const close = line.indexOf("]", open + 1);

    if (close === -1) {
      // an unclosed bracket is left in the label rather than swallowing the
      // rest of the line
      rest += line.slice(index);
      break;
    }

    rest += line.slice(index, open);

    const body = line.slice(open + 1, close);
    const separator = body.indexOf(":");

    if (separator === -1) {
      // `[server]` is a bare attribute: keep it as a flag so it is not lost,
      // but no attribute reads it
      attrs[body.trim().toLowerCase()] = "";
    } else {
      const key = body.slice(0, separator).trim().toLowerCase();
      const value = body.slice(separator + 1).trim();

      if (key) {
        attrs[key] = value;
      }
    }

    index = close + 1;
  }

  return { attrs, rest };
};

/**
 * Finds the arrow in a line, ignoring any that sit inside a label.
 *
 * A label may contain `<` or `>` — a comparison, a generic — so the scan
 * skips anything between brackets, which is where attributes live.
 *
 * @returns the arrow's position and kind, or null when the line has none
 */
const findArrow = (
  line: string,
): { index: number; length: number; both: boolean } | null => {
  let depth = 0;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === "[") {
      depth++;
      continue;
    }

    if (char === "]") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth > 0) {
      continue;
    }

    for (const arrow of ARROWS) {
      if (line.startsWith(arrow.token, index)) {
        return { index, length: arrow.token.length, both: arrow.both };
      }
    }
  }

  return null;
};

/** splits a node line's label from its ERD fields, at the first free colon */
const splitFields = (text: string): { label: string; fields: string[] } => {
  let depth = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth = Math.max(0, depth - 1);
    } else if (char === ":" && depth === 0) {
      return {
        label: text.slice(0, index),
        fields: text
          .slice(index + 1)
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean),
      };
    }
  }

  return { label: text, fields: [] };
};

/**
 * Reads a diagram written in the pane.
 *
 * @param code the text as it was typed
 * @param type the diagram type, which decides how a colon is read
 */
export const parseDiagram = (
  code: string,
  type: DiagramType,
): DiagramParseResult => {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const groups: DiagramGroup[] = [];
  const errors: DiagramParseError[] = [];

  /** the nodes seen so far, by id, so an edge can find or create one */
  const nodesById = new Map<string, DiagramNode>();
  /** the open brace blocks, innermost last */
  const groupStack: DiagramGroup[] = [];
  /** ids already used, so a repeated label does not become a second node */
  const seenEdgeIds = new Set<string>();

  const lines = code.split(/\r?\n/);

  /** makes a node, or returns the one that already carries the label */
  const upsertNode = (
    label: string,
    line: number,
    labelStart: number,
    labelEnd: number,
    implicit: boolean,
    attrs: Record<string, string> = {},
    fields: string[] = [],
  ): DiagramNode | null => {
    const cleaned = cleanLabel(label);
    const id = slugify(cleaned);

    if (!id) {
      return null;
    }

    const existing = nodesById.get(id);

    if (existing) {
      // a later, explicit line fills in what an implicit one could not know
      if (!implicit && existing.implicit) {
        existing.implicit = false;
        existing.line = line;
        existing.labelStart = labelStart;
        existing.labelEnd = labelEnd;
        existing.fields = fields;
        existing.groupId = groupStack.at(-1)?.id ?? null;
      }

      if (attrs.icon && !existing.icon) {
        existing.icon = attrs.icon;
      }
      if (attrs.color && !existing.color) {
        existing.color = attrs.color;
      }
      if (attrs.shape && !existing.shape) {
        existing.shape = SHAPE_ALIASES[attrs.shape.toLowerCase()];
      }

      return existing;
    }

    const node: DiagramNode = {
      id,
      label: cleaned,
      icon: attrs.icon || undefined,
      color: attrs.color || undefined,
      shape: attrs.shape ? SHAPE_ALIASES[attrs.shape.toLowerCase()] : undefined,
      fields,
      groupId: groupStack.at(-1)?.id ?? null,
      line,
      labelStart,
      labelEnd,
      implicit,
    };

    nodes.push(node);
    nodesById.set(id, node);

    return node;
  };

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const lineNumber = index + 1;
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // a brace block closes
    if (trimmed === "}") {
      if (!groupStack.length) {
        errors.push({
          line: lineNumber,
          message: "This closing brace has no group to close.",
        });
        continue;
      }

      groupStack.pop();
      continue;
    }

    // a brace block opens
    if (trimmed.endsWith("{")) {
      const label = cleanLabel(trimmed.slice(0, -1));
      const parent = groupStack.at(-1) ?? null;
      const id = slugify(parent ? `${parent.id}-${label}` : label);

      if (!label || !id) {
        errors.push({
          line: lineNumber,
          message: "A group needs a name before its opening brace.",
        });
        continue;
      }

      const labelStart = raw.indexOf(trimmed.slice(0, -1));

      const group: DiagramGroup = {
        id,
        label,
        parentId: parent?.id ?? null,
        depth: groupStack.length,
        line: lineNumber,
        labelStart: Math.max(0, labelStart),
        labelEnd: Math.max(0, labelStart) + label.length,
      };

      groups.push(group);
      groupStack.push(group);
      continue;
    }

    // an edge
    const arrow = findArrow(trimmed);

    if (arrow) {
      const left = trimmed.slice(0, arrow.index);
      const right = trimmed.slice(arrow.index + arrow.length);

      // a label may follow the target: `Client > Server: request`
      const { label: rightLabel, fields: trailing } = splitFields(right);
      const fromText = cleanLabel(extractAttributes(left).rest);
      const toText = cleanLabel(extractAttributes(rightLabel).rest);

      if (!fromText || !toText) {
        errors.push({
          line: lineNumber,
          message: "An edge needs a node on each side of its arrow.",
        });
        continue;
      }

      const leftOffset = raw.indexOf(left);
      const rightOffset = raw.indexOf(rightLabel, arrow.index);

      const from = upsertNode(
        fromText,
        lineNumber,
        Math.max(0, leftOffset),
        Math.max(0, leftOffset) + fromText.length,
        true,
      );
      const to = upsertNode(
        toText,
        lineNumber,
        Math.max(0, rightOffset),
        Math.max(0, rightOffset) + toText.length,
        true,
      );

      if (!from || !to) {
        errors.push({
          line: lineNumber,
          message: "An edge needs a node on each side of its arrow.",
        });
        continue;
      }

      // an edge is identified by its endpoints and direction, so writing the
      // same edge twice updates it rather than drawing it twice
      const id = arrow.both
        ? [from.id, to.id].sort().join("<->")
        : `${from.id}->${to.id}`;

      if (seenEdgeIds.has(id)) {
        continue;
      }
      seenEdgeIds.add(id);

      const label = trailing.length ? trailing.join(", ") : undefined;

      edges.push({
        id,
        from: from.id,
        to: to.id,
        both: arrow.both,
        label,
        line: lineNumber,
        fromStart: from.labelStart,
        fromEnd: from.labelEnd,
        toStart: to.labelStart,
        toEnd: to.labelEnd,
        labelStart: 0,
        labelEnd: 0,
      });
      continue;
    }

    // a node
    const { attrs, rest } = extractAttributes(trimmed);
    const { label, fields } =
      type === "erd" ? splitFields(rest) : { label: rest, fields: [] };
    const cleaned = cleanLabel(label);

    if (!cleaned) {
      errors.push({
        line: lineNumber,
        message: "This line has no name for a node.",
      });
      continue;
    }

    const labelStart = raw.indexOf(label.trim());

    upsertNode(
      cleaned,
      lineNumber,
      Math.max(0, labelStart),
      Math.max(0, labelStart) + cleaned.length,
      false,
      attrs,
      fields,
    );
  }

  if (groupStack.length) {
    errors.push({
      line: groupStack.at(-1)!.line,
      message: "This group is never closed — add a `}` on a line of its own.",
    });
  }

  return {
    model: { nodes, edges, groups },
    errors,
  };
};

/**
 * Rewrites a node's label in the code, in place.
 *
 * The canvas is the other half of the editor: renaming a node there has to
 * show up here. The node remembers where its label sits on its line, so the
 * rename is a splice rather than a re-serialisation — everything else the
 * person wrote, comments and spacing and attribute order, is left exactly
 * as it was.
 *
 * @returns the new code, or null when the node is not in the model
 */
export const renameNodeInCode = (
  code: string,
  nodeId: string,
  nextLabel: string,
  type: DiagramType,
): string | null => {
  const { model } = parseDiagram(code, type);
  const node = model.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return null;
  }

  const label = cleanLabel(nextLabel);

  if (!label || label === node.label) {
    return null;
  }

  const lines = code.split(/\r?\n/);
  const line = lines[node.line - 1];

  if (line === undefined) {
    return null;
  }

  // the offsets are relative to the raw line; re-find the label there so a
  // stale offset can never splice into the middle of a word
  const at = line.indexOf(node.label, node.labelStart);

  if (at === -1) {
    return null;
  }

  lines[node.line - 1] =
    line.slice(0, at) + label + line.slice(at + node.label.length);

  return lines.join("\n");
};
