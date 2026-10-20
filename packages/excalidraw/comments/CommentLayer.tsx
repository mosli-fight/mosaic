import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";

import { t } from "../i18n";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../components/App";

import { CommentComposer, getMentionCandidates } from "./CommentComposer";
import { CommentThreadPopover } from "./CommentThreadPopover";
import {
  addCommentReply,
  addCommentThread,
  getCommentThread,
  removeCommentThread,
  setCommentThreadResolved,
} from "./commentActions";
import {
  getCommentAuthor,
  getThreadPreview,
  getThreadReplyCount,
} from "./commentUtils";

import "./comments.scss";

import type { CommentThread } from "./types";

/** how far the popovers sit from their pin */
const POPOVER_OFFSET = 14;
/** the popovers' width — used to keep them inside the canvas */
const POPOVER_WIDTH = 288;
/** the popovers' max height */
const POPOVER_MAX_HEIGHT = 320;
/** the pins' diameter */
const PIN_SIZE = 28;

/**
 * The comment overlay: the pins drawn on the canvas, plus the composer and
 * the thread popover.
 *
 * Rendered as a sibling of the canvas inside the editor container, so the
 * pins can be positioned in the canvas' own coordinate space and still be
 * interactive (the canvas itself is a plain `<canvas>`).
 */
export const CommentLayer = () => {
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();

  const {
    commentThreads,
    commentsVisible,
    showResolvedComments,
    openCommentThreadId,
  } = appState;

  const currentUser = useMemo(
    () => getCommentAuthor(appState),
    // the author only changes when the user's name does
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appState.name, appState.collaborators],
  );

  const mentionCandidates = useMemo(
    () => getMentionCandidates(appState.collaborators, currentUser),
    [appState.collaborators, currentUser],
  );

  /** scene coordinates → coordinates inside the editor container */
  const toContainerCoords = useCallback(
    (x: number, y: number) => ({
      left: (x + appState.scrollX) * appState.zoom.value,
      top: (y + appState.scrollY) * appState.zoom.value,
    }),
    [appState.scrollX, appState.scrollY, appState.zoom.value],
  );

  /**
   * Keeps a popover inside the canvas: it flips to the other side of its
   * pin when it would overflow, and is clamped to the edges.
   */
  const getPopoverStyle = useCallback(
    (x: number, y: number) => {
      const { left, top } = toContainerCoords(x, y);
      const width = appState.width;
      const height = appState.height;

      const flipX = left + POPOVER_OFFSET + POPOVER_WIDTH > width;
      const flipY = top + POPOVER_OFFSET + POPOVER_MAX_HEIGHT > height;

      return {
        left: flipX
          ? Math.max(0, left - POPOVER_OFFSET - POPOVER_WIDTH)
          : Math.min(left + POPOVER_OFFSET, Math.max(0, width - POPOVER_WIDTH)),
        top: flipY
          ? Math.max(0, top - POPOVER_OFFSET - 80)
          : Math.min(top + POPOVER_OFFSET, Math.max(0, height - 80)),
      };
    },
    [appState.height, appState.width, toContainerCoords],
  );

  const openThread = useCallback(
    (threadId: string) => {
      setAppState({
        openCommentThreadId: threadId,
        // a pin and the composer never coexist — opening a thread dismisses
        // a composer that is still open
        commentComposerAnchor: null,
      });
    },
    [setAppState],
  );

  const closeThread = useCallback(() => {
    setAppState({ openCommentThreadId: null });
  }, [setAppState]);

  const visibleThreads = useMemo(
    () =>
      commentsVisible
        ? // resolved threads are hidden from the canvas by default
          commentThreads.filter(
            (thread) => showResolvedComments || !thread.resolved,
          )
        : [],
    [commentThreads, commentsVisible, showResolvedComments],
  );

  const openThreadData = getCommentThread(commentThreads, {
    threadId: openCommentThreadId,
  });

  const composerAnchor = appState.commentComposerAnchor;
  const [composerText, setComposerText] = useState("");

  const submitComposer = useCallback(
    (text: string) => {
      if (!composerAnchor) {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      const anchor =
        composerAnchor.elementId != null
          ? ({
              type: "element",
              elementId: composerAnchor.elementId,
              x: composerAnchor.x,
              y: composerAnchor.y,
            } as const)
          : ({
              type: "point",
              x: composerAnchor.x,
              y: composerAnchor.y,
            } as const);

      const threads = addCommentThread(commentThreads, {
        anchor,
        author: currentUser,
        text: trimmed,
      });
      const created = threads[threads.length - 1];
      setAppState({
        commentThreads: threads,
        commentComposerAnchor: null,
        openCommentThreadId: created.id,
      });
    },
    [commentThreads, composerAnchor, currentUser, setAppState],
  );

  const replyToThread = useCallback(
    (threadId: string, text: string) => {
      setAppState({
        commentThreads: addCommentReply(commentThreads, {
          threadId,
          author: currentUser,
          text,
        }),
      });
    },
    [commentThreads, currentUser, setAppState],
  );

  const toggleResolved = useCallback(
    (thread: CommentThread) => {
      setAppState({
        commentThreads: setCommentThreadResolved(commentThreads, {
          threadId: thread.id,
          resolved: !thread.resolved,
        }),
      });
    },
    [commentThreads, setAppState],
  );

  const deleteThread = useCallback(
    (thread: CommentThread) => {
      setAppState({
        commentThreads: removeCommentThread(commentThreads, {
          threadId: thread.id,
        }),
        openCommentThreadId: null,
      });
    },
    [commentThreads, setAppState],
  );

  return (
    <div className="comment-layer" data-testid="comment-layer">
      {visibleThreads.map((thread) => {
        const position = toContainerCoords(thread.anchor.x, thread.anchor.y);
        const preview = getThreadPreview(thread);
        const replyCount = getThreadReplyCount(thread);
        const isOpen = openCommentThreadId === thread.id;
        return (
          <button
            key={thread.id}
            type="button"
            className={clsx("comment-pin", {
              "comment-pin--open": isOpen,
              "comment-pin--resolved": thread.resolved,
            })}
            style={
              {
                left: position.left,
                top: position.top,
                // the pin keeps a constant on-screen size, whatever the zoom;
                // it hangs above its anchor, unless there is no room for it
                "--pin-translate":
                  position.top < PIN_SIZE
                    ? "translate(-50%, 0)"
                    : "translate(-50%, -100%)",
              } as React.CSSProperties
            }
            title={preview}
            aria-label={preview || t("comment.tool")}
            data-testid="comment-pin"
            data-thread-id={thread.id}
            onClick={(event) => {
              event.stopPropagation();
              openThread(thread.id);
            }}
          >
            <span
              className="comment-pin__avatar"
              style={{ backgroundColor: thread.messages[0]?.author.color }}
              aria-hidden="true"
            >
              {(thread.messages[0]?.author.name || "?").charAt(0).toUpperCase()}
            </span>
            {replyCount > 0 && (
              <span
                className="comment-pin__badge"
                data-testid="comment-pin-badge"
              >
                {replyCount}
              </span>
            )}
          </button>
        );
      })}

      {composerAnchor && (
        <div
          className="comment-popover comment-popover--composer"
          style={getPopoverStyle(composerAnchor.x, composerAnchor.y)}
          data-testid="comment-composer"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <CommentComposer
            value={composerText}
            onChange={setComposerText}
            onSubmit={() => submitComposer(composerText)}
            onCancel={() => {
              setComposerText("");
              setAppState({ commentComposerAnchor: null });
            }}
            submitLabel={t("comment.submit")}
            placeholder={t("comment.placeholder")}
            mentionCandidates={mentionCandidates}
            autoFocus
            data-testid="comment-composer-form"
          />
        </div>
      )}

      {openThreadData && (
        <div
          className="comment-popover comment-popover--thread"
          style={getPopoverStyle(
            openThreadData.anchor.x,
            openThreadData.anchor.y,
          )}
          data-testid="comment-thread-popover"
        >
          <CommentThreadPopover
            thread={openThreadData}
            currentUser={currentUser}
            mentionCandidates={mentionCandidates}
            onReply={(text) => replyToThread(openThreadData.id, text)}
            onToggleResolve={() => toggleResolved(openThreadData)}
            onDelete={() => deleteThread(openThreadData)}
            onClose={closeThread}
            readOnly={appState.viewModeEnabled}
          />
        </div>
      )}
    </div>
  );
};
