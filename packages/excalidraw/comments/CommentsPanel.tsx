import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";

import { t } from "../i18n";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../components/App";
import { centerScrollOn } from "../viewport";

import { commentsHiddenIcon, commentsVisibleIcon } from "../components/icons";

import {
  formatCommentTime,
  getThreadPreview,
  getThreadReplyCount,
  sortThreadsByActivity,
} from "./commentUtils";

import type { CommentFilter, CommentThread } from "./types";

const FILTERS: { value: CommentFilter; label: string }[] = [
  { value: "all", label: t("comment.filterAll") },
  { value: "open", label: t("comment.filterOpen") },
  { value: "resolved", label: t("comment.filterResolved") },
];

/**
 * The comments panel — the activity feed of every thread on the canvas.
 *
 * Lists the threads newest-activity-first, lets the user filter them by
 * state, and jumps to a thread's pin when it's picked.
 */
export const CommentsPanel = () => {
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const app = useApp();

  const [filter, setFilter] = useState<CommentFilter>("all");

  const { commentThreads, showResolvedComments, commentsVisible } = appState;

  const threads = useMemo(() => {
    const filtered = commentThreads.filter((thread) => {
      if (filter === "open") {
        return !thread.resolved;
      }
      if (filter === "resolved") {
        return thread.resolved;
      }
      // "all" — the resolved threads stay hidden until they are revealed
      return showResolvedComments || !thread.resolved;
    });
    return sortThreadsByActivity(filtered);
  }, [commentThreads, filter, showResolvedComments]);

  const jumpToThread = useCallback(
    (thread: CommentThread) => {
      app.viewport.translate((state) =>
        centerScrollOn({
          scenePoint: { x: thread.anchor.x, y: thread.anchor.y },
          viewportDimensions: { width: state.width, height: state.height },
          zoom: state.zoom,
        }),
      );
      setAppState({ openCommentThreadId: thread.id });
    },
    [app, setAppState],
  );

  const toggleResolvedVisibility = useCallback(() => {
    setAppState({ showResolvedComments: !showResolvedComments });
  }, [setAppState, showResolvedComments]);

  const toggleCommentsVisibility = useCallback(() => {
    setAppState({ commentsVisible: !commentsVisible });
  }, [commentsVisible, setAppState]);

  const emptyMessage =
    filter === "open"
      ? t("comment.emptyOpen")
      : filter === "resolved"
      ? t("comment.emptyResolved")
      : t("comment.emptyAll");

  return (
    <div className="comments-panel" data-testid="comments-panel">
      <div className="comments-panel__toolbar">
        <div
          className="comments-panel__filters"
          role="tablist"
          aria-label={t("comment.panelTitle")}
        >
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={clsx("comments-panel__filter", {
                "comments-panel__filter--active": filter === value,
              })}
              data-testid={`comments-filter-${value}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="comments-panel__toolbar-actions">
          <button
            type="button"
            className="comments-panel__icon-button"
            title={
              commentsVisible ? t("comment.hideAll") : t("comment.showAll")
            }
            aria-label={
              commentsVisible ? t("comment.hideAll") : t("comment.showAll")
            }
            aria-pressed={commentsVisible}
            data-testid="comments-toggle-visibility"
            onClick={toggleCommentsVisibility}
          >
            {commentsVisible ? commentsVisibleIcon : commentsHiddenIcon}
          </button>
          <button
            type="button"
            className={clsx("comments-panel__icon-button", {
              "comments-panel__icon-button--active": showResolvedComments,
            })}
            title={
              showResolvedComments
                ? t("comment.hideResolved")
                : t("comment.showResolved")
            }
            aria-label={
              showResolvedComments
                ? t("comment.hideResolved")
                : t("comment.showResolved")
            }
            aria-pressed={showResolvedComments}
            data-testid="comments-toggle-resolved"
            onClick={toggleResolvedVisibility}
          >
            {t("comment.resolved")}
          </button>
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="comments-panel__empty" data-testid="comments-empty">
          <p className="comments-panel__empty-title">{emptyMessage}</p>
          <p className="comments-panel__empty-hint">{t("comment.emptyHint")}</p>
        </div>
      ) : (
        <div className="comments-panel__list" data-testid="comments-list">
          {threads.map((thread) => {
            const first = thread.messages[0];
            const replyCount = getThreadReplyCount(thread);
            return (
              <button
                key={thread.id}
                type="button"
                className={clsx("comments-panel__item", {
                  "comments-panel__item--resolved": thread.resolved,
                })}
                data-testid="comments-panel-item"
                data-thread-id={thread.id}
                onClick={() => jumpToThread(thread)}
              >
                <span
                  className="comments-panel__avatar"
                  style={{ backgroundColor: first?.author.color }}
                  aria-hidden="true"
                >
                  {(first?.author.name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="comments-panel__item-body">
                  <span className="comments-panel__item-header">
                    <span className="comments-panel__author">
                      {first?.author.name || t("comment.anonymous")}
                    </span>
                    <span className="comments-panel__time">
                      {first ? formatCommentTime(first.createdAt) : ""}
                    </span>
                  </span>
                  <span className="comments-panel__text">
                    {getThreadPreview(thread)}
                  </span>
                  {replyCount > 0 && (
                    <span className="comments-panel__replies">
                      {replyCount === 1
                        ? t("comment.replyCount", { count: replyCount })
                        : t("comment.replyCount_plural", { count: replyCount })}
                    </span>
                  )}
                  {thread.resolved && (
                    <span className="comments-panel__resolved-badge">
                      {t("comment.resolved")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
