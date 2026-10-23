/**
 * A small markdown reader for the notes pane.
 *
 * The pane needs to *show* what was written and to let a checklist box be
 * ticked, and that is all: no HTML is ever produced, so nothing that is
 * typed can become markup. The parser turns the source into a block list,
 * the view renders that list as React nodes, and a checklist item keeps the
 * line it came from so ticking it can rewrite exactly that line.
 *
 * The subset is the one the pane advertises: headings, bulleted and
 * numbered lists, checklists, tables, fenced code blocks and dividers, with
 * bold, italic, inline code and links inside them.
 */

/** a run of text inside a block */
export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: InlineNode[] };

/** how a list item is marked in the source */
export type ListMarker = "bullet" | "number" | "checkbox";

/** one item of a list */
export type ListItem = {
  /** the source line the item starts on, 0-based */
  line: number;
  /** how deeply the item is nested, 0-based */
  depth: number;
  marker: ListMarker;
  /** the number the item carries, for numbered lists */
  number?: number;
  /** whether a checklist item is ticked */
  checked?: boolean;
  content: InlineNode[];
};

/** how a table column is aligned */
export type TableAlignment = "left" | "center" | "right";

/** one block of the document */
export type MarkdownBlock =
  | {
      type: "heading";
      line: number;
      level: number;
      content: InlineNode[];
    }
  | { type: "paragraph"; line: number; content: InlineNode[] }
  | {
      type: "list";
      line: number;
      ordered: boolean;
      items: ListItem[];
    }
  | {
      type: "code";
      line: number;
      language: string | null;
      code: string;
    }
  | {
      type: "table";
      line: number;
      alignments: TableAlignment[];
      header: InlineNode[][];
      rows: InlineNode[][][];
    }
  | { type: "divider"; line: number };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const DIVIDER_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)\s*$/;
const CHECK_RE = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/;
const BULLET_RE = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/** how many spaces one level of nesting is */
const INDENT_WIDTH = 2;

/** the deepest nesting the pane will draw */
const MAX_DEPTH = 4;

/**
 * Reads the inline markup of one run of text.
 *
 * Unclosed markers are left as text, which is what someone typing a `*` and
 * not yet typing the second one expects to see.
 */
export const parseInline = (text: string): InlineNode[] => {
  const nodes: InlineNode[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (index < text.length) {
    const char = text[index];

    // an escaped character is just itself
    if (char === "\\" && index + 1 < text.length) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (char === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1) {
        flush();
        nodes.push({ type: "code", text: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (char === "*" && text[index + 1] === "*") {
      const end = text.indexOf("**", index + 2);
      if (end > index + 1) {
        flush();
        nodes.push({
          type: "strong",
          children: parseInline(text.slice(index + 2, end)),
        });
        index = end + 2;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      // `_` only opens emphasis at a word boundary, so `snake_case_names`
      // is left alone
      const opensAtBoundary =
        char === "*" || index === 0 || /\s/.test(text[index - 1]);
      const end = opensAtBoundary ? text.indexOf(char, index + 1) : -1;
      if (end > index + 1 && !/\s/.test(text[index + 1])) {
        flush();
        nodes.push({
          type: "em",
          children: parseInline(text.slice(index + 1, end)),
        });
        index = end + 1;
        continue;
      }
    }

    if (char === "[") {
      const labelEnd = text.indexOf("](", index + 1);
      const hrefEnd = labelEnd === -1 ? -1 : text.indexOf(")", labelEnd + 2);
      if (labelEnd !== -1 && hrefEnd !== -1) {
        flush();
        nodes.push({
          type: "link",
          href: text.slice(labelEnd + 2, hrefEnd).trim(),
          children: parseInline(text.slice(index + 1, labelEnd)),
        });
        index = hrefEnd + 1;
        continue;
      }
    }

    buffer += char;
    index++;
  }

  flush();

  return nodes;
};

/** splits a table row into its cells, dropping the outer pipes */
const splitTableRow = (line: string): string[] => {
  let row = line.trim();

  if (row.startsWith("|")) {
    row = row.slice(1);
  }
  if (row.endsWith("|")) {
    row = row.slice(0, -1);
  }

  return row.split("|").map((cell) => cell.trim());
};

/** reads the alignment out of a table's separator row */
const readAlignments = (line: string): TableAlignment[] =>
  splitTableRow(line).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");

    if (left && right) {
      return "center";
    }
    return right ? "right" : "left";
  });

/** whether a line starts a block other than a paragraph */
const startsBlock = (line: string): boolean =>
  HEADING_RE.test(line) ||
  DIVIDER_RE.test(line) ||
  FENCE_RE.test(line) ||
  CHECK_RE.test(line) ||
  BULLET_RE.test(line) ||
  ORDERED_RE.test(line);

/** the nesting depth an indent implies */
const depthOf = (indent: string): number =>
  Math.min(Math.floor(indent.length / INDENT_WIDTH), MAX_DEPTH);

/**
 * Reads a document.
 *
 * A line that is not part of a block is a paragraph line; consecutive
 * paragraph lines are joined with a space, the way markdown folds them.
 */
export const parseMarkdown = (source: string): MarkdownBlock[] => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    // a blank line separates blocks and is never one itself
    if (!line.trim()) {
      index++;
      continue;
    }

    // fenced code: everything up to the closing fence is literal
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const fenceMarker = fence[1][0];
      const fenceLength = fence[1].length;
      const body: string[] = [];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const closing = FENCE_RE.exec(lines[cursor]);
        if (
          closing &&
          closing[1][0] === fenceMarker &&
          closing[1].length >= fenceLength
        ) {
          break;
        }
        body.push(lines[cursor]);
        cursor++;
      }

      blocks.push({
        type: "code",
        line: index,
        language: fence[2] ? fence[2] : null,
        code: body.join("\n"),
      });

      // skip the closing fence (or run off the end when it is missing)
      index = cursor < lines.length ? cursor + 1 : cursor;
      continue;
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: "divider", line: index });
      index++;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        line: index,
        level: heading[1].length,
        content: parseInline(heading[2].trim()),
      });
      index++;
      continue;
    }

    // a table is a row with pipes over a separator row
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      lines[index + 1].includes("-") &&
      TABLE_SEPARATOR_RE.test(lines[index + 1])
    ) {
      const header = splitTableRow(line).map(parseInline);
      const alignments = readAlignments(lines[index + 1]);
      const rows: InlineNode[][][] = [];
      let cursor = index + 2;

      while (
        cursor < lines.length &&
        lines[cursor].trim() &&
        lines[cursor].includes("|")
      ) {
        rows.push(splitTableRow(lines[cursor]).map(parseInline));
        cursor++;
      }

      blocks.push({
        type: "table",
        line: index,
        alignments,
        header,
        rows,
      });

      index = cursor;
      continue;
    }

    // lists: every consecutive item line belongs to the same list
    if (CHECK_RE.test(line) || BULLET_RE.test(line) || ORDERED_RE.test(line)) {
      const items: ListItem[] = [];
      let cursor = index;
      let ordered = false;

      while (cursor < lines.length) {
        const candidate = lines[cursor];

        if (!candidate.trim()) {
          break;
        }

        const check = CHECK_RE.exec(candidate);
        if (check) {
          items.push({
            line: cursor,
            depth: depthOf(check[1]),
            marker: "checkbox",
            checked: check[3].toLowerCase() === "x",
            content: parseInline(check[4].trim()),
          });
          cursor++;
          continue;
        }

        const bullet = BULLET_RE.exec(candidate);
        if (bullet) {
          items.push({
            line: cursor,
            depth: depthOf(bullet[1]),
            marker: "bullet",
            content: parseInline(bullet[3].trim()),
          });
          cursor++;
          continue;
        }

        const numbered = ORDERED_RE.exec(candidate);
        if (numbered) {
          ordered = true;
          items.push({
            line: cursor,
            depth: depthOf(numbered[1]),
            marker: "number",
            number: Number(numbered[2]),
            content: parseInline(numbered[3].trim()),
          });
          cursor++;
          continue;
        }

        break;
      }

      blocks.push({ type: "list", line: index, ordered, items });
      index = cursor;
      continue;
    }

    // a paragraph runs until a blank line or the start of another block
    const content: string[] = [line.trim()];
    let cursor = index + 1;

    while (
      cursor < lines.length &&
      lines[cursor].trim() &&
      !startsBlock(lines[cursor])
    ) {
      content.push(lines[cursor].trim());
      cursor++;
    }

    blocks.push({
      type: "paragraph",
      line: index,
      content: parseInline(content.join(" ")),
    });

    index = cursor;
  }

  return blocks;
};

/**
 * Ticks or unticks the checklist item on one line.
 *
 * The source is returned untouched when the line is not a checklist item,
 * so a stray click can never rewrite a line it did not come from.
 */
export const toggleChecklistItem = (source: string, line: number): string => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const target = lines[line];

  if (target === undefined) {
    return source;
  }

  const match = CHECK_RE.exec(target);

  if (!match) {
    return source;
  }

  const checked = match[3].toLowerCase() === "x";
  lines[line] = `${match[1]}${match[2]} [${checked ? " " : "x"}] ${match[4]}`;

  return lines.join("\n");
};

/** a list item with the items nested under it */
export type NestedListItem = ListItem & { children: NestedListItem[] };

/**
 * Turns the flat item list the parser produces into the tree the view draws.
 *
 * The source is already indented, so a deeper item belongs to the closest
 * shallower item before it; an item that jumps more than one level is
 * attached to the last item seen at its own level or above.
 */
export const nestListItems = (items: ListItem[]): NestedListItem[] => {
  const roots: NestedListItem[] = [];
  const stack: NestedListItem[] = [];

  for (const item of items) {
    const node: NestedListItem = { ...item, children: [] };

    while (stack.length && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }

    if (stack.length) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  }

  return roots;
};
