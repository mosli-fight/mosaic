import { describe, expect, it } from "vitest";

import { DEFAULT_LIMITS, summarizeScene } from "../src/scene.js";

/**
 * Tests for the scene summariser.
 *
 * This is the module that decides what a model gets to see of a board, so the
 * assertions are about *bounds and content*, not formatting: that counts are
 * right, that every kind of text is found, and that no cap can be exceeded no
 * matter what the scene contains.
 */

/** Builds a scene string from elements, the way the editor stores it. */
const sceneOf = (elements: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ elements, appState: {}, files: {}, ...extra });

/** A minimal element. Only the fields the summariser reads are meaningful. */
const element = (overrides: Record<string, unknown> = {}) => ({
  id: "e1",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  isDeleted: false,
  ...overrides,
});

describe("summarizeScene", () => {
  describe("element counts", () => {
    it("counts visible elements by type", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ id: "a", type: "rectangle" }),
          element({ id: "b", type: "rectangle" }),
          element({ id: "c", type: "arrow" }),
          element({ id: "d", type: "text", text: "hi" }),
        ]),
      );

      expect(summary.counts.byType).toEqual({
        rectangle: 2,
        arrow: 1,
        text: 1,
      });
      expect(summary.counts.visible).toBe(4);
      expect(summary.counts.total).toBe(4);
      expect(summary.counts.deleted).toBe(0);
    });

    it("separates deleted elements from visible ones", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ id: "a" }),
          element({ id: "b", isDeleted: true }),
          element({ id: "c", isDeleted: true }),
        ]),
      );

      expect(summary.counts.total).toBe(3);
      expect(summary.counts.visible).toBe(1);
      expect(summary.counts.deleted).toBe(2);
      // A deleted element must not contribute to the type breakdown: the
      // question "what is on this board" is about what is drawn.
      expect(summary.counts.byType).toEqual({ rectangle: 1 });
    });

    it("treats a missing isDeleted as visible", () => {
      const { isDeleted: _isDeleted, ...withoutFlag } = element();
      const summary = summarizeScene(sceneOf([withoutFlag]));
      expect(summary.counts.visible).toBe(1);
    });

    it("counts an unknown element type rather than dropping it", () => {
      const summary = summarizeScene(
        sceneOf([element({ type: "future-widget" })]),
      );
      expect(summary.counts.byType).toEqual({ "future-widget": 1 });
    });
  });

  describe("text extraction", () => {
    it("finds text elements", () => {
      const summary = summarizeScene(
        sceneOf([element({ type: "text", text: "Hello board" })]),
      );
      expect(summary.text.items).toHaveLength(1);
      expect(summary.text.items[0]).toMatchObject({
        kind: "text",
        text: "Hello board",
        elementId: "e1",
        elementType: "text",
      });
    });

    it("falls back to originalText when text is absent", () => {
      const summary = summarizeScene(
        sceneOf([element({ type: "text", originalText: "source words" })]),
      );
      expect(summary.text.items[0].text).toBe("source words");
    });

    it("finds code blocks", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ type: "codeblock", code: "const x = 1;\nreturn x;" }),
        ]),
      );
      expect(summary.text.items[0]).toMatchObject({
        kind: "code",
        text: "const x = 1;\nreturn x;",
      });
    });

    it("finds frame names and presenter notes", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ type: "frame", name: "Intro", notes: "say hello" }),
          element({ type: "magicframe", name: "Outro" }),
        ]),
      );
      expect(summary.text.items.map((item) => [item.kind, item.text])).toEqual([
        ["frame-name", "Intro"],
        ["frame-notes", "say hello"],
        ["frame-name", "Outro"],
      ]);
    });

    it("finds sticky note authors and tags", () => {
      const summary = summarizeScene(
        sceneOf([
          element({
            type: "stickynote",
            author: "Ada",
            tags: ["risk", "todo"],
          }),
        ]),
      );
      expect(summary.text.items.map((item) => [item.kind, item.text])).toEqual([
        ["sticky-author", "Ada"],
        ["sticky-tag", "risk"],
        ["sticky-tag", "todo"],
      ]);
    });

    it("finds links on any element", () => {
      const summary = summarizeScene(
        sceneOf([element({ link: "https://example.com/spec" })]),
      );
      expect(summary.text.items[0]).toMatchObject({
        kind: "link",
        text: "https://example.com/spec",
      });
    });

    it("ignores empty and non-string values", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ type: "text", text: "", originalText: "" }),
          element({ type: "frame", name: null, notes: 42 }),
          element({ type: "stickynote", tags: ["", 7, "ok"] }),
        ]),
      );
      expect(summary.text.items.map((item) => item.text)).toEqual(["ok"]);
    });

    it("does not treat a deleted element's text as content", () => {
      const summary = summarizeScene(
        sceneOf([element({ type: "text", text: "gone", isDeleted: true })]),
      );
      expect(summary.text.items).toHaveLength(0);
    });
  });

  describe("truncation caps", () => {
    it("caps a single long text item and marks it", () => {
      const long = "x".repeat(5000);
      const summary = summarizeScene(
        sceneOf([element({ type: "text", text: long })]),
        {
          limits: { maxTextLength: 100 },
        },
      );

      expect(summary.text.items[0].text).toHaveLength(100);
      expect(summary.text.items[0].truncated).toBe(true);
      expect(summary.text.truncated).toBe(true);
    });

    it("never exceeds maxTextLength, ellipsis included", () => {
      for (const limit of [1, 2, 10, 99]) {
        const summary = summarizeScene(
          sceneOf([element({ type: "text", text: "abcdefghij".repeat(50) })]),
          { limits: { maxTextLength: limit } },
        );
        expect(summary.text.items[0].text.length).toBeLessThanOrEqual(limit);
      }
    });

    it("caps the number of text items and reports what was omitted", () => {
      const elements = Array.from({ length: 30 }, (_, i) =>
        element({ id: `t${i}`, type: "text", text: `label ${i}` }),
      );
      const summary = summarizeScene(sceneOf(elements), {
        limits: { maxTextItems: 10 },
      });

      expect(summary.text.items).toHaveLength(10);
      expect(summary.text.total).toBe(30);
      expect(summary.text.omitted).toBe(20);
      expect(summary.text.truncated).toBe(true);
    });

    it("caps total characters across many items", () => {
      const elements = Array.from({ length: 100 }, (_, i) =>
        element({ id: `t${i}`, type: "text", text: "a".repeat(100) }),
      );
      const summary = summarizeScene(sceneOf(elements), {
        limits: { maxTextLength: 100, maxTextItems: 1000, maxTextChars: 250 },
      });

      const totalChars = summary.text.items.reduce(
        (sum, item) => sum + item.text.length,
        0,
      );
      expect(totalChars).toBeLessThanOrEqual(250);
      expect(summary.text.truncated).toBe(true);
      // The cap must actually bound the reply, not merely be recorded.
      expect(summary.text.items.length).toBeLessThan(100);
    });

    it("keeps a summary of a huge scene small", () => {
      // 2000 labelled elements, each with a paragraph of text: a realistic
      // "pasted a document onto a board" shape.
      const elements = Array.from({ length: 2000 }, (_, i) =>
        element({
          id: `t${i}`,
          type: "text",
          text: `${i} `.padEnd(2000, "word "),
        }),
      );
      const summary = summarizeScene(sceneOf(elements));
      const serialized = JSON.stringify(summary);

      expect(serialized.length).toBeLessThan(30_000);
      expect(summary.counts.visible).toBe(2000);
    });

    it("does not mark a scene truncated when nothing was cut", () => {
      const summary = summarizeScene(
        sceneOf([element({ type: "text", text: "short" })]),
      );
      expect(summary.text.truncated).toBe(false);
      expect(summary.text.omitted).toBe(0);
      expect(summary.text.items[0].truncated).toBe(false);
    });
  });

  describe("bounds", () => {
    it("computes a bounding box over visible elements", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ id: "a", x: 0, y: 0, width: 100, height: 50 }),
          element({ id: "b", x: 200, y: 100, width: 50, height: 50 }),
        ]),
      );
      expect(summary.bounds).toEqual({ x: 0, y: 0, width: 250, height: 150 });
    });

    it("handles negative coordinates", () => {
      const summary = summarizeScene(
        sceneOf([element({ x: -300, y: -200, width: 100, height: 100 })]),
      );
      expect(summary.bounds).toEqual({
        x: -300,
        y: -200,
        width: 100,
        height: 100,
      });
    });

    it("is null when nothing is visible", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ isDeleted: true }),
          element({ id: "b", x: Number.NaN }),
        ]),
      );
      expect(summary.bounds).toBeNull();
    });

    it("ignores an element with a non-finite coordinate", () => {
      const summary = summarizeScene(
        sceneOf([
          element({ id: "good", x: 10, y: 10, width: 10, height: 10 }),
          element({
            id: "bad",
            x: Number.POSITIVE_INFINITY,
            width: 10,
            height: 10,
          }),
        ]),
      );
      expect(summary.bounds).toEqual({ x: 10, y: 10, width: 10, height: 10 });
    });
  });

  describe("element list", () => {
    it("is absent unless requested", () => {
      const summary = summarizeScene(sceneOf([element()]));
      expect(summary.elements).toBeUndefined();
    });

    it("is capped when requested", () => {
      const elements = Array.from({ length: 100 }, (_, i) =>
        element({ id: `e${i}` }),
      );
      const summary = summarizeScene(sceneOf(elements), {
        includeElements: true,
        limits: { maxElements: 5 },
      });

      expect(summary.elements?.items).toHaveLength(5);
      expect(summary.elements?.total).toBe(100);
      expect(summary.elements?.omitted).toBe(95);
    });

    it("carries the primary text, capped", () => {
      const summary = summarizeScene(
        sceneOf([element({ type: "text", text: "y".repeat(1000) })]),
        { includeElements: true, limits: { maxTextLength: 20 } },
      );
      expect(summary.elements?.items[0].text).toHaveLength(20);
      expect(summary.elements?.items[0].textTruncated).toBe(true);
    });

    it("omits deleted elements", () => {
      const summary = summarizeScene(
        sceneOf([element({ id: "a" }), element({ id: "b", isDeleted: true })]),
        { includeElements: true },
      );
      expect(summary.elements?.items.map((item) => item.id)).toEqual(["a"]);
    });
  });

  describe("degenerate scenes", () => {
    it("reports an empty scene", () => {
      const summary = summarizeScene(null);
      expect(summary.isEmpty).toBe(true);
      expect(summary.parseError).toBeNull();
      expect(summary.counts.total).toBe(0);
    });

    it("reports invalid JSON rather than throwing", () => {
      const summary = summarizeScene("{not json");
      expect(summary.parseError).toMatch(/not valid JSON/);
      expect(summary.isEmpty).toBe(true);
    });

    it("reports a scene that is not an object", () => {
      const summary = summarizeScene("[1,2,3]");
      expect(summary.parseError).toMatch(/not a JSON object/);
    });

    it("treats a non-array elements field as empty, like the editor does", () => {
      const summary = summarizeScene(JSON.stringify({ elements: "nope" }));
      expect(summary.parseError).toBeNull();
      expect(summary.isEmpty).toBe(true);
    });

    it("refuses a scene above the size limit without parsing it", () => {
      const summary = summarizeScene(sceneOf([element()]), {
        limits: { maxSceneBytes: 10 },
      });
      expect(summary.parseError).toMatch(/above the .* limit/);
    });

    it("reports the stored byte count, not the re-serialised length", () => {
      const raw = sceneOf([element()]);
      const summary = summarizeScene(raw, { sceneBytes: 999_999 });
      expect(summary.sceneBytes).toBe(999_999);
    });

    it("falls back to the actual length when no byte count is given", () => {
      const raw = sceneOf([element()]);
      const summary = summarizeScene(raw);
      expect(summary.sceneBytes).toBe(Buffer.byteLength(raw, "utf8"));
    });
  });

  describe("files and appState", () => {
    it("reports file count and size but never their data", () => {
      const summary = summarizeScene(
        sceneOf([element()], {
          files: {
            f1: {
              id: "f1",
              dataURL: `data:image/png;base64,${"A".repeat(100)}`,
            },
            f2: {
              id: "f2",
              dataURL: `data:image/png;base64,${"B".repeat(50)}`,
            },
          },
        }),
      );

      expect(summary.files?.count).toBe(2);
      expect(summary.files?.bytes).toBeGreaterThan(100);
      expect(JSON.stringify(summary)).not.toContain("base64");
    });

    it("reports only the board-level appState fields", () => {
      const summary = summarizeScene(
        sceneOf([element()], {
          appState: {
            name: "Architecture",
            viewBackgroundColor: "#ffffff",
            gridSize: 20,
            scrollX: 12345,
            selectedElementIds: { e1: true },
          },
        }),
      );

      expect(summary.appState).toEqual({
        name: "Architecture",
        viewBackgroundColor: "#ffffff",
        gridSize: 20,
      });
      // Viewport state is not board content and must not reach the model.
      expect(JSON.stringify(summary)).not.toContain("12345");
    });
  });

  it("uses the documented defaults when no limits are given", () => {
    expect(DEFAULT_LIMITS.maxTextLength).toBe(500);
    expect(DEFAULT_LIMITS.maxElements).toBe(50);
  });
});
