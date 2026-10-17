import React, { useEffect, useState } from "react";
import clsx from "clsx";

import { Popover } from "radix-ui";

import { trackEvent } from "../analytics";

import { t } from "../i18n";

import { IconButton } from "./IconButton";
import { isToolButtonDisabled } from "./Tools";

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

/** the stroke the highlighter pseudo-tool applies on top of freedraw */
const HIGHLIGHTER_STROKE_COLOR = "#ffd60a";
const HIGHLIGHTER_STROKE_WIDTH_KEY = "bold";
const HIGHLIGHTER_OPACITY = 60;

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
  const { container } = useExcalidrawContainer();

  // the highlighter is a pseudo-tool: freedraw with a bold yellow stroke
  const isHighlighterActive =
    activeTool.type === "freedraw" &&
    app.state.currentItemStrokeWidthKey === HIGHLIGHTER_STROKE_WIDTH_KEY &&
    app.state.currentItemStrokeColor === HIGHLIGHTER_STROKE_COLOR;

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
    if (type === "highlighter") {
      trackEvent("toolbar", "highlighter", "ui");
      app.setActiveTool({ type: "freedraw" as any });
      setAppState({
        currentItemStrokeWidthKey: HIGHLIGHTER_STROKE_WIDTH_KEY,
        currentItemStrokeColor: HIGHLIGHTER_STROKE_COLOR,
        currentItemOpacity: HIGHLIGHTER_OPACITY,
      });
      setLastDrawingTool("highlighter");
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
          disabled={DRAWING_TOOLS.every((option) =>
            isOptionDisabled(option.type),
          )}
          title={t("toolBar.drawingTools")}
          aria-label={t("toolBar.drawingTools")}
          data-testid="toolbar-drawing-tools"
          onSelect={() => {
            setIsPopupOpen((v) => !v);
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
      </Popover.Content>
    </Popover.Root>
  );
};
