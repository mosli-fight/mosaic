import { useCallback, useEffect, useState } from "react";

import {
  COLOR_PALETTE,
  STROKE_WIDTH_KEYS,
  getStrokeWidthByKey,
} from "@excalidraw/common";

import { clamp } from "@excalidraw/math";

import type { StrokeWidthKey } from "@excalidraw/common";

/**
 * Miro-style presets for the two freedraw-based drawing tools. Both the pen
 * and the highlighter are `freedraw` elements under the hood (the highlighter
 * is a pseudo-tool), so a preset is just the trio of style values the editor
 * already tracks as `currentItem*`.
 */
export type DrawingToolPresetKind = "pen" | "highlighter";

export type DrawingToolPreset = {
  strokeColor: string;
  strokeWidthKey: StrokeWidthKey;
  /** 0-100, matching `appState.currentItemOpacity` */
  opacity: number;
};

export type DrawingToolPresets = Record<
  DrawingToolPresetKind,
  DrawingToolPreset[]
>;

export const DRAWING_TOOL_PRESETS_LS_KEY = "mosaic-drawing-tool-presets";

/** the highlighter is a semi-transparent marker — this is what makes it one */
export const HIGHLIGHTER_PRESET_OPACITY = 60;

/** number of preset slots per tool (the row renders exactly this many) */
export const DRAWING_TOOL_PRESET_COUNT = 3;

const PEN_OPACITY = 100;

export const DEFAULT_DRAWING_TOOL_PRESETS: DrawingToolPresets = {
  pen: [
    {
      strokeColor: COLOR_PALETTE.gray[4],
      strokeWidthKey: "thin",
      opacity: PEN_OPACITY,
    },
    {
      strokeColor: COLOR_PALETTE.red[4],
      strokeWidthKey: "medium",
      opacity: PEN_OPACITY,
    },
    {
      strokeColor: COLOR_PALETTE.green[4],
      strokeWidthKey: "bold",
      opacity: PEN_OPACITY,
    },
  ],
  highlighter: [
    {
      strokeColor: "#ffd60a",
      strokeWidthKey: "bold",
      opacity: HIGHLIGHTER_PRESET_OPACITY,
    },
    {
      strokeColor: COLOR_PALETTE.pink[3],
      strokeWidthKey: "bold",
      opacity: HIGHLIGHTER_PRESET_OPACITY,
    },
    {
      strokeColor: COLOR_PALETTE.green[3],
      strokeWidthKey: "bold",
      opacity: HIGHLIGHTER_PRESET_OPACITY,
    },
  ],
};

/** swatches offered by the customization panel (2 rows of 5) */
export const DRAWING_TOOL_PRESET_COLORS = [
  COLOR_PALETTE.black,
  COLOR_PALETTE.gray[4],
  COLOR_PALETTE.red[4],
  COLOR_PALETTE.pink[3],
  COLOR_PALETTE.orange[4],
  COLOR_PALETTE.yellow[2],
  COLOR_PALETTE.green[4],
  COLOR_PALETTE.teal[4],
  COLOR_PALETTE.blue[4],
  COLOR_PALETTE.violet[4],
] as const;

// -----------------------------------------------------------------------------
// thickness <-> stroke width key
// -----------------------------------------------------------------------------

export const strokeWidthKeyToIndex = (key: StrokeWidthKey) =>
  Math.max(0, STROKE_WIDTH_KEYS.indexOf(key));

export const indexToStrokeWidthKey = (index: number): StrokeWidthKey =>
  STROKE_WIDTH_KEYS[
    clamp(Math.round(index), 0, STROKE_WIDTH_KEYS.length - 1)
  ] as StrokeWidthKey;

/**
 * The thickness the preset actually draws with. Both preset-bearing tools
 * produce `freedraw` elements, which use their own (thinner) stroke scale.
 */
export const getPresetThickness = (preset: DrawingToolPreset) =>
  getStrokeWidthByKey("freedraw", preset.strokeWidthKey);

// -----------------------------------------------------------------------------
// matching
// -----------------------------------------------------------------------------

export const isSamePreset = (
  a: DrawingToolPreset | null,
  b: DrawingToolPreset | null,
) =>
  !!a &&
  !!b &&
  a.strokeColor === b.strokeColor &&
  a.strokeWidthKey === b.strokeWidthKey &&
  a.opacity === b.opacity;

/** index of the preset matching the current style, or -1 when none does */
export const findActivePresetIndex = (
  presets: readonly DrawingToolPreset[],
  current: DrawingToolPreset | null,
) =>
  current ? presets.findIndex((preset) => isSamePreset(preset, current)) : -1;

// -----------------------------------------------------------------------------
// persistence
// -----------------------------------------------------------------------------

const cloneDefaults = (): DrawingToolPresets => ({
  pen: DEFAULT_DRAWING_TOOL_PRESETS.pen.map((preset) => ({ ...preset })),
  highlighter: DEFAULT_DRAWING_TOOL_PRESETS.highlighter.map((preset) => ({
    ...preset,
  })),
});

const isStrokeWidthKey = (value: unknown): value is StrokeWidthKey =>
  typeof value === "string" &&
  (STROKE_WIDTH_KEYS as readonly string[]).includes(value);

const sanitizePreset = (
  value: unknown,
  fallback: DrawingToolPreset,
): DrawingToolPreset => {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const candidate = value as Partial<DrawingToolPreset>;

  return {
    strokeColor:
      typeof candidate.strokeColor === "string" && candidate.strokeColor
        ? candidate.strokeColor
        : fallback.strokeColor,
    strokeWidthKey: isStrokeWidthKey(candidate.strokeWidthKey)
      ? candidate.strokeWidthKey
      : fallback.strokeWidthKey,
    opacity:
      typeof candidate.opacity === "number" &&
      Number.isFinite(candidate.opacity)
        ? clamp(candidate.opacity, 0, 100)
        : fallback.opacity,
  };
};

/**
 * Coerces whatever was in storage into a usable preset set — a stale or
 * hand-edited payload must never leave the row with missing slots.
 */
export const sanitizeDrawingToolPresets = (
  value: unknown,
): DrawingToolPresets => {
  const candidate = (value ?? {}) as Record<string, unknown>;

  const sanitizeKind = (kind: DrawingToolPresetKind): DrawingToolPreset[] => {
    const defaults = DEFAULT_DRAWING_TOOL_PRESETS[kind];
    const raw = candidate[kind];

    return defaults.map((fallback, index) =>
      sanitizePreset(Array.isArray(raw) ? raw[index] : undefined, fallback),
    );
  };

  return { pen: sanitizeKind("pen"), highlighter: sanitizeKind("highlighter") };
};

export const loadDrawingToolPresets = (): DrawingToolPresets => {
  if (typeof window === "undefined") {
    return cloneDefaults();
  }

  try {
    const value = window.localStorage.getItem(DRAWING_TOOL_PRESETS_LS_KEY);
    if (!value) {
      return cloneDefaults();
    }
    return sanitizeDrawingToolPresets(JSON.parse(value));
  } catch (error: any) {
    console.warn(`localStorage.getItem error: ${error.message}`);
    return cloneDefaults();
  }
};

export const saveDrawingToolPresets = (presets: DrawingToolPresets) => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(
      DRAWING_TOOL_PRESETS_LS_KEY,
      JSON.stringify(presets),
    );
    return true;
  } catch (error: any) {
    console.warn(`localStorage.setItem error: ${error.message}`);
    return false;
  }
};

// -----------------------------------------------------------------------------
// hook
// -----------------------------------------------------------------------------

export const useDrawingToolPresets = () => {
  const [presets, setPresets] = useState<DrawingToolPresets>(
    loadDrawingToolPresets,
  );

  useEffect(() => {
    saveDrawingToolPresets(presets);
  }, [presets]);

  const updatePreset = useCallback(
    (
      kind: DrawingToolPresetKind,
      index: number,
      patch: Partial<DrawingToolPreset>,
    ) => {
      setPresets((prev) => {
        const current = prev[kind][index];
        if (!current) {
          return prev;
        }

        const next = { ...current, ...patch };
        if (isSamePreset(current, next)) {
          return prev;
        }

        const list = [...prev[kind]];
        list[index] = next;

        return { ...prev, [kind]: list };
      });
    },
    [],
  );

  const resetPresets = useCallback(() => {
    setPresets(cloneDefaults());
  }, []);

  return { presets, updatePreset, resetPresets };
};
