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
 * Where a label sits on a raw line.
 *
 * The label is compared cleaned (whitespace collapsed), so it is not always
 * literally present in the raw line. The direct search covers the ordinary
 * case; the fallback takes the first non-space run of the label's length,
 * which is what a rename needs to splice over.
 */
const findLabelSpan = (
  raw: string,
  label: string,
  from: number,
): { start: number; end: number } => {
  const direct = raw.indexOf(label, Math.max(0, from));

  if (direct !== -1) {
    return { start: direct, end: direct + label.length };
  }

  let start = Math.max(0, from);

  while (start < raw.length && raw[start] === " ") {
    start++;
  }

  return { start, end: Math.min(raw.length, start + label.length) };
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

      // the spans are on the raw line, not the trimmed one, so a rename can
      // splice into the line the person actually typed
      const indent = Math.max(0, raw.indexOf(trimmed));
      const arrowAt = indent + arrow.index;
      const fromSpan = findLabelSpan(raw, fromText, indent);
      const toSpan = findLabelSpan(raw, toText, arrowAt + arrow.length);

      const from = upsertNode(
        fromText,
        lineNumber,
        fromSpan.start,
        fromSpan.end,
        true,
      );
      const to = upsertNode(toText, lineNumber, toSpan.start, toSpan.end, true);

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
        fromStart: fromSpan.start,
        fromEnd: fromSpan.end,
        toStart: toSpan.start,
        toEnd: toSpan.end,
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

    const node = upsertNode(
      cleaned,
      lineNumber,
      Math.max(0, labelStart),
      Math.max(0, labelStart) + cleaned.length,
      false,
      attrs,
      fields,
    );

    // a label made only of punctuation has no identity to keep in `customData`,
    // so it cannot become a node — say so rather than dropping the line, or
    // the caller would read the result as an empty diagram and clear the board
    if (!node) {
      errors.push({
        line: lineNumber,
        message: "This line has no usable name for a node.",
      });
    }
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

  /** the spans to replace, per line, so one line can hold both endpoints */
  const editsByLine = new Map<number, { start: number; end: number }[]>();

  const addEdit = (line: number, start: number, end: number) => {
    const edits = editsByLine.get(line) ?? [];
    edits.push({ start, end });
    editsByLine.set(line, edits);
  };

  // the node's own line, unless an edge declared it and there is no line of
  // its own to rewrite
  if (!node.implicit) {
    addEdit(node.line, node.labelStart, node.labelEnd);
  }

  // every edge line that names the node, so a rename does not fork it into
  // a second node the edges no longer point at
  for (const edge of model.edges) {
    if (edge.from === nodeId) {
      addEdit(edge.line, edge.fromStart, edge.fromEnd);
    }
    if (edge.to === nodeId) {
      addEdit(edge.line, edge.toStart, edge.toEnd);
    }
  }

  if (!editsByLine.size) {
    return null;
  }

  for (const [lineNumber, edits] of editsByLine) {
    const line = lines[lineNumber - 1];

    if (line === undefined) {
      continue;
    }

    // right to left, so an earlier splice cannot move a later one
    const sorted = [...edits].sort((a, b) => b.start - a.start);

    let next = line;

    for (const edit of sorted) {
      next = next.slice(0, edit.start) + label + next.slice(edit.end);
    }

    lines[lineNumber - 1] = next;
  }

  return lines.join("\n");
};
