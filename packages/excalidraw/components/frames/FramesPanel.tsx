import clsx from "clsx";
import { useState } from "react";

import { getFrameLikeTitle, isFrameHidden } from "@excalidraw/element";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import {
  actionDeleteSelected,
  actionMoveFrameDown,
  actionMoveFrameUp,
  actionRenameFrame,
  actionToggleFrameHidden,
  actionTogglePresentMode,
} from "../../actions";

import {
  getBoardFrames,
  getFrameContentCount,
  getFrameTitle,
} from "../../frames";
import { t } from "../../i18n";

import { useApp } from "../App";
import { useUIAppState } from "../../context/ui-appState";
import {
  collapseDownIcon,
  collapseUpIcon,
  eyeClosedIcon,
  eyeIcon,
  pencilIcon,
  presentationIcon,
  TrashIcon,
} from "../icons";

import { useSceneRevision } from "./useSceneRevision";

import "./framesPanel.scss";

import type App from "../App";

/**
 * The frames panel: every frame on the board, in the order a presentation
 * walks them.
 *
 * The panel is the board's table of contents — it names the frames, says
 * what is on them, and offers the three things one does to a slide: bring
 * it on stage, reorder it, take it off the board.
 */
export const FramesPanel = () => {
  const app = useApp() as App;
  const appState = useUIAppState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  // the panel lists the scene, so it follows the scene
  useSceneRevision();

  const elements = app.scene.getNonDeletedElements();
  const frames = getBoardFrames(elements);

  const selectFrame = (frame: ExcalidrawFrameLikeElement) => {
    app.setState({ selectedElementIds: { [frame.id]: true } });
  };

  const revealFrame = (frame: ExcalidrawFrameLikeElement) => {
    app.viewport.setViewport({ target: frame.id, fit: "contain" });
  };

  const commitName = (frame: ExcalidrawFrameLikeElement) => {
    const trimmed = nameDraft.trim();
    setEditingId(null);
    if (!trimmed || trimmed === getFrameLikeTitle(frame)) {
      return;
    }
    app.actionManager.executeAction(actionRenameFrame, "ui", {
      name: trimmed,
    });
  };

  return (
    <div className="frames-panel" data-testid="frames-panel">
      <div className="frames-panel__header">
        <h3 className="frames-panel__title">{t("labels.frame.panel")}</h3>
        <button
          type="button"
          className="frames-panel__present"
          title={t("labels.present.start")}
          aria-label={t("labels.present.start")}
          data-testid="frames-present"
          disabled={!frames.length}
          onClick={() =>
            app.actionManager.executeAction(actionTogglePresentMode, "ui")
          }
        >
          {presentationIcon}
        </button>
      </div>

      {frames.length === 0 ? (
        <div className="frames-panel__empty" data-testid="frames-panel-empty">
          <div className="frames-panel__empty-title">
            {t("labels.frame.empty")}
          </div>
          <div className="frames-panel__empty-hint">
            {t("labels.frame.emptyHint")}
          </div>
        </div>
      ) : (
        <ul className="frames-panel__list">
          {frames.map((frame, index) => {
            const title = getFrameTitle(frame);
            const count = getFrameContentCount(elements, frame);
            const isHidden = isFrameHidden(frame);
            const isEditing = editingId === frame.id;

            return (
              <li
                key={frame.id}
                className={clsx("frames-panel__item", {
                  "frames-panel__item--hidden": isHidden,
                  "frames-panel__item--selected":
                    appState.selectedElementIds[frame.id] === true,
                })}
                data-testid={`frames-panel-item-${index}`}
              >
                <button
                  type="button"
                  className="frames-panel__item-main"
                  title={title}
                  onClick={() => {
                    selectFrame(frame);
                    revealFrame(frame);
                  }}
                >
                  <span className="frames-panel__item-index">{index + 1}</span>
                  {isEditing ? (
                    <input
                      type="text"
                      className="frames-panel__item-name-input"
                      value={nameDraft}
                      autoFocus
                      aria-label={t("labels.frame.rename")}
                      data-testid="frames-panel-rename-input"
                      onChange={(event) => setNameDraft(event.target.value)}
                      onBlur={() => commitName(frame)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitName(frame);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingId(null);
                        }
                      }}
                    />
                  ) : (
                    <span className="frames-panel__item-name">{title}</span>
                  )}
                  <span className="frames-panel__item-count">
                    {count === 1
                      ? t("labels.frame.contents.one", { count })
                      : t("labels.frame.contents.other", { count })}
                  </span>
                </button>

                <div className="frames-panel__item-actions">
                  <button
                    type="button"
                    title={t("labels.frame.rename")}
                    aria-label={t("labels.frame.rename")}
                    data-testid={`frames-panel-rename-${index}`}
                    onClick={() => {
                      selectFrame(frame);
                      setEditingId(frame.id);
                      setNameDraft(title);
                    }}
                  >
                    {pencilIcon}
                  </button>
                  <button
                    type="button"
                    title={
                      isHidden ? t("labels.frame.show") : t("labels.frame.hide")
                    }
                    aria-label={
                      isHidden ? t("labels.frame.show") : t("labels.frame.hide")
                    }
                    data-testid={`frames-panel-hide-${index}`}
                    onClick={() => {
                      selectFrame(frame);
                      app.actionManager.executeAction(
                        actionToggleFrameHidden,
                        "ui",
                      );
                    }}
                  >
                    {isHidden ? eyeClosedIcon : eyeIcon}
                  </button>
                  <button
                    type="button"
                    title={t("labels.frame.moveUp")}
                    aria-label={t("labels.frame.moveUp")}
                    data-testid={`frames-panel-move-up-${index}`}
                    onClick={() => {
                      selectFrame(frame);
                      app.actionManager.executeAction(actionMoveFrameUp, "ui");
                    }}
                  >
                    {collapseUpIcon}
                  </button>
                  <button
                    type="button"
                    title={t("labels.frame.moveDown")}
                    aria-label={t("labels.frame.moveDown")}
                    data-testid={`frames-panel-move-down-${index}`}
                    onClick={() => {
                      selectFrame(frame);
                      app.actionManager.executeAction(
                        actionMoveFrameDown,
                        "ui",
                      );
                    }}
                  >
                    {collapseDownIcon}
                  </button>
                  <button
                    type="button"
                    title={t("labels.frame.delete")}
                    aria-label={t("labels.frame.delete")}
                    data-testid={`frames-panel-delete-${index}`}
                    onClick={() => {
                      selectFrame(frame);
                      app.actionManager.executeAction(
                        actionDeleteSelected,
                        "ui",
                      );
                    }}
                  >
                    {TrashIcon}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
