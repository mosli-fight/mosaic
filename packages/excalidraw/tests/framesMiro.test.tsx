import React from "react";

import {
  FRAMES_SIDEBAR_TAB,
  FRAME_FORMAT_PRESETS,
  getFrameFormatSize,
} from "@excalidraw/common";
import { fireEvent, waitFor } from "@testing-library/react";

import type {
  ExcalidrawFrameElement,
  NonDeleted,
} from "@excalidraw/element/types";

import {
  actionChangeFrameFill,
  actionMoveFrameDown,
  actionMoveFrameUp,
  actionPresentNextFrame,
  actionPresentPreviousFrame,
  actionRenameFrame,
  actionSetFrameNotes,
  actionToggleFrameHidden,
  actionTogglePresentMode,
} from "../actions/actionFrames";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const getFrame = (id: string) =>
  h.elements.find(
    (element) => element.id === id,
  ) as NonDeleted<ExcalidrawFrameElement>;

const createFrame = ({
  id = "frame-1",
  x = 0,
  y = 0,
  width = 200,
  height = 200,
  name = null,
  notes = "",
}: {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string | null;
  notes?: string;
} = {}) => {
  const frame = API.createElement({
    type: "frame",
    id,
    x,
    y,
    width,
    height,
  }) as NonDeleted<ExcalidrawFrameElement>;
  frame.name = name;
  frame.notes = notes;
  return frame;
};

const selectFrame = (id: string) => {
  act(() => {
    API.setAppState({ selectedElementIds: { [id]: true } });
  });
};

const runAction = <T,>(
  action: Parameters<typeof h.app.actionManager.executeAction>[0],
  value?: T,
) => {
  act(() => {
    h.app.actionManager.executeAction(action, "ui", value);
  });
};

const openFramesPanel = () => {
  act(() => {
    API.setAppState({
      openSidebar: { name: "default", tab: FRAMES_SIDEBAR_TAB },
    });
  });
};

describe("frames (Miro-style)", () => {
  describe("the format picker", () => {
    it("lists the paper formats in the toolbar", async () => {
      const { container } = await render(<Excalidraw />);

      const trigger = container.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-frame"]',
      );
      expect(trigger).not.toBe(null);

      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(document.querySelector(".frame-format-picker__grid")).not.toBe(
          null,
        );
      });

      const options = document.querySelectorAll(
        '[data-testid^="toolbar-frame-format-"]',
      );
      expect(options).toHaveLength(FRAME_FORMAT_PRESETS.length);
      expect(FRAME_FORMAT_PRESETS.map((preset) => preset.id)).toEqual([
        "custom",
        "16:9",
        "4:3",
        "1:1",
        "a4",
        "letter",
        "mobile",
        "tablet",
        "desktop",
      ]);
    });

    it("arms the frame tool with the picked format", async () => {
      const { container } = await render(<Excalidraw />);

      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          '[data-testid="toolbar-frame"]',
        )!,
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="toolbar-frame-format-16:9"]'),
        ).not.toBe(null);
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="toolbar-frame-format-16:9"]',
        )!,
      );

      expect(h.state.currentItemFrameFormat).toBe("16:9");
      expect(h.state.activeTool.type).toBe("frame");
    });
  });

  describe("creating a frame", () => {
    it("sizes a frame from the picked format, whatever the drag", async () => {
      await render(<Excalidraw />);

      act(() => {
        API.setAppState({ currentItemFrameFormat: "16:9" });
        h.app.setActiveTool({ type: "frame" });
      });

      mouse.reset();
      mouse.down(100, 100);
      mouse.up(150, 120);

      const frame = h.elements[0] as NonDeleted<ExcalidrawFrameElement>;
      expect(frame.type).toBe("frame");
      expect(frame.width).toBe(getFrameFormatSize("16:9")!.width);
      expect(frame.height).toBe(getFrameFormatSize("16:9")!.height);
    });

    it("sizes a custom frame by the drag", async () => {
      await render(<Excalidraw />);

      act(() => {
        API.setAppState({ currentItemFrameFormat: "custom" });
        h.app.setActiveTool({ type: "frame" });
      });

      mouse.reset();
      mouse.down(100, 100);
      mouse.up(150, 120);

      const frame = h.elements[0] as NonDeleted<ExcalidrawFrameElement>;
      expect(frame.type).toBe("frame");
      expect(frame.width).toBe(150);
      expect(frame.height).toBe(120);
    });
  });

  describe("the frame context toolbar", () => {
    it("colors the frame with the picked fill", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      const swatches = document.querySelectorAll(
        '[data-testid="frame-fill"] button',
      );
      expect(swatches.length).toBeGreaterThan(0);

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="frame-fill-#d0ebff"]',
        )!,
      );

      expect(getFrame("frame-1").backgroundColor).toBe("#d0ebff");
    });

    it("renames the frame", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="frame-name-input"]',
      )!;
      expect(input).not.toBe(null);

      fireEvent.change(input, { target: { value: "Intro" } });
      fireEvent.blur(input);

      expect(getFrame("frame-1").name).toBe("Intro");
    });

    it("keeps the presenter's notes on the frame", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      const input = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="frame-notes-input"]',
      )!;

      fireEvent.change(input, { target: { value: "Start here" } });
      fireEvent.blur(input);

      expect(getFrame("frame-1").notes).toBe("Start here");
    });

    it("hides the frame, and everything on it, off the board", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="frame-hide"]',
        )!,
      );

      expect(getFrame("frame-1").hidden).toBe(true);
    });

    it("locks the frame", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="frame-lock"]',
        )!,
      );

      expect(getFrame("frame-1").locked).toBe(true);
    });

    it("moves the frame in the frames order", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a" }), createFrame({ id: "b" })]);
      selectFrame("b");

      runAction(actionMoveFrameUp);

      const frames = h.elements.filter(
        (element) => element.type === "frame",
      ) as NonDeleted<ExcalidrawFrameElement>[];
      expect(frames.map((frame) => frame.id)).toEqual(["b", "a"]);

      selectFrame("b");
      runAction(actionMoveFrameDown);

      const moved = h.elements.filter(
        (element) => element.type === "frame",
      ) as NonDeleted<ExcalidrawFrameElement>[];
      expect(moved.map((frame) => frame.id)).toEqual(["a", "b"]);
    });
  });

  describe("the frames panel", () => {
    it("lists every frame of the board", async () => {
      await render(<Excalidraw />);
      API.setElements([
        createFrame({ id: "a", name: "First" }),
        createFrame({ id: "b", name: "Second" }),
      ]);

      openFramesPanel();

      await waitFor(() => {
        expect(document.querySelector('[data-testid="frames-panel"]')).not.toBe(
          null,
        );
      });

      const items = document.querySelectorAll(
        '[data-testid^="frames-panel-item-"]',
      );
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain("First");
      expect(items[1].textContent).toContain("Second");
    });

    it("says so when the board has no frames", async () => {
      await render(<Excalidraw />);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-empty"]'),
        ).not.toBe(null);
      });
    });

    it("renames a frame from the panel", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a", name: "First" })]);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-rename-0"]'),
        ).not.toBe(null);
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="frames-panel-rename-0"]',
        )!,
      );

      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="frames-panel-rename-input"]',
      )!;
      fireEvent.change(input, { target: { value: "Opening" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(getFrame("a").name).toBe("Opening");
    });
  });

  describe("present mode", () => {
    it("starts the show on the first frame", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a" }), createFrame({ id: "b" })]);

      runAction(actionTogglePresentMode);

      expect(h.state.presentMode.active).toBe(true);
      expect(h.state.presentMode.currentFrameId).toBe("a");
      expect(document.querySelector('[data-testid="present-mode"]')).not.toBe(
        null,
      );
    });

    it("walks the frames and wraps around", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a" }), createFrame({ id: "b" })]);

      runAction(actionTogglePresentMode);
      runAction(actionPresentNextFrame);
      expect(h.state.presentMode.currentFrameId).toBe("b");

      runAction(actionPresentNextFrame);
      expect(h.state.presentMode.currentFrameId).toBe("a");

      runAction(actionPresentPreviousFrame);
      expect(h.state.presentMode.currentFrameId).toBe("b");
    });

    it("leaves the stage and restores the viewport", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a" })]);

      const before = { scrollX: h.state.scrollX, scrollY: h.state.scrollY };

      runAction(actionTogglePresentMode);
      expect(h.state.presentMode.active).toBe(true);

      runAction(actionTogglePresentMode);
      expect(h.state.presentMode.active).toBe(false);
      expect(h.state.scrollX).toBe(before.scrollX);
      expect(h.state.scrollY).toBe(before.scrollY);
    });

    it("keeps hidden frames out of the show", async () => {
      await render(<Excalidraw />);
      const hidden = createFrame({ id: "a" });
      hidden.hidden = true;
      API.setElements([hidden, createFrame({ id: "b" })]);

      runAction(actionTogglePresentMode);

      expect(h.state.presentMode.currentFrameId).toBe("b");
    });

    it("shows the presenter's notes", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a", notes: "Say hello" })]);

      runAction(actionTogglePresentMode);

      const toggle = document.querySelector<HTMLButtonElement>(
        '[data-testid="present-notes-toggle"]',
      )!;
      expect(toggle).not.toBe(null);

      fireEvent.click(toggle);

      expect(
        document.querySelector('[data-testid="present-notes"]')?.textContent,
      ).toContain("Say hello");
    });
  });

  describe("the frame actions", () => {
    it("renames and annotates a frame through its actions", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      runAction(actionRenameFrame, { name: "Chapter 1" });
      expect(getFrame("frame-1").name).toBe("Chapter 1");

      runAction(actionSetFrameNotes, { notes: "intro" });
      expect(getFrame("frame-1").notes).toBe("intro");
    });

    it("colors a frame through its action", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      runAction(actionChangeFrameFill, { color: "#fff3bf" });
      expect(getFrame("frame-1").backgroundColor).toBe("#fff3bf");
    });

    it("hides a frame through its action", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame()]);
      selectFrame("frame-1");

      runAction(actionToggleFrameHidden);
      expect(getFrame("frame-1").hidden).toBe(true);
    });
  });
});
