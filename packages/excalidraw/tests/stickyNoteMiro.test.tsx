import React from "react";

import {
  DEFAULT_STICKY_NOTE_SIZE,
  KEYS,
  STICKY_NOTE_COLORS,
  STICKY_NOTE_HUES,
  STICKY_NOTE_SIZE_PRESETS,
} from "@excalidraw/common";
import { fireEvent } from "@testing-library/react";

import type {
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import {
  actionAddStickyNoteTag,
  actionChangeStickyNoteFill,
  actionChangeStickyNoteFontSize,
  actionChangeStickyNoteSize,
  actionChangeStickyNoteTextAlign,
  actionInsertStickyNoteEmoji,
  actionRemoveStickyNoteTag,
  actionToggleStickyNoteFontStyle,
} from "../actions/actionStickyNote";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const getNote = (id: string) =>
  h.elements.find(
    (element) => element.id === id,
  ) as NonDeleted<ExcalidrawStickyNoteElement>;

const getLabel = (id: string) =>
  h.elements.find(
    (element) => element.id === id,
  ) as NonDeleted<ExcalidrawTextElement>;

/** a note with a label, the way the editor creates them */
const createNote = ({
  id = "note",
  text = "hello",
  fontSize = 28,
  author = null,
  tags = [],
}: {
  id?: string;
  text?: string;
  fontSize?: number;
  author?: string | null;
  tags?: string[];
} = {}) => {
  const labelId = `${id}-label`;
  const note = API.createElement({
    type: "stickynote",
    id,
    x: 100,
    y: 100,
    width: DEFAULT_STICKY_NOTE_SIZE,
    height: DEFAULT_STICKY_NOTE_SIZE,
    baseHeight: DEFAULT_STICKY_NOTE_SIZE,
    boundElements: [{ type: "text", id: labelId }],
  });
  const label = API.createElement({
    type: "text",
    id: labelId,
    x: 100 + DEFAULT_STICKY_NOTE_SIZE / 2,
    y: 100 + DEFAULT_STICKY_NOTE_SIZE / 2,
    text,
    fontSize,
    containerId: id,
    textAlign: "center",
    verticalAlign: "middle",
  });
  (note as any).author = author;
  (note as any).tags = tags;
  return { note, label };
};

const selectNote = (id: string) => {
  act(() => {
    API.setAppState({ selectedElementIds: { [id]: true } });
  });
};

const runAction = <T,>(
  action: Parameters<typeof h.app.actionManager.executeAction>[0],
  value: T,
) => {
  act(() => {
    h.app.actionManager.executeAction(action, "ui", value);
  });
};

describe("sticky notes (Miro-style)", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  describe("fill palette", () => {
    it("offers the sixteen Miro fills in the styles panel", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      const swatches = document.querySelectorAll(
        '[data-testid="sticky-note-fill"] button',
      );
      expect(swatches).toHaveLength(STICKY_NOTE_COLORS.length);
      expect(STICKY_NOTE_COLORS).toHaveLength(16);
    });

    it("colors a note with the picked fill and gives it readable ink", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      // a dark paper
      runAction(actionChangeStickyNoteFill, {
        color: STICKY_NOTE_HUES.violet[1],
      });

      const colored = getNote(note.id);
      expect(colored.backgroundColor).toBe(STICKY_NOTE_HUES.violet[1]);
      // the ink follows the paper: a dark note is written in white
      expect(colored.strokeColor).toBe("#ffffff");
      // and the label — which is what is actually drawn — shares the ink
      expect(getLabel(label.id).strokeColor).toBe("#ffffff");
    });

    it("writes a light ink on a light paper", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionChangeStickyNoteFill, {
        color: STICKY_NOTE_HUES.yellow[0],
      });

      expect(getNote(note.id).strokeColor).toBe("#1e1e1e");
      expect(getLabel(label.id).strokeColor).toBe("#1e1e1e");
    });

    it("configures the next note when nothing is selected", () => {
      runAction(actionChangeStickyNoteFill, {
        color: STICKY_NOTE_HUES.green[1],
      });
      expect(h.state.currentItemStickynoteBackgroundColor).toBe(
        STICKY_NOTE_HUES.green[1],
      );
    });
  });

  describe("size presets", () => {
    it("resizes a note to the picked preset", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionChangeStickyNoteSize, { preset: "large" });

      const resized = getNote(note.id);
      expect(resized.width).toBe(STICKY_NOTE_SIZE_PRESETS.large.width);
      expect(resized.height).toBe(STICKY_NOTE_SIZE_PRESETS.large.height);
      expect(resized.baseHeight).toBe(STICKY_NOTE_SIZE_PRESETS.large.height);
    });

    it("marks the preset that matches the note's width as the active one", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionChangeStickyNoteSize, { preset: "small" });

      const active = document.querySelector(
        '[data-testid="sticky-note-size-small"]',
      );
      expect(active?.closest("button")?.classList.contains("active")).toBe(
        true,
      );
    });
  });

  describe("typography", () => {
    it("sets the label's font size as its ceiling", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionChangeStickyNoteFontSize, { fontSize: 48 });

      expect(getLabel(label.id).baseFontSize).toBe(48);
    });

    it("bolds and un-bolds the whole label", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionToggleStickyNoteFontStyle, { style: "bold" });
      expect(getLabel(label.id).fontStyle?.bold).toBe(true);

      runAction(actionToggleStickyNoteFontStyle, { style: "bold" });
      expect(getLabel(label.id).fontStyle?.bold).toBe(false);
    });

    it("italics the label", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionToggleStickyNoteFontStyle, { style: "italic" });
      expect(getLabel(label.id).fontStyle?.italic).toBe(true);
    });

    it("bolds and italics the label at the same time", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionToggleStickyNoteFontStyle, { style: "bold" });
      runAction(actionToggleStickyNoteFontStyle, { style: "italic" });

      expect(getLabel(label.id).fontStyle?.bold).toBe(true);
      expect(getLabel(label.id).fontStyle?.italic).toBe(true);
    });

    it("aligns the label", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionChangeStickyNoteTextAlign, { textAlign: "left" });
      expect(getLabel(label.id).textAlign).toBe("left");
    });

    it("gives a note without a label one, so the typography still applies", () => {
      const note = API.createElement({
        type: "stickynote",
        id: "note",
        x: 100,
        y: 100,
        width: DEFAULT_STICKY_NOTE_SIZE,
        height: DEFAULT_STICKY_NOTE_SIZE,
        baseHeight: DEFAULT_STICKY_NOTE_SIZE,
      });
      API.setElements([note]);
      selectNote(note.id);

      runAction(actionChangeStickyNoteFontSize, { fontSize: 36 });

      const created = h.elements.find(
        (element) => element.type === "text",
      ) as NonDeleted<ExcalidrawTextElement>;
      expect(created).toBeDefined();
      expect(created.containerId).toBe(note.id);
      expect(created.baseFontSize).toBe(36);
      // the note now holds the label
      expect(getNote(note.id).boundElements).toEqual([
        { type: "text", id: created.id },
      ]);
    });
  });

  describe("emoji", () => {
    it("stamps an emoji into the label", () => {
      const { note, label } = createNote({ text: "hi" });
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionInsertStickyNoteEmoji, { emoji: "👍" });

      expect(getLabel(label.id).text).toBe("hi👍");
      expect(getLabel(label.id).originalText).toBe("hi👍");
    });

    it("gives a note without a label one holding the emoji", () => {
      const note = API.createElement({
        type: "stickynote",
        id: "note",
        x: 100,
        y: 100,
        width: DEFAULT_STICKY_NOTE_SIZE,
        height: DEFAULT_STICKY_NOTE_SIZE,
        baseHeight: DEFAULT_STICKY_NOTE_SIZE,
      });
      API.setElements([note]);
      selectNote(note.id);

      runAction(actionInsertStickyNoteEmoji, { emoji: "🔥" });

      const created = h.elements.find(
        (element) => element.type === "text",
      ) as NonDeleted<ExcalidrawTextElement>;
      expect(created.text).toBe("🔥");
      expect(created.containerId).toBe(note.id);
    });
  });

  describe("tags", () => {
    it("adds a tag to a note", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionAddStickyNoteTag, { tag: "idea" });

      expect(getNote(note.id).tags).toEqual(["idea"]);
    });

    it("removes a tag from a note", () => {
      const { note, label } = createNote({ tags: ["idea", "todo"] });
      API.setElements([note, label]);
      selectNote(note.id);

      runAction(actionRemoveStickyNoteTag, { tag: "idea" });

      expect(getNote(note.id).tags).toEqual(["todo"]);
    });

    it("lists the note's tags in the styles panel", () => {
      const { note, label } = createNote({ tags: ["idea"] });
      API.setElements([note, label]);
      selectNote(note.id);

      expect(
        document.querySelector('[data-testid="sticky-note-tag-idea"]'),
      ).not.toBeNull();
    });
  });

  describe("author", () => {
    it("records the current user's name on a new note", async () => {
      act(() => {
        API.setAppState({ name: "Ada" });
      });
      UI.clickTool("stickynote");
      mouse.clickAt(200, 200);
      // the note opens its label for editing
      Keyboard.keyPress(KEYS.ESCAPE);

      const created = h.elements.find(
        (element) => element.type === "stickynote",
      ) as NonDeleted<ExcalidrawStickyNoteElement>;
      expect(created).toBeDefined();
      expect(created.author).toBe("Ada");
    });

    it("shows the note's author in the styles panel", () => {
      const { note, label } = createNote({ author: "Ada" });
      API.setElements([note, label]);
      selectNote(note.id);

      expect(
        document.querySelector('[data-testid="sticky-note-author"]')
          ?.textContent,
      ).toBe("Ada");
    });
  });

  describe("the styles panel", () => {
    it("is not shown for other elements", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 100,
        y: 100,
      });
      API.setElements([rect]);
      selectNote(rect.id);

      expect(
        document.querySelector('[data-testid="sticky-note-fill"]'),
      ).toBeNull();
    });

    it("picks a fill from a swatch", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      fireEvent.click(
        document.querySelector('[data-testid="sticky-note-fill-blue-dark"]')!,
      );

      expect(getNote(note.id).backgroundColor).toBe(STICKY_NOTE_HUES.blue[1]);
    });

    it("stamps an emoji from the picker", () => {
      const { note, label } = createNote({ text: "note" });
      API.setElements([note, label]);
      selectNote(note.id);

      fireEvent.click(
        document.querySelector('[data-testid="sticky-note-emoji-toggle"]')!,
      );
      fireEvent.click(
        document.querySelector('[data-testid="sticky-note-emoji-🔥"]')!,
      );

      expect(getLabel(label.id).text).toBe("note🔥");
    });

    it("adds a tag from the panel", () => {
      const { note, label } = createNote();
      API.setElements([note, label]);
      selectNote(note.id);

      const input = document.querySelector(
        '[data-testid="sticky-note-tag-input"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "idea" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(getNote(note.id).tags).toEqual(["idea"]);
    });
  });
});
