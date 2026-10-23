import { describe, expect, it } from "vitest";

import {
  nestListItems,
  parseInline,
  parseMarkdown,
  toggleChecklistItem,
} from "../components/document/markdown";

/**
 * The markdown reader behind the notes pane.
 *
 * The pane promises a specific subset — headings, lists, checklists, tables,
 * code and dividers — and each one is asserted here on the block list it
 * produces, because that list is what the view draws. The inline reader is
 * tested separately: it is the part a stray `*` can break.
 */

/** the plain text of a run of inline nodes */
const textOf = (nodes: ReturnType<typeof parseInline>): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case "strong":
        case "em":
        case "link":
          return textOf(node.children);
        case "code":
          return node.text;
        default:
          return node.text;
      }
    })
    .join("");

describe("parseInline", () => {
  it("reads bold, italic and inline code", () => {
    const nodes = parseInline("a **b** _c_ `d`");

    expect(nodes.map((node) => node.type)).toEqual([
      "text",
      "strong",
      "text",
      "em",
      "text",
      "code",
    ]);
    expect(textOf(nodes)).toBe("a b c d");
  });

  it("reads a link and keeps its href", () => {
    const nodes = parseInline("see [the docs](https://example.com/x)");

    const link = nodes.find((node) => node.type === "link");

    expect(link).toMatchObject({
      type: "link",
      href: "https://example.com/x",
    });
    expect(textOf(nodes)).toBe("see the docs");
  });

  it("leaves an unclosed marker as text", () => {
    expect(textOf(parseInline("a **b"))).toBe("a **b");
    expect(textOf(parseInline("a `b"))).toBe("a `b");
  });

  it("leaves snake_case alone", () => {
    const nodes = parseInline("call some_function_name now");

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "text",
      text: "call some_function_name now",
    });
  });

  it("honours an escape", () => {
    expect(textOf(parseInline("a \\*not italic\\*"))).toBe("a *not italic*");
  });
});

describe("parseMarkdown", () => {
  it("reads headings by level", () => {
    const blocks = parseMarkdown("# One\n\n### Three");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ type: "heading", level: 3 });
  });

  it("folds consecutive lines into one paragraph", () => {
    const blocks = parseMarkdown("one\ntwo\n\nthree");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect(textOf((blocks[0] as any).content)).toBe("one two");
  });

  it("reads a bulleted list", () => {
    const blocks = parseMarkdown("- a\n- b\n  - nested");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "list", ordered: false });

    const items = (blocks[0] as any).items;
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ depth: 1, marker: "bullet" });
  });

  it("reads a numbered list and keeps the numbers", () => {
    const blocks = parseMarkdown("1. first\n2. second");

    expect(blocks[0]).toMatchObject({ type: "list", ordered: true });
    expect((blocks[0] as any).items.map((item: any) => item.number)).toEqual([
      1, 2,
    ]);
  });

  it("reads checklist state and the line each item came from", () => {
    const blocks = parseMarkdown("intro\n\n- [ ] todo\n- [x] done");

    const list = blocks[1] as any;

    expect(list.items[0]).toMatchObject({
      marker: "checkbox",
      checked: false,
      line: 2,
    });
    expect(list.items[1]).toMatchObject({
      marker: "checkbox",
      checked: true,
      line: 3,
    });
  });

  it("reads a table with its alignments", () => {
    const blocks = parseMarkdown(
      "| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |",
    );

    const table = blocks[0] as any;

    expect(table.type).toBe("table");
    expect(table.alignments).toEqual(["left", "center", "right"]);
    expect(table.header.map(textOf)).toEqual(["a", "b", "c"]);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].map(textOf)).toEqual(["1", "2", "3"]);
  });

  it("reads a fenced code block and its language", () => {
    const blocks = parseMarkdown("```ts\nconst a = 1;\n\nconst b = 2;\n```");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "code",
      language: "ts",
      code: "const a = 1;\n\nconst b = 2;",
    });
  });

  it("treats markdown inside a code block as literal", () => {
    const blocks = parseMarkdown("```\n# not a heading\n- not a list\n```");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "code" });
  });

  it("reads a divider", () => {
    expect(parseMarkdown("a\n\n---\n\nb").map((block) => block.type)).toEqual([
      "paragraph",
      "divider",
      "paragraph",
    ]);
  });

  it("reads an empty document as no blocks", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });

  it("does not let a list swallow the paragraph after it", () => {
    const blocks = parseMarkdown("- a\n- b\n\nafter");

    expect(blocks.map((block) => block.type)).toEqual(["list", "paragraph"]);
  });
});

describe("toggleChecklistItem", () => {
  it("ticks an unticked item and leaves every other line alone", () => {
    const source = "# Notes\n\n- [ ] one\n- [ ] two";

    expect(toggleChecklistItem(source, 2)).toBe(
      "# Notes\n\n- [x] one\n- [ ] two",
    );
  });

  it("unticks a ticked item", () => {
    expect(toggleChecklistItem("- [x] one", 0)).toBe("- [ ] one");
  });

  it("keeps the item's indentation and bullet", () => {
    expect(toggleChecklistItem("  * [ ] deep", 0)).toBe("  * [x] deep");
  });

  it("refuses a line that is not a checklist item", () => {
    const source = "- a bullet\nplain text";

    expect(toggleChecklistItem(source, 0)).toBe(source);
    expect(toggleChecklistItem(source, 1)).toBe(source);
  });

  it("refuses a line that does not exist", () => {
    expect(toggleChecklistItem("- [ ] one", 9)).toBe("- [ ] one");
  });
});

describe("nestListItems", () => {
  it("puts a deeper item under the one before it", () => {
    const items = (parseMarkdown("- a\n  - b\n- c")[0] as any).items;
    const nested = nestListItems(items);

    expect(nested).toHaveLength(2);
    expect(nested[0].children).toHaveLength(1);
    expect(nested[0].children[0].content).toBeDefined();
    expect(nested[1].children).toHaveLength(0);
  });

  it("collapses a level that jumps back up", () => {
    const items = (parseMarkdown("- a\n  - b\n    - c\n- d")[0] as any).items;
    const nested = nestListItems(items);

    expect(nested).toHaveLength(2);
    expect(nested[0].children).toHaveLength(1);
    expect(nested[0].children[0].children).toHaveLength(1);
  });
});
