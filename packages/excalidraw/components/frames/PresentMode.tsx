import { useCallback, useEffect, useState } from "react";

import {
  actionPresentNextFrame,
  actionPresentPreviousFrame,
  actionTogglePresentMode,
} from "../../actions";

import {
  getPresentableFrameIndex,
  getPresentableFrames,
  getFrameTitle,
} from "../../frames";
import { t } from "../../i18n";

import { useApp } from "../App";
import { useUIAppState } from "../../context/ui-appState";
import { chevronLeftIcon, chevronRight } from "../icons";

import { useSceneRevision } from "./useSceneRevision";

import "./presentMode.scss";

import type App from "../App";

/**
 * Present mode: the board as a show.
 *
 * The canvas itself is the stage — the frame is fitted to the screen by the
 * viewport, so what the audience sees is the frame and what is on it. This
 * component is the chrome around it: where you are in the show, how you
 * move through it, and the notes the presenter reads from.
 */
export const PresentMode = () => {
  const app = useApp() as App;
  const appState = useUIAppState();
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  useSceneRevision();

  const frames = getPresentableFrames(app.scene.getNonDeletedElements());
  const index = getPresentableFrameIndex(
    frames,
    appState.presentMode.currentFrameId,
  );
  const frame = index === -1 ? null : frames[index];
  const notes = frame?.notes ?? "";

  const goNext = useCallback(() => {
    app.actionManager.executeAction(actionPresentNextFrame, "ui");
  }, [app]);

  const goPrevious = useCallback(() => {
    app.actionManager.executeAction(actionPresentPreviousFrame, "ui");
  }, [app]);

  const exit = useCallback(() => {
    app.actionManager.executeAction(actionTogglePresentMode, "ui");
  }, [app]);

  // the show is driven from the keyboard: the arrow keys walk the frames,
  // escape leaves the stage
  useEffect(() => {
    if (!appState.presentMode.active) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [appState.presentMode.active, goNext, goPrevious, exit]);

  if (!appState.presentMode.active) {
    return null;
  }

  return (
    <div className="present-mode" data-testid="present-mode">
      <div className="present-mode__bar" data-viewport-ui="top">
        <div className="present-mode__title">
          <span
            className="present-mode__frame-name"
            data-testid="present-frame-title"
          >
            {frame ? getFrameTitle(frame) : t("labels.present.noFrames")}
          </span>
          <span className="present-mode__counter" data-testid="present-counter">
            {t("labels.present.frame", {
              current: index === -1 ? 0 : index + 1,
              total: frames.length,
            })}
          </span>
        </div>

        <div className="present-mode__actions">
          {notes && (
            <button
              type="button"
              className="present-mode__notes-toggle"
              title={t("labels.present.notes")}
              aria-label={t("labels.present.notes")}
              aria-pressed={isNotesOpen}
              data-testid="present-notes-toggle"
              onClick={() => setIsNotesOpen((open) => !open)}
            >
              {t("labels.present.notes")}
            </button>
          )}
          <button
            type="button"
            className="present-mode__exit"
            title={t("labels.present.exit")}
            aria-label={t("labels.present.exit")}
            data-testid="present-exit"
            onClick={exit}
          >
            {t("labels.present.exit")}
          </button>
        </div>
      </div>

      {isNotesOpen && notes && (
        <div className="present-mode__notes" data-testid="present-notes">
          {notes}
        </div>
      )}

      <button
        type="button"
        className="present-mode__nav present-mode__nav--previous"
        title={t("labels.present.previous")}
        aria-label={t("labels.present.previous")}
        data-testid="present-previous"
        onClick={goPrevious}
      >
        {chevronLeftIcon}
      </button>

      <button
        type="button"
        className="present-mode__nav present-mode__nav--next"
        title={t("labels.present.next")}
        aria-label={t("labels.present.next")}
        data-testid="present-next"
        onClick={goNext}
      >
        {chevronRight}
      </button>
    </div>
  );
};
