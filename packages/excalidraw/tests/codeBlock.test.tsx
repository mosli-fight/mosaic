import React from "react";

import {
  DEFAULT_CODE_BLOCK_CODE,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  getCodeBlockLayout,
} from "@excalidraw/common";
import {
  getCodeBlockColors,
  getCodeBlockTokenColor,
} from "@excalidraw/element";
import { newCodeBlockElement } from "@excalidraw/element";
import { exportToCanvas } from "@excalidraw/utils";

import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

/** the drawing operations the canvas mock recorded for a canvas */
const getDrawCalls = (canvas: HTMLCanvasElement) =>
  (
    canvas.getContext("2d") as unknown as {
      __getDrawCalls: () => { type: string; props: Record<string, unknown> }[];
    }
  ).__getDrawCalls();

/** the property assignments the canvas mock recorded (fillStyle and friends) */
const getEvents = (canvas: HTMLCanvasElement) =>
  (
    canvas.getContext("2d") as unknown as {
      __getEvents: () => { type: string; props: { value?: unknown } }[];
    }
  ).__getEvents();

/** the texts the canvas mock was told to draw */
const getDrawnTexts = (canvas: HTMLCanvasElement) =>
  getDrawCalls(canvas)
    .filter((call) => call.type === "fillText")
    .map((call) => String(call.props.text));

describe("the code block element", () => {
  describe("creation", () => {
    it("is born sized around its code", () => {
      const element = API.createElement({
        type: "codeblock",
        code: "const x = 1;",
        language: "javascript",
      });

      // API.createElement's default width/height would win over the layout,
      // so the block is made the way the editor makes it
      const created = newCodeBlockElement({
        x: 0,
        y: 0,
        code: "const x = 1;",
        language: "javascript",
      });

      const layout = getCodeBlockLayout("const x = 1;");
      expect(element.type).toBe("codeblock");
      expect(element.code).toBe("const x = 1;");
      expect(element.language).toBe("javascript");
      expect(created.width).toBe(layout.width);
      expect(created.height).toBe(layout.height);
    });

    it("starts with the default code and language", () => {
      const element = API.createElement({ type: "codeblock" });
      expect(element.code).toBe(DEFAULT_CODE_BLOCK_CODE);
      expect(element.language).toBe(DEFAULT_CODE_BLOCK_LANGUAGE);
    });

    it("normalizes a language it does not know", () => {
      const element = API.createElement({
        type: "codeblock",
        language: "brainfuck" as any,
      });
      expect(element.language).toBe("plaintext");
    });
  });

  describe("rendering", () => {
    it("paints the code's tokens on the canvas", async () => {
      const element = API.createElement({
        type: "codeblock",
        x: 0,
        y: 0,
        code: 'const x = "hi";',
        language: "javascript",
      });

      const canvas = await exportToCanvas({ elements: [element], files: {} });
      const texts = getDrawnTexts(canvas);

      // the tokenizer's runs, each drawn at its own x
      expect(texts).toEqual(expect.arrayContaining(["const", '"hi"']));
    });

    it("paints the card in the theme's colours", async () => {
      const element = API.createElement({
        type: "codeblock",
        x: 0,
        y: 0,
        code: "x",
      });

      const canvas = await exportToCanvas({ elements: [element], files: {} });
      const fills = getEvents(canvas)
        .filter((event) => event.type === "fillStyle")
        .map((event) => String(event.props.value));

      const colors = getCodeBlockColors("light");
      expect(fills).toEqual(expect.arrayContaining([colors.background]));
    });

    it("paints the language label in the header", async () => {
      const element = API.createElement({
        type: "codeblock",
        x: 0,
        y: 0,
        code: "def f(): pass",
        language: "python",
      });

      const canvas = await exportToCanvas({ elements: [element], files: {} });
      expect(getDrawnTexts(canvas)).toContain("Python");
    });

    it("uses a token colour from the palette", () => {
      const color = getCodeBlockTokenColor("keyword", "light");
      expect(color).toMatch(/^#/);
      // the two themes do not share a palette
      expect(color).not.toBe(getCodeBlockTokenColor("keyword", "dark"));
    });
  });

  describe("editing", () => {
    it("opens its editor on a double click", async () => {
      await render(<Excalidraw />);
      API.setElements([
        API.createElement({
          type: "codeblock",
          x: 100,
          y: 100,
          width: 320,
          height: 200,
          code: "const x = 1;",
        }),
      ]);

      mouse.reset();
      mouse.doubleClickAt(150, 150);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="code-block-editor"]'),
        ).not.toBe(null);
      });
      expect(h.state.editingCodeBlock).toBe(h.elements[0].id);
    });

    it("writes what is typed into the element's code", async () => {
      await render(<Excalidraw />);
      API.setElements([
        API.createElement({
          type: "codeblock",
          x: 100,
          y: 100,
          width: 320,
          height: 200,
          code: "a",
        }),
      ]);

      mouse.reset();
      mouse.doubleClickAt(150, 150);

      const editor = (await waitFor(() => {
        const found = document.querySelector<HTMLTextAreaElement>(
          '[data-testid="code-block-editor"]',
        );
        expect(found).not.toBe(null);
        return found;
      }))!;

      fireEvent.change(editor, { target: { value: "const x = 1;" } });

      expect((h.elements[0] as any).code).toBe("const x = 1;");
    });

    it("closes the editor on Escape", async () => {
      await render(<Excalidraw />);
      API.setElements([
        API.createElement({
          type: "codeblock",
          x: 100,
          y: 100,
          width: 320,
          height: 200,
          code: "a",
        }),
      ]);

      mouse.reset();
      mouse.doubleClickAt(150, 150);

      const editor = await waitFor(() => {
        const found = document.querySelector<HTMLTextAreaElement>(
          '[data-testid="code-block-editor"]',
        );
        expect(found).not.toBe(null);
        return found;
      });

      fireEvent.keyDown(editor!, { key: "Escape" });

      await waitFor(() => {
        expect(h.state.editingCodeBlock).toBe(null);
      });
    });
  });

  describe("the language picker", () => {
    it("changes the element's language", async () => {
      await render(<Excalidraw />);
      API.setElements([
        API.createElement({
          type: "codeblock",
          x: 100,
          y: 100,
          width: 320,
          height: 200,
          code: "a",
          language: "javascript",
        }),
      ]);

      act(() => {
        API.setAppState({ selectedElementIds: { [h.elements[0].id]: true } });
      });

      const picker = await waitFor(() => {
        const found = document.querySelector<HTMLButtonElement>(
          '[data-testid="code-block-language"]',
        );
        expect(found).not.toBe(null);
        return found;
      });

      fireEvent.click(picker!);

      const option = document.querySelector<HTMLButtonElement>(
        '[data-testid="code-block-language-python"]',
      );
      expect(option).not.toBe(null);
      fireEvent.click(option!);

      expect((h.elements[0] as any).language).toBe("python");
    });
  });

  describe("copying", () => {
    it("copies the code, not the board", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      await render(<Excalidraw />);
      API.setElements([
        API.createElement({
          type: "codeblock",
          x: 100,
          y: 100,
          width: 320,
          height: 200,
          code: "const x = 1;",
        }),
      ]);

      act(() => {
        API.setAppState({ selectedElementIds: { [h.elements[0].id]: true } });
      });

      const copy = await waitFor(() => {
        const found = document.querySelector<HTMLButtonElement>(
          '[data-testid="code-block-copy"]',
        );
        expect(found).not.toBe(null);
        return found;
      });

      fireEvent.click(copy!);

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("const x = 1;");
      });
    });
  });

  describe("export", () => {
    it("exports the card and its code to SVG", async () => {
      const element = API.createElement({
        type: "codeblock",
        x: 0,
        y: 0,
        code: 'const x = "hi";',
        language: "javascript",
      });

      const svg = await exportToSvg(
        [element],
        { exportBackground: false, viewBackgroundColor: "#ffffff" },
        {},
      );

      const texts = [...svg.querySelectorAll("text")].map(
        (text) => text.textContent,
      );
      // the language label and the code's tokens
      expect(texts).toEqual(expect.arrayContaining(["JavaScript"]));
      expect(svg.querySelectorAll("rect").length).toBeGreaterThan(0);
    });

    it("exports the card to a canvas", async () => {
      const element = API.createElement({
        type: "codeblock",
        x: 0,
        y: 0,
        code: "const x = 1;",
      });

      const canvas = await exportToCanvas({ elements: [element], files: {} });
      expect(canvas.getContext("2d")?.fillText).toHaveBeenCalled();
    });
  });

  describe("serialization", () => {
    it("keeps its code and language through a restore", () => {
      const element = API.createElement({
        type: "codeblock",
        code: "def f(): pass",
        language: "python",
      });

      const restored = restoreElements([element], null);
      expect(restored[0].type).toBe("codeblock");
      expect((restored[0] as any).code).toBe("def f(): pass");
      expect((restored[0] as any).language).toBe("python");
    });

    it("restores an unknown language as plain text", () => {
      const element = {
        ...API.createElement({ type: "codeblock", code: "x" }),
        language: "brainfuck",
      };

      const restored = restoreElements([element as any], null);
      expect((restored[0] as any).language).toBe("plaintext");
    });

    it("restores a block whose code is missing as empty", () => {
      const element = {
        ...API.createElement({ type: "codeblock", code: "x" }),
        code: undefined,
      };

      const restored = restoreElements([element as any], null);
      expect((restored[0] as any).code).toBe("");
    });
  });
});
