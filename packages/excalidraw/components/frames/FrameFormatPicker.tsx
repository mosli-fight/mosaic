import React, { useState } from "react";
import clsx from "clsx";

import {
  DEVICE_FRAME_PRESETS,
  FRAME_FORMAT_PRESETS,
  getFrameFormatPreset,
  type FrameFormatId,
} from "@excalidraw/common";

import { Popover } from "radix-ui";

import { trackEvent } from "../../analytics";
import { t } from "../../i18n";

import { useExcalidrawContainer } from "../App";
import { IconButton } from "../IconButton";
import { frameToolIcon } from "../icons";
import { isToolButtonDisabled } from "../Tools";

import "./FrameFormatPicker.scss";

import type { AppClassProperties, AppState, UIAppState } from "../../types";

/**
 * The frame tool with its paper formats.
 *
 * The tool itself is the trigger: pressing it arms the frame tool, and the
 * popover next to it is the *format* the next frame takes. A format is a
 * preference rather than a mode — it stays armed for the frame after the
 * one it made, so a run of same-sized frames is one pick and then a few
 * clicks.
 */
export const FrameFormatPicker = ({
  app,
  activeTool,
  setAppState,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { container } = useExcalidrawContainer();

  const currentFormat = getFrameFormatPreset(app.state.currentItemFrameFormat);
  const isFrameToolActive = activeTool.type === "frame";
  const isDisabled = isToolButtonDisabled(app, "frame");

  const selectFormat = (id: FrameFormatId) => {
    setIsOpen(false);
    trackEvent("toolbar", "frame", "ui");
    setAppState({ currentItemFrameFormat: id });
    if (activeTool.type !== "frame") {
      app.setActiveTool({ type: "frame" });
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <IconButton
          type="toggle"
          icon={frameToolIcon}
          checked={isFrameToolActive}
          disabled={isDisabled}
          title={`${t("toolBar.frame")} — ${t(
            `labels.frame.formats.${currentFormat.id}`,
          )}`}
          aria-label={t("toolBar.frame")}
          aria-keyshortcuts="F"
          data-testid="toolbar-frame"
          onSelect={() => {
            setIsOpen((open) => !open);
            if (activeTool.type !== "frame") {
              trackEvent("toolbar", "frame", "ui");
              app.setActiveTool({ type: "frame" });
            }
          }}
        />
      </Popover.Trigger>

      <Popover.Content
        className="frame-format-picker"
        sideOffset={16}
        collisionBoundary={container ?? undefined}
      >
        <div className="frame-format-picker__title">{t("toolBar.frame")}</div>
        <div className="frame-format-picker__grid">
          {FRAME_FORMAT_PRESETS.map((preset) => {
            const isSelected = preset.id === currentFormat.id;
            const label = t(`labels.frame.formats.${preset.id}`);

            return (
              <button
                type="button"
                key={preset.id}
                className={clsx("frame-format-picker__option", {
                  "frame-format-picker__option--selected": isSelected,
                })}
                title={label}
                aria-label={label}
                aria-pressed={isSelected}
                data-testid={`toolbar-frame-format-${preset.id}`}
                onClick={() => selectFormat(preset.id)}
              >
                <span className="frame-format-picker__preview">
                  {preset.width > 0 && preset.height > 0 ? (
                    <span
                      className="frame-format-picker__shape"
                      style={{
                        aspectRatio: `${preset.width} / ${preset.height}`,
                      }}
                    />
                  ) : (
                    <span className="frame-format-picker__shape frame-format-picker__shape--custom" />
                  )}
                </span>
                <span className="frame-format-picker__label">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="frame-format-picker__title">
          {t("labels.frame.devices.title")}
        </div>
        <div className="frame-format-picker__grid">
          {DEVICE_FRAME_PRESETS.map((preset) => {
            const isSelected = preset.id === currentFormat.id;
            const label = t(`labels.frame.formats.${preset.id}`);

            return (
              <button
                type="button"
                key={preset.id}
                className={clsx(
                  "frame-format-picker__option",
                  "frame-format-picker__option--device",
                  {
                    "frame-format-picker__option--selected": isSelected,
                  },
                )}
                title={label}
                aria-label={label}
                aria-pressed={isSelected}
                data-testid={`toolbar-frame-format-${preset.id}`}
                onClick={() => selectFormat(preset.id)}
              >
                <span className="frame-format-picker__preview">
                  <span
                    className={clsx(
                      "frame-format-picker__shape",
                      "frame-format-picker__shape--device",
                      `frame-format-picker__shape--device-${preset.chrome}`,
                    )}
                    style={{
                      aspectRatio: `${preset.width} / ${preset.height}`,
                    }}
                  >
                    {preset.chrome === "browser" && (
                      <span className="frame-format-picker__device-bar">
                        <span className="frame-format-picker__device-dot" />
                        <span className="frame-format-picker__device-dot" />
                        <span className="frame-format-picker__device-dot" />
                      </span>
                    )}
                    {preset.chrome === "phone" && (
                      <span className="frame-format-picker__device-notch" />
                    )}
                  </span>
                </span>
                <span className="frame-format-picker__label">{label}</span>
              </button>
            );
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
