import clsx from "clsx";
import { useEffect, useState } from "react";

import { FRAME_FILL_COLORS } from "@excalidraw/common";
import { getFrameLikeTitle, isFrameLikeElement } from "@excalidraw/element";

import type {
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import {
  actionChangeFrameFill,
  actionDeleteSelected,
  actionMoveFrameDown,
  actionMoveFrameUp,
  actionRenameFrame,
  actionSetFrameNotes,
  actionToggleElementLock,
  actionToggleFrameHidden,
} from "../../actions";

import { t } from "../../i18n";
import { getTargetElements } from "../../scene";

import { useApp } from "../App";
import {
  collapseDownIcon,
  collapseUpIcon,
  eyeClosedIcon,
  eyeIcon,
  LockedIcon,
  TrashIcon,
  UnlockedIcon,
} from "../icons";

import "./frameProperties.scss";

import type App from "../App";
import type { UIAppState } from "../../types";

/**
 * The frame's context toolbar: the controls a frame needs and a shape does
 * not — its paper color, whether it is locked, whether it is on the board at
 * all, what it is called, and what the presenter will say about it.
 *
 * The panel is the frame's *identity*; the generic shape controls (stroke
 * width, fill style, ...) are hidden for a frame, since a frame is a
 * surface rather than a shape.
 */
export const FrameProperties = ({
  appState,
  elementsMap,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
}) => {
  const app = useApp() as App;

  const frames = getTargetElements(elementsMap, appState).filter(
    isFrameLikeElement,
  );
  const frame = frames[0] ?? null;

  const [name, setName] = useState(frame ? getFrameLikeTitle(frame) : "");
  const [notes, setNotes] = useState(frame?.notes ?? "");

  // the selection can change under us (a frame is selected, then another
  // one is) — the drafts follow whatever frame is on screen, and only when
  // it is a *different* frame, so that an edit in progress is not thrown
  // away by an unrelated change to the scene
  useEffect(() => {
    setName(frame ? getFrameLikeTitle(frame) : "");
    setNotes(frame?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.id]);

  if (!frame) {
    return null;
  }

  const isLocked = frame.locked ?? false;
  const isHidden = frame.hidden === true;
  const fill = frame.backgroundColor ?? "transparent";

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed === getFrameLikeTitle(frame)) {
      return;
    }
    app.actionManager.executeAction(actionRenameFrame, "ui", {
      name: trimmed,
    });
  };

  const commitNotes = () => {
    if (notes === (frame.notes ?? "")) {
      return;
    }
    app.actionManager.executeAction(actionSetFrameNotes, "ui", { notes });
  };

  return (
    <div className="frame-properties">
      <fieldset>
        <legend>{t("labels.frame.fill")}</legend>
        <div className="frame-properties__swatches" data-testid="frame-fill">
          {FRAME_FILL_COLORS.map((color) => {
            const label = color === "transparent" ? "transparent" : color;
            return (
              <button
                key={color}
                type="button"
                className={clsx("frame-properties__swatch", {
                  active: fill === color,
                  "frame-properties__swatch--transparent":
                    color === "transparent",
                })}
                style={
                  color === "transparent"
                    ? undefined
                    : { backgroundColor: color }
                }
                title={label}
                aria-label={label}
                data-testid={`frame-fill-${color}`}
                onClick={() =>
                  app.actionManager.executeAction(actionChangeFrameFill, "ui", {
                    color,
                  })
                }
              />
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("labels.frame.rename")}</legend>
        <input
          type="text"
          className="frame-properties__name"
          value={name}
          placeholder={t("labels.frame.rename")}
          aria-label={t("labels.frame.rename")}
          data-testid="frame-name-input"
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitName();
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </fieldset>

      <fieldset>
        <legend>{t("labels.frame.notes")}</legend>
        <textarea
          className="frame-properties__notes"
          value={notes}
          rows={3}
          placeholder={t("labels.frame.notesPlaceholder")}
          aria-label={t("labels.frame.notes")}
          data-testid="frame-notes-input"
          onChange={(event) => setNotes(event.target.value)}
          onBlur={commitNotes}
        />
      </fieldset>

      <fieldset>
        <legend>{t("labels.actions")}</legend>
        <div className="buttonList">
          <button
            type="button"
            className="frame-properties__action"
            title={isLocked ? t("labels.frame.unlock") : t("labels.frame.lock")}
            aria-label={
              isLocked ? t("labels.frame.unlock") : t("labels.frame.lock")
            }
            data-testid="frame-lock"
            onClick={() =>
              app.actionManager.executeAction(actionToggleElementLock, "ui")
            }
          >
            {isLocked ? LockedIcon : UnlockedIcon}
          </button>
          <button
            type="button"
            className="frame-properties__action"
            title={isHidden ? t("labels.frame.show") : t("labels.frame.hide")}
            aria-label={
              isHidden ? t("labels.frame.show") : t("labels.frame.hide")
            }
            data-testid="frame-hide"
            onClick={() =>
              app.actionManager.executeAction(actionToggleFrameHidden, "ui")
            }
          >
            {isHidden ? eyeClosedIcon : eyeIcon}
          </button>
          <button
            type="button"
            className="frame-properties__action"
            title={t("labels.frame.moveUp")}
            aria-label={t("labels.frame.moveUp")}
            data-testid="frame-move-up"
            onClick={() =>
              app.actionManager.executeAction(actionMoveFrameUp, "ui")
            }
          >
            {collapseUpIcon}
          </button>
          <button
            type="button"
            className="frame-properties__action"
            title={t("labels.frame.moveDown")}
            aria-label={t("labels.frame.moveDown")}
            data-testid="frame-move-down"
            onClick={() =>
              app.actionManager.executeAction(actionMoveFrameDown, "ui")
            }
          >
            {collapseDownIcon}
          </button>
          <button
            type="button"
            className="frame-properties__action"
            title={t("labels.frame.delete")}
            aria-label={t("labels.frame.delete")}
            data-testid="frame-delete"
            onClick={() =>
              app.actionManager.executeAction(actionDeleteSelected, "ui")
            }
          >
            {TrashIcon}
          </button>
        </div>
      </fieldset>
    </div>
  );
};
