import React, { useEffect, useState } from "react";
import clsx from "clsx";

import {
  applyDarkModeFilter,
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  isColorDark,
  THEME,
} from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { t } from "../i18n";

import { settingsIcon } from "./icons";

import {
  DRAWING_TOOL_PRESET_COLORS,
  DRAWING_TOOL_PRESET_COUNT,
  getPresetThickness,
  indexToStrokeWidthKey,
  strokeWidthKeyToIndex,
} from "./drawingToolPresets";

import type {
  DrawingToolPreset,
  DrawingToolPresetKind,
} from "./drawingToolPresets";

type DrawingToolPresetRowProps = {
  kind: DrawingToolPresetKind;
  presets: readonly DrawingToolPreset[];
  /** index of the preset matching the current style, or -1 when none matches */
  activeIndex: number;
  theme: Theme;
  onSelect: (preset: DrawingToolPreset, index: number) => void;
  onChange: (index: number, patch: Partial<DrawingToolPreset>) => void;
};

/**
 * The Miro-style preset strip rendered inside the drawing-tools popover for
 * the pen and the highlighter: three one-tap presets plus an inline
 * customization panel editing the selected one.
 */
export const DrawingToolPresetRow = ({
  kind,
  presets,
  activeIndex,
  theme,
  onSelect,
  onChange,
}: DrawingToolPresetRowProps) => {
  const [isCustomizing, setIsCustomizing] = useState(false);

  // the panel edits the selected preset; when the current style matches none
  // (the user tweaked a color by hand), keep editing the last one they used
  const [editingIndex, setEditingIndex] = useState(
    activeIndex >= 0 ? activeIndex : 0,
  );

  useEffect(() => {
    if (activeIndex >= 0) {
      setEditingIndex(activeIndex);
    }
  }, [activeIndex]);

  const editingPreset = presets[editingIndex] ?? presets[0];

  if (!editingPreset) {
    return null;
  }

  const isDark = theme === THEME.DARK;
  const thickness = getPresetThickness(editingPreset);

  const handleSelect = (preset: DrawingToolPreset, index: number) => {
    setEditingIndex(index);
    onSelect(preset, index);
  };

  return (
    <div
      className="drawing-tool-presets"
      data-testid={`drawing-tool-presets-${kind}`}
    >
      <div className="drawing-tool-presets__header">
        <span className="drawing-tool-presets__title">
          {t("toolBar.presets")}
        </span>
        <button
          type="button"
          className={clsx("drawing-tool-presets__customize", {
            "drawing-tool-presets__customize--active": isCustomizing,
          })}
          title={t("toolBar.customizePreset")}
          aria-label={t("toolBar.customizePreset")}
          aria-expanded={isCustomizing}
          data-testid={`drawing-tool-presets-customize-${kind}`}
          onClick={() => setIsCustomizing((value) => !value)}
        >
          {settingsIcon}
        </button>
      </div>

      <div className="drawing-tool-presets__list">
        {presets.slice(0, DRAWING_TOOL_PRESET_COUNT).map((preset, index) => {
          const label = t("toolBar.presetLabel", { number: index + 1 });
          const swatch = applyDarkModeFilter(preset.strokeColor, isDark);

          return (
            <button
              key={index}
              type="button"
              className={clsx("drawing-tool-presets__preset", {
                "drawing-tool-presets__preset--active": index === activeIndex,
                "drawing-tool-presets__preset--editing":
                  isCustomizing && index === editingIndex,
              })}
              title={label}
              aria-label={label}
              aria-pressed={index === activeIndex}
              data-testid={`drawing-tool-preset-${kind}-${index + 1}`}
              onClick={() => handleSelect(preset, index)}
            >
              <span
                className={clsx("drawing-tool-presets__dot", {
                  "drawing-tool-presets__dot--outline": !isColorDark(
                    preset.strokeColor,
                    COLOR_OUTLINE_CONTRAST_THRESHOLD,
                  ),
                })}
                style={{
                  ["--swatch-color" as string]: swatch,
                  ["--swatch-opacity" as string]: preset.opacity / 100,
                  ["--swatch-size" as string]: `${4 + index * 3}px`,
                }}
              />
              <span className="drawing-tool-presets__preset-label">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      {isCustomizing && (
        <div
          className="drawing-tool-presets__panel"
          data-testid={`drawing-tool-presets-panel-${kind}`}
        >
          <div className="drawing-tool-presets__field">
            <label
              className="drawing-tool-presets__field-label"
              htmlFor={`drawing-tool-presets-thickness-${kind}`}
            >
              {t("labels.thickness")}
            </label>
            <input
              id={`drawing-tool-presets-thickness-${kind}`}
              className="drawing-tool-presets__slider"
              type="range"
              min={0}
              max={2}
              step={1}
              value={strokeWidthKeyToIndex(editingPreset.strokeWidthKey)}
              style={{
                ["--range-progress" as string]:
                  strokeWidthKeyToIndex(editingPreset.strokeWidthKey) / 2,
              }}
              aria-label={t("labels.thickness")}
              data-testid={`drawing-tool-presets-thickness-${kind}`}
              onChange={(event) =>
                onChange(editingIndex, {
                  strokeWidthKey: indexToStrokeWidthKey(+event.target.value),
                })
              }
            />
            <output
              className="drawing-tool-presets__readout"
              data-testid={`drawing-tool-presets-thickness-value-${kind}`}
            >
              {t("labels.thicknessValue", { value: thickness })}
            </output>
          </div>

          <div className="drawing-tool-presets__field">
            <span className="drawing-tool-presets__field-label">
              {t("labels.stroke")}
            </span>
            <div className="drawing-tool-presets__colors">
              {DRAWING_TOOL_PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={clsx("drawing-tool-presets__color", {
                    "drawing-tool-presets__color--active":
                      color === editingPreset.strokeColor,
                    "drawing-tool-presets__color--outline": !isColorDark(
                      color,
                      COLOR_OUTLINE_CONTRAST_THRESHOLD,
                    ),
                  })}
                  style={{
                    ["--swatch-color" as string]: applyDarkModeFilter(
                      color,
                      isDark,
                    ),
                  }}
                  title={color}
                  aria-label={color}
                  aria-pressed={color === editingPreset.strokeColor}
                  data-testid={`drawing-tool-presets-color-${kind}-${color}`}
                  onClick={() => onChange(editingIndex, { strokeColor: color })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
