import React from "react";

import {
  FRAMES_SIDEBAR_TAB,
  FRAME_FORMAT_PRESETS,
  getFrameFormatSize,
} from "@excalidraw/common";
import { fireEvent, waitFor } from "@testing-library/react";

import type {
  ExcalidrawFrameElement,
  ExcalidrawGenericElement,
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
  backgroundColor,
}: {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string | null;
  notes?: string;
  backgroundColor?: ExcalidrawGenericElement["backgroundColor"];
} = {}) => {
  const frame = API.createElement({
    type: "frame",
    id,
    x,
    y,
    width,
    height,
    backgroundColor,
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

/**
 * The editor takes its size from the window, which jsdom has no opinion
 * about — the tests that care about the viewport say how big it is.
 */
const setViewportSize = (width: number, height: number) => {
  act(() => {
    API.setAppState({ width, height });
  });
};

/** the drawing operations the canvas mock recorded for a canvas */
const getDrawCalls = (canvas: HTMLCanvasElement) =>
  (
    canvas.getContext("2d") as unknown as {
      __getDrawCalls: () => unknown[];
    }
  ).__getDrawCalls();

/** the colors the canvas mock was told to fill with */
const getFillStyles = (canvas: HTMLCanvasElement) =>
  (
    canvas.getContext("2d") as unknown as {
      __getEvents: () => { type: string; props: { value?: unknown } }[];
    }
  )
    .__getEvents()
    .filter((event) => event.type === "fillStyle")
    .map((event) => String(event.props.value));

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

    it("renames a frame on a double click", async () => {
      await render(<Excalidraw />);
      API.setElements([createFrame({ id: "a", name: "First" })]);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-item-0"]'),
        ).not.toBe(null);
      });

      fireEvent.doubleClick(
        document.querySelector<HTMLElement>(
          '[data-testid="frames-panel-item-0"] .frames-panel__item-main',
        )!,
      );

      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="frames-panel-rename-input"]',
      );
      expect(input).not.toBe(null);

      fireEvent.change(input!, { target: { value: "Opening" } });
      fireEvent.keyDown(input!, { key: "Enter" });

      expect(getFrame("a").name).toBe("Opening");
    });

    it("jumps to the frame that is clicked", async () => {
      await render(<Excalidraw />);
      API.setElements([
        createFrame({ id: "a", x: 0, y: 0, width: 200, height: 200 }),
      ]);
      setViewportSize(1000, 800);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-item-0"]'),
        ).not.toBe(null);
      });

      fireEvent.click(
        document.querySelector<HTMLElement>(
          '[data-testid="frames-panel-item-0"] .frames-panel__item-main',
        )!,
      );

      // the jump is animated — let it land
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });

      // the frame is fitted to the viewport, and it ends up in its middle
      expect(h.state.zoom.value).toBeCloseTo(3.76, 5);

      expect(
        h.state.width / 2 / h.state.zoom.value - h.state.scrollX,
      ).toBeCloseTo(100, 3);
      expect(
        h.state.height / 2 / h.state.zoom.value - h.state.scrollY,
      ).toBeCloseTo(100, 3);
    });

    it("highlights the frame that is in view", async () => {
      await render(<Excalidraw />);
      API.setElements([
        createFrame({ id: "a", x: 0, y: 0, width: 200, height: 200 }),
        createFrame({ id: "b", x: 5000, y: 5000, width: 200, height: 200 }),
      ]);
      setViewportSize(1000, 800);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-item-0"]')
            ?.className,
        ).toContain("frames-panel__item--in-view");
      });

      expect(
        document.querySelector('[data-testid="frames-panel-item-1"]')
          ?.className,
      ).not.toContain("frames-panel__item--in-view");
    });

    it("moves the highlight to the frame it jumps to", async () => {
      await render(<Excalidraw />);
      API.setElements([
        createFrame({ id: "a", x: 0, y: 0, width: 200, height: 200 }),
        createFrame({ id: "b", x: 5000, y: 5000, width: 200, height: 200 }),
      ]);
      setViewportSize(1000, 800);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-item-1"]'),
        ).not.toBe(null);
      });

      fireEvent.click(
        document.querySelector<HTMLElement>(
          '[data-testid="frames-panel-item-1"] .frames-panel__item-main',
        )!,
      );

      // the jump is animated — let it land
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });

      expect(
        document.querySelector('[data-testid="frames-panel-item-1"]')
          ?.className,
      ).toContain("frames-panel__item--in-view");
      expect(
        document.querySelector('[data-testid="frames-panel-item-0"]')
          ?.className,
      ).not.toContain("frames-panel__item--in-view");
    });

    it("does not highlight a frame that is hidden", async () => {
      await render(<Excalidraw />);

      const hidden = createFrame({
        id: "a",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      });
      hidden.hidden = true;
      API.setElements([hidden]);
      setViewportSize(1000, 800);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="frames-panel-item-0"]'),
        ).not.toBe(null);
      });

      expect(
        document.querySelector('[data-testid="frames-panel-item-0"]')
          ?.className,
      ).not.toContain("frames-panel__item--in-view");
    });

    it("shows a thumbnail of every frame", async () => {
      await render(<Excalidraw />);
      API.setElements([
        createFrame({ id: "a", x: 0, y: 0, width: 400, height: 300 }),
        createFrame({ id: "b", x: 1000, y: 0, width: 400, height: 300 }),
      ]);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelectorAll(".frames-panel__thumbnail-canvas"),
        ).toHaveLength(2);
      });

      const canvas = document.querySelector<HTMLCanvasElement>(
        ".frames-panel__thumbnail-canvas",
      )!;

      await waitFor(() => {
        expect(getDrawCalls(canvas).length).toBeGreaterThan(0);
      });
    });

    it("paints the frame's own fill into its thumbnail", async () => {
      await render(<Excalidraw />);

      const frame = createFrame({
        id: "a",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        backgroundColor: "#d0ebff",
      });
      API.setElements([frame]);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector(".frames-panel__thumbnail-canvas"),
        ).not.toBe(null);
      });

      const canvas = document.querySelector<HTMLCanvasElement>(
        ".frames-panel__thumbnail-canvas",
      )!;

      await waitFor(
        () => {
          expect(getFillStyles(canvas)).toContain("#d0ebff");
        },
        { timeout: 3000 },
      );
    });

    it("redraws the thumbnail when the frame's contents change", async () => {
      await render(<Excalidraw />);
      API.setElements([
        createFrame({ id: "a", x: 0, y: 0, width: 400, height: 300 }),
      ]);

      openFramesPanel();

      await waitFor(() => {
        expect(
          document.querySelector(".frames-panel__thumbnail-canvas"),
        ).not.toBe(null);
      });

      const canvas = document.querySelector<HTMLCanvasElement>(
        ".frames-panel__thumbnail-canvas",
      )!;

      await waitFor(() => {
        expect(getDrawCalls(canvas).length).toBeGreaterThan(0);
      });

      const drawn = getDrawCalls(canvas).length;

      // the empty frame has nothing to show
      expect(getFillStyles(canvas)).not.toContain("#ffc9c9");

      // something is put on the frame
      API.setElements([
        createFrame({ id: "a", x: 0, y: 0, width: 400, height: 300 }),
        API.createElement({
          type: "rectangle",
          id: "on-frame",
          x: 20,
          y: 20,
          width: 100,
          height: 80,
          backgroundColor: "#ffc9c9",
          frameId: "a",
        }),
      ]);

      // the thumbnail catches up with the frame — and shows what is on it
      await waitFor(
        () => {
          expect(getDrawCalls(canvas).length).toBeGreaterThan(drawn);
          expect(getFillStyles(canvas)).toContain("#ffc9c9");
        },
        { timeout: 3000 },
      );
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
