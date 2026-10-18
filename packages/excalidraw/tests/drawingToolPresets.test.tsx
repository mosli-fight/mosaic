import React from "react";

import { fireEvent, render, waitFor } from "./test-utils";
import { Excalidraw } from "../index";

import {
  DEFAULT_DRAWING_TOOL_PRESETS,
  DRAWING_TOOL_PRESETS_LS_KEY,
  findActivePresetIndex,
  loadDrawingToolPresets,
  sanitizeDrawingToolPresets,
} from "../components/drawingToolPresets";

const openPopover = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector('[data-testid="toolbar-freedraw"]')!);
  await waitFor(() =>
    expect(document.querySelector(".drawing-tools-popover-content")).not.toBe(
      null,
    ),
  );
};

const clickTool = (type: string) =>
  fireEvent.click(
    document.querySelector(
      `.drawing-tools-popover-content [data-testid="toolbar-${type}"]`,
    )!,
  );

const clickPreset = (kind: string, index: number) =>
  fireEvent.click(
    document.querySelector(
      `[data-testid="drawing-tool-preset-${kind}-${index}"]`,
    )!,
  );

describe("drawingToolPresets module", () => {
  it("falls back to the defaults for missing or corrupt storage", () => {
    expect(loadDrawingToolPresets()).toEqual(DEFAULT_DRAWING_TOOL_PRESETS);

    window.localStorage.setItem(DRAWING_TOOL_PRESETS_LS_KEY, "not json");
    expect(loadDrawingToolPresets()).toEqual(DEFAULT_DRAWING_TOOL_PRESETS);
  });

  it("keeps every slot when the stored payload is partial or malformed", () => {
    const sanitized = sanitizeDrawingToolPresets({
      pen: [{ strokeColor: 5, strokeWidthKey: "nonsense" }, null],
      highlighter: "nope",
    });

    // malformed slots fall back to their default rather than disappearing
    expect(sanitized.pen).toHaveLength(3);
    expect(sanitized.pen[0]).toEqual(DEFAULT_DRAWING_TOOL_PRESETS.pen[0]);
    expect(sanitized.pen[1]).toEqual(DEFAULT_DRAWING_TOOL_PRESETS.pen[1]);
    expect(sanitized.highlighter).toEqual(
      DEFAULT_DRAWING_TOOL_PRESETS.highlighter,
    );
  });

  it("clamps an out-of-range stored opacity", () => {
    const sanitized = sanitizeDrawingToolPresets({
      pen: [{ strokeColor: "#000", strokeWidthKey: "thin", opacity: 5000 }],
    });
    expect(sanitized.pen[0].opacity).toBe(100);
  });

  it("findActivePresetIndex matches on all three style values", () => {
    const { pen } = DEFAULT_DRAWING_TOOL_PRESETS;
    expect(findActivePresetIndex(pen, pen[1])).toBe(1);
    expect(findActivePresetIndex(pen, null)).toBe(-1);
    expect(findActivePresetIndex(pen, { ...pen[1], opacity: 42 })).toBe(-1);
  });
});

describe("drawing tool presets in the popover", () => {
  it("applies a pen preset to the current stroke", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    expect(
      document.querySelector('[data-testid="drawing-tool-presets-pen"]'),
    ).not.toBe(null);

    clickPreset("pen", 2);
    expect(window.h.state.currentItemStrokeColor).toBe("#e03131");
    expect(window.h.state.currentItemStrokeWidthKey).toBe("medium");
    expect(window.h.state.currentItemOpacity).toBe(100);

    clickPreset("pen", 3);
    expect(window.h.state.currentItemStrokeColor).toBe("#2f9e44");
    expect(window.h.state.currentItemStrokeWidthKey).toBe("bold");
  });

  it("applies a highlighter preset including its marker opacity", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);
    clickTool("highlighter");

    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-testid="drawing-tool-presets-highlighter"]',
        ),
      ).not.toBe(null),
    );

    expect(window.h.state.currentItemStrokeColor).toBe("#ffd60a");
    expect(window.h.state.currentItemOpacity).toBe(60);

    clickPreset("highlighter", 2);
    expect(window.h.state.currentItemStrokeColor).toBe("#e64980");
    expect(window.h.state.currentItemOpacity).toBe(60);
    expect(window.h.state.currentItemStrokeWidthKey).toBe("bold");
  });

  it("switches back and forth between pen and highlighter presets", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    clickTool("highlighter");
    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-testid="drawing-tool-presets-highlighter"]',
        ),
      ).not.toBe(null),
    );
    clickPreset("highlighter", 2);
    expect(window.h.state.currentItemStrokeColor).toBe("#e64980");

    // back to pen — the marker stroke must not stick
    clickTool("freedraw");
    await waitFor(() =>
      expect(
        document.querySelector('[data-testid="drawing-tool-presets-pen"]'),
      ).not.toBe(null),
    );
    expect(window.h.state.currentItemOpacity).toBe(100);

    // and the highlighter remembers which preset it was on
    clickTool("highlighter");
    await waitFor(() =>
      expect(window.h.state.currentItemStrokeColor).toBe("#e64980"),
    );
    expect(window.h.state.currentItemOpacity).toBe(60);
  });

  it("marks the active option and the active preset", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);
    clickTool("highlighter");

    await waitFor(() => {
      const highlighter = document.querySelector(
        '.drawing-tools-popover-content [data-testid="toolbar-highlighter"]',
      )!;
      expect(highlighter.getAttribute("aria-pressed")).toBe("true");
    });

    const pen = document.querySelector(
      '.drawing-tools-popover-content [data-testid="toolbar-freedraw"]',
    )!;
    expect(pen.getAttribute("aria-pressed")).toBe("false");

    // the default highlighter preset is the first one
    expect(
      document
        .querySelector('[data-testid="drawing-tool-preset-highlighter-1"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("edits thickness and color from the customization panel and persists", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    fireEvent.click(
      document.querySelector(
        '[data-testid="drawing-tool-presets-customize-pen"]',
      )!,
    );

    const slider = document.querySelector<HTMLInputElement>(
      '[data-testid="drawing-tool-presets-thickness-pen"]',
    )!;
    expect(slider).not.toBe(null);
    expect(slider.value).toBe("0"); // preset 1 is thin

    fireEvent.change(slider, { target: { value: "2" } });
    expect(window.h.state.currentItemStrokeWidthKey).toBe("bold");

    expect(
      document.querySelector(
        '[data-testid="drawing-tool-presets-thickness-value-pen"]',
      )!.textContent,
    ).toBe("2 px");

    fireEvent.click(
      document.querySelector(
        '[data-testid="drawing-tool-presets-color-pen-#1971c2"]',
      )!,
    );
    expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");

    // both edits landed in storage
    const stored = JSON.parse(
      window.localStorage.getItem(DRAWING_TOOL_PRESETS_LS_KEY)!,
    );
    expect(stored.pen[0].strokeWidthKey).toBe("bold");
    expect(stored.pen[0].strokeColor).toBe("#1971c2");
  });

  it("hides the preset row for laser and eraser", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    clickTool("laser");
    expect(
      document.querySelector('[data-testid="drawing-tool-presets-pen"]'),
    ).toBe(null);
  });

  it("does not mistake a pen preset for the highlighter", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    clickPreset("pen", 1);

    await waitFor(() => {
      const pen = document.querySelector(
        '.drawing-tools-popover-content [data-testid="toolbar-freedraw"]',
      )!;
      expect(pen.getAttribute("aria-pressed")).toBe("true");
    });

    expect(
      document.querySelector('[data-testid="drawing-tool-presets-pen"]'),
    ).not.toBe(null);
    expect(
      document.querySelector('[data-testid="drawing-tool-presets-highlighter"]'),
    ).toBe(null);
  });

  it("renders every preset when storage holds a corrupt payload", async () => {
    window.localStorage.setItem(
      DRAWING_TOOL_PRESETS_LS_KEY,
      JSON.stringify({ pen: [{ strokeColor: 5 }], highlighter: "nope" }),
    );

    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    expect(
      document.querySelector('[data-testid="drawing-tool-preset-pen-1"]'),
    ).not.toBe(null);
    expect(
      document.querySelector('[data-testid="drawing-tool-preset-pen-3"]'),
    ).not.toBe(null);

    clickPreset("pen", 1);
    expect(window.h.state.currentItemStrokeColor).toBe("#343a40");
  });
});
