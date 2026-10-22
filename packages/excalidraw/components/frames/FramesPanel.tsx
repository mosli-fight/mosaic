import clsx from "clsx";
import { lazy, Suspense, useMemo, useState } from "react";
import { flushSync } from "react-dom";

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
  getFrameContentKeys,
  getFrameInView,
  getFrameTitle,
} from "../../frames";
import { t } from "../../i18n";

import { useApp } from "../App";
import { useUIAppState } from "../../context/ui-appState";
import { useAppStateValue } from "../../hooks/useAppStateValue";
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

import type { Action } from "../../actions/types";
import type App from "../App";

/**
 * The thumbnails are drawn by the canvas' own renderer, which is a good
 * deal of code for a picture the size of a stamp — so it is fetched when
 * the panel needs it, not with the editor.
 */
const FrameThumbnail = lazy(() =>
  import("./FrameThumbnail").then((module) => ({
    default: module.FrameThumbnail,
  })),
);

/**
 * The frames panel: every frame on the board, in the order a presentation
 * walks them.
 *
 * The panel is the board's table of contents — it shows what is on each
 * frame, names them, and offers the three things one does to a slide:
 * bring it on stage, reorder it, take it off the board.
 */
export const FramesPanel = () => {
  const app = useApp() as App;
  const appState = useUIAppState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  // the panel lists the scene, so it follows the scene
  useSceneRevision();

  const elements = app.scene.getNonDeletedElements();
  const frames = useMemo(() => getBoardFrames(elements), [elements]);

  // the viewport, as the panel needs to see it: where the canvas looks,
  // and how much of it there is
  const viewport = useAppStateValue([
    "scrollX",
    "scrollY",
    "zoom",
    "width",
    "height",
  ]);

  // the frame the viewport is looking at — the panel highlights it, so
  // that one can tell where on the board one is
  const frameInViewId = getFrameInView({
    frames,
    appState: viewport,
    elementsMap: app.scene.getNonDeletedElementsMap(),
  })?.id;

  // what each frame holds, fingerprinted: a thumbnail is redrawn when
  // its frame's fingerprint changes, and only then
  const contentKeys = getFrameContentKeys(frames, elements, app.imageCache);

  const selectFrame = (frame: ExcalidrawFrameLikeElement) => {
    app.setState({ selectedElementIds: { [frame.id]: true } });
  };

  /**
   * The panel's buttons act on the frame of their own row, but the actions
   * they call work on the *selected* frames — and they read the selection
   * from the app state as it is committed. React applies a state update
   * only once the click handler is done, so an action run right after a
   * `setState` would still see the selection of before the click: it would
   * act on the wrong frame, or on none at all (which is why hiding a frame
   * worked — the frame was already selected — but showing it again did
   * not: the hide had cleared the selection, and the show's own selection
   * was still pending).
   *
   * Committing the selection first keeps the button and the action in
   * agreement.
   */
  const actOnFrame = (frame: ExcalidrawFrameLikeElement, action: Action) => {
    flushSync(() => {
      app.setState({ selectedElementIds: { [frame.id]: true } });
    });
    app.actionManager.executeAction(action, "ui");
  };

  const jumpToFrame = (frame: ExcalidrawFrameLikeElement) => {
    // the frame is fitted to the space the editor chrome leaves, so that
    // it does not come to rest half behind the sidebar
    app.viewport.setViewport({
      target: frame.id,
      fit: "contain",
      offsets: { ui: true },
    });
  };

  const startRename = (frame: ExcalidrawFrameLikeElement) => {
    selectFrame(frame);
    setEditingId(frame.id);
    setNameDraft(getFrameTitle(frame));
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
                  "frames-panel__item--in-view": frameInViewId === frame.id,
                })}
                data-testid={`frames-panel-item-${index}`}
              >
                <button
                  type="button"
                  className="frames-panel__item-main"
                  title={title}
                  onClick={() => {
                    if (isEditing) {
                      return;
                    }
                    selectFrame(frame);
                    jumpToFrame(frame);
                  }}
                  onDoubleClick={() => {
                    if (isEditing) {
                      return;
                    }
                    startRename(frame);
                  }}
                >
                  <span className="frames-panel__thumbnail" aria-hidden="true">
                    <Suspense
                      fallback={
                        <span className="frames-panel__thumbnail-placeholder" />
                      }
                    >
                      <FrameThumbnail
                        frame={frame}
                        elements={elements}
                        contentKey={contentKeys.get(frame.id) ?? ""}
                        theme={appState.theme}
                        viewBackgroundColor={appState.viewBackgroundColor}
                        imageCache={app.imageCache}
                      />
                    </Suspense>
                  </span>
                  <span className="frames-panel__item-details">
                    <span className="frames-panel__item-title">
                      <span className="frames-panel__item-index">
                        {index + 1}
                      </span>
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
                    </span>
                    <span className="frames-panel__item-count">
                      {count === 1
                        ? t("labels.frame.contents.one", { count })
                        : t("labels.frame.contents.other", { count })}
                    </span>
                  </span>
                </button>

                <div className="frames-panel__item-actions">
                  <button
                    type="button"
                    title={t("labels.frame.rename")}
                    aria-label={t("labels.frame.rename")}
                    data-testid={`frames-panel-rename-${index}`}
                    onClick={() => startRename(frame)}
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
                      actOnFrame(frame, actionToggleFrameHidden);
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
                      actOnFrame(frame, actionMoveFrameUp);
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
                      actOnFrame(frame, actionMoveFrameDown);
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
                      actOnFrame(frame, actionDeleteSelected);
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
