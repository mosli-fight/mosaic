import React, { useEffect, useState } from "react";
import clsx from "clsx";

import { Popover } from "radix-ui";

import { trackEvent } from "../analytics";

import { t } from "../i18n";

import { DrawingToolPresetRow } from "./DrawingToolPresetRow";
import { IconButton } from "./IconButton";
import { isToolButtonDisabled } from "./Tools";

import {
  findActivePresetIndex,
  useDrawingToolPresets,
} from "./drawingToolPresets";

import type {
  DrawingToolPreset,
  DrawingToolPresetKind,
} from "./drawingToolPresets";

import "./ToolPopover.scss";
import "./DrawingToolsPopover.scss";

import { useExcalidrawContainer } from "./App";

import {
  FreedrawIcon,
  EraserIcon,
  laserPointerToolIcon,
  createIcon,
} from "./icons";

import type { AppClassProperties, AppState, UIAppState } from "../types";

// custom: highlighter (marker pen) — kept local until promoted to icons.tsx
export const HighlighterIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L16.4 4" />
  </g>,
  {
    width: 24,
    height: 24,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
);

type DrawingToolOption = {
  type: string;
  icon: React.ReactNode;
  title: string;
};

type DrawingToolsPopoverProps = {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
};

/**
 * The freedraw / highlighter / laser / eraser popover. The trigger remembers
 * and displays the most recently used option.
 */
export const DrawingToolsPopover = ({
  app,
  activeTool,
  setAppState,
}: DrawingToolsPopoverProps) => {
  const DRAWING_TOOLS: readonly DrawingToolOption[] = [
    { type: "freedraw", icon: FreedrawIcon, title: t("toolBar.freedraw") },
    {
      type: "highlighter",
      icon: HighlighterIcon,
      title: t("toolBar.highlighter"),
    },
    { type: "laser", icon: laserPointerToolIcon, title: t("toolBar.laser") },
    { type: "eraser", icon: EraserIcon, title: t("toolBar.eraser") },
  ];

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [lastDrawingTool, setLastDrawingTool] = useState<string>("freedraw");
  // which preset each option re-applies when picked from the tool list — the
  // rows update these whenever the user picks one. Without this the pen and
  // highlighter options would be one-way: a highlighter stroke stays a
  // highlighter stroke no matter which of the two you click.
  const [lastHighlighterPreset, setLastHighlighterPreset] = useState(0);
  const [lastPenPreset, setLastPenPreset] = useState(0);
  const { container } = useExcalidrawContainer();
  const { presets, updatePreset } = useDrawingToolPresets();

  const currentPreset: DrawingToolPreset | null =
    activeTool.type === "freedraw"
      ? {
          strokeColor: app.state.currentItemStrokeColor,
          strokeWidthKey: app.state.currentItemStrokeWidthKey,
          opacity: app.state.currentItemOpacity,
        }
      : null;

  // the highlighter is a pseudo-tool: freedraw with a marker stroke. Matching
  // against the (user-customizable) highlighter presets subsumes the original
  // hardcoded yellow/bold/60 check, since that is the default first preset.
  const activeHighlighterIndex = findActivePresetIndex(
    presets.highlighter,
    currentPreset,
  );
  const isHighlighterActive =
    activeTool.type === "freedraw" && activeHighlighterIndex >= 0;

  // the pen presets only describe pen strokes — a highlighter stroke must not
  // light up a pen preset that happens to share its color and width
  const activePenIndex = isHighlighterActive
    ? -1
    : findActivePresetIndex(presets.pen, currentPreset);

  const presetKind: DrawingToolPresetKind = isHighlighterActive
    ? "highlighter"
    : "pen";

  const applyPreset = (preset: DrawingToolPreset) => {
    app.setActiveTool({ type: "freedraw" as any });
    setAppState({
      currentItemStrokeColor: preset.strokeColor,
      currentItemStrokeWidthKey: preset.strokeWidthKey,
      currentItemOpacity: preset.opacity,
    });
  };

  const handlePresetSelect = (
    kind: DrawingToolPresetKind,
    preset: DrawingToolPreset,
    index: number,
  ) => {
    trackEvent("toolbar", `${kind}-preset`, "ui");
    applyPreset(preset);
    setLastDrawingTool(kind === "highlighter" ? "highlighter" : "freedraw");
    if (kind === "highlighter") {
      setLastHighlighterPreset(index);
    } else {
      setLastPenPreset(index);
    }
  };

  const handlePresetChange = (
    kind: DrawingToolPresetKind,
    index: number,
    patch: Partial<DrawingToolPreset>,
  ) => {
    updatePreset(kind, index, patch);

    // the preset being customized becomes the active brush — otherwise
    // adjusting a preset that isn't currently applied would appear to do
    // nothing on canvas
    applyPreset({ ...presets[kind][index], ...patch });
    setLastDrawingTool(kind === "highlighter" ? "highlighter" : "freedraw");
    if (kind === "highlighter") {
      setLastHighlighterPreset(index);
    } else {
      setLastPenPreset(index);
    }
  };

  useEffect(() => {
    if (
      activeTool.type === "laser" ||
      activeTool.type === "eraser" ||
      activeTool.type === "freedraw"
    ) {
      setLastDrawingTool(
        activeTool.type === "freedraw" && isHighlighterActive
          ? "highlighter"
          : activeTool.type,
      );
    }
  }, [activeTool.type, isHighlighterActive]);

  // Close popover when user starts interacting with the canvas (pointer down)
  useEffect(() => {
    // app.onPointerDownEmitter emits when pointer down happens on canvas area
    const unsubscribe = app.onPointerDownEmitter.on(() => {
      setIsPopupOpen(false);
    });
    return () => unsubscribe?.();
  }, [app]);

  const displayedOption =
    DRAWING_TOOLS.find((tool) => tool.type === lastDrawingTool) ||
    DRAWING_TOOLS[0];

  const isOptionChecked = (type: string) => {
    if (type === "highlighter") {
      return isHighlighterActive;
    }
    if (type === "freedraw") {
      return activeTool.type === "freedraw" && !isHighlighterActive;
    }
    return activeTool.type === type;
  };

  const handleSelect = (type: string) => {
    // pen and highlighter are both freedraw, so switching between them has to
    // restore the other one's stroke — otherwise clicking "Pen" over a
    // highlighter preset would leave you stuck with marker styling. Picking
    // the one already active is a no-op: it must not clobber a stroke the
    // user set by hand (the trigger re-selects on every open).
    if (type === "highlighter" || type === "freedraw") {
      const kind: DrawingToolPresetKind =
        type === "highlighter" ? "highlighter" : "pen";

      // only a genuine flavor switch re-applies a preset — picking the flavor
      // already in effect must leave a hand-tuned stroke alone (the trigger
      // re-selects on every popover open)
      const isSwitching =
        kind === "highlighter" ? !isHighlighterActive : isHighlighterActive;

      app.setActiveTool({ type: "freedraw" as any });

      if (isSwitching) {
        trackEvent("toolbar", type, "ui");
        const lastIndex =
          kind === "highlighter" ? lastHighlighterPreset : lastPenPreset;
        setAppState({
          currentItemStrokeColor: presets[kind][lastIndex].strokeColor,
          currentItemStrokeWidthKey: presets[kind][lastIndex].strokeWidthKey,
          currentItemOpacity: presets[kind][lastIndex].opacity,
        });
      }

      setLastDrawingTool(kind === "highlighter" ? "highlighter" : "freedraw");
      return;
    }

    if (app.state.activeTool.type !== type) {
      trackEvent("toolbar", type, "ui");
      app.setActiveTool({ type: type as any });
    }
    setLastDrawingTool(type);
  };

  // the highlighter activates freedraw, so it's disabled alongside it
  const isOptionDisabled = (type: string) =>
    isToolButtonDisabled(app, type === "highlighter" ? "freedraw" : type);

  return (
    <Popover.Root open={isPopupOpen}>
      <Popover.Trigger asChild>
        <IconButton
          type="toggle"
          icon={displayedOption.icon}
          checked={isOptionChecked(displayedOption.type)}
          // the trigger stays operable even when every option is disabled
          // (e.g. a host-forced tool) — same as the extra-tools menu, so the
          // options remain discoverable instead of the button going dead
          title={t("toolBar.drawingTools")}
          aria-label={t("toolBar.drawingTools")}
          data-testid="toolbar-freedraw"
          onSelect={() => {
            setIsPopupOpen((v) => !v);
            handleSelect(lastDrawingTool);
          }}
        />
      </Popover.Trigger>

      <Popover.Content
        className={clsx(
          "tool-popover-content",
          "drawing-tools-popover-content",
        )}
        sideOffset={16}
        collisionBoundary={container ?? undefined}
      >
        {DRAWING_TOOLS.map(({ type, icon, title }) => (
          <IconButton
            key={type}
            type="toggle"
            icon={icon}
            checked={isOptionChecked(type)}
            disabled={isOptionDisabled(type)}
            title={title}
            aria-label={title}
            data-testid={`toolbar-${type}`}
            onSelect={() => handleSelect(type)}
          />
        ))}

        {/* presets only apply to the two freedraw-based tools (pen and
            highlighter) — laser and eraser have no stroke style to preset */}
        {activeTool.type === "freedraw" && (
          <>
            <div className="drawing-tools-popover__separator" />
            <DrawingToolPresetRow
              kind={presetKind}
              presets={presets[presetKind]}
              activeIndex={
                presetKind === "highlighter"
                  ? activeHighlighterIndex
                  : activePenIndex
              }
              theme={app.state.theme}
              onSelect={(preset, index) =>
                handlePresetSelect(presetKind, preset, index)
              }
              onChange={(index, patch) =>
                handlePresetChange(presetKind, index, patch)
              }
            />
          </>
        )}
      </Popover.Content>
    </Popover.Root>
  );
};
