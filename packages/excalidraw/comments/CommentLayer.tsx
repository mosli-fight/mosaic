import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import {
  useApp,
  useAppProps,
  useExcalidrawAppState,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "../components/App";

import { commentAttachIcon } from "../components/icons";

import { CommentComposer } from "./CommentComposer";
import { CommentThreadPopover } from "./CommentThreadPopover";
import {
  addCommentReply,
  addCommentThread,
  attachCommentThread,
  detachCommentThread,
  editCommentMessage,
  getCommentThread,
  removeCommentThread,
  setCommentThreadResolved,
  toggleCommentReaction,
} from "./commentActions";
import { getMentionCandidates } from "./commentMentions";
import {
  getCommentAuthor,
  getElementAnchorCenter,
  getThreadAnchorPoint,
  getThreadPreview,
  getThreadReplyCount,
  isThreadAttached,
  parseMentions,
} from "./commentUtils";

import "./comments.scss";

import type {
  CommentAnchor,
  CommentComposerAnchor,
  CommentMention,
  CommentThread,
} from "./types";

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
  const app = useApp();
  const appProps = useAppProps();
  const elements = useExcalidrawElements();

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

  /**
   * The elements of the scene, by id.
   *
   * A comment can be attached to an element, and its pin then follows the
   * element around — which means the pin has to be placed again every time
   * the element moves.
   */
  const elementsMap = useMemo(() => {
    const map = new Map<string, ExcalidrawElement>();
    for (const element of elements) {
      map.set(element.id, element);
    }
    return map;
  }, [elements]);

  const mentionCandidates = useMemo(
    () =>
      getMentionCandidates({
        members: appProps.commentMembers,
        collaborators: appState.collaborators,
        currentUserId: currentUser.id,
        currentUserName: currentUser.name,
        threads: commentThreads,
        elements,
      }),
    [
      appProps.commentMembers,
      appState.collaborators,
      commentThreads,
      currentUser,
      elements,
    ],
  );

  /** scene coordinates → coordinates inside the editor container */
  const toContainerCoords = useCallback(
    (x: number, y: number) => ({
      left: (x + appState.scrollX) * appState.zoom.value,
      top: (y + appState.scrollY) * appState.zoom.value,
    }),
    [appState.scrollX, appState.scrollY, appState.zoom.value],
  );

  /** where the pin of a thread sits, following the element it is on */
  const getThreadPosition = useCallback(
    (thread: CommentThread) => {
      const element =
        thread.anchor.type === "element"
          ? elementsMap.get(thread.anchor.elementId) ?? null
          : null;
      return getThreadAnchorPoint(thread, element);
    },
    [elementsMap],
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

  /**
   * The text of the open composer, together with the anchor it was typed for.
   *
   * `CommentLayer` never unmounts, so a plain `useState` for the text would
   * outlive the composer: the comment that was just posted (or cancelled)
   * would still be in the box the next time a pin opens one. Every pin arms a
   * fresh anchor object, so comparing the anchor by identity tells us when a
   * different composer is opening and its draft has to start empty.
   */
  const [composerDraft, setComposerDraft] = useState<{
    anchor: CommentComposerAnchor | null;
    text: string;
    /**
     * bumped whenever a different composer opens — the composer is keyed by
     * it, so its own state (the mention and emoji popups) starts fresh too
     */
    generation: number;
  }>({ anchor: null, text: "", generation: 0 });

  if (composerDraft.anchor !== composerAnchor) {
    // a different pin opened a composer — it starts empty
    setComposerDraft({
      anchor: composerAnchor,
      text: "",
      generation: composerDraft.generation + 1,
    });
  }

  const submitComposer = useCallback(
    (text: string) => {
      if (!composerAnchor) {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const element = composerAnchor.elementId
        ? elementsMap.get(composerAnchor.elementId) ?? null
        : null;

      let anchor: CommentAnchor;
      if (element) {
        // the pin is placed relative to the element, so that it follows it
        const center = getElementAnchorCenter(element);
        anchor = {
          type: "element",
          elementId: element.id,
          offsetX: composerAnchor.x - center.x,
          offsetY: composerAnchor.y - center.y,
          x: composerAnchor.x,
          y: composerAnchor.y,
        };
      } else {
        anchor = {
          type: "point",
          x: composerAnchor.x,
          y: composerAnchor.y,
        };
      }

      const threads = addCommentThread(commentThreads, {
        anchor,
        author: currentUser,
        text: trimmed,
        mentions: parseMentions(trimmed, mentionCandidates),
      });
      const created = threads[threads.length - 1];
      setAppState({
        commentThreads: threads,
        commentComposerAnchor: null,
        openCommentThreadId: created.id,
      });
    },
    [
      commentThreads,
      composerAnchor,
      currentUser,
      elementsMap,
      mentionCandidates,
      setAppState,
    ],
  );

  const replyToThread = useCallback(
    (threadId: string, text: string, mentions: CommentMention[]) => {
      setAppState({
        commentThreads: addCommentReply(commentThreads, {
          threadId,
          author: currentUser,
          text,
          mentions,
        }),
      });
    },
    [commentThreads, currentUser, setAppState],
  );

  const editMessage = useCallback(
    (
      threadId: string,
      messageId: string,
      text: string,
      mentions: CommentMention[],
    ) => {
      setAppState({
        commentThreads: editCommentMessage(commentThreads, {
          threadId,
          messageId,
          text,
          mentions,
        }),
      });
    },
    [commentThreads, setAppState],
  );

  const toggleReaction = useCallback(
    (threadId: string, messageId: string, emoji: string) => {
      setAppState({
        commentThreads: toggleCommentReaction(commentThreads, {
          threadId,
          messageId,
          emoji,
          authorId: currentUser.id,
        }),
      });
    },
    [commentThreads, currentUser.id, setAppState],
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

  /**
   * Attaches a thread to the element under its pin, or detaches it again.
   *
   * A comment dropped on an element is attached to it from the start; this
   * is for the comment that was dropped on empty canvas and later wants to
   * belong to a shape.
   */
  const toggleAttachment = useCallback(
    (thread: CommentThread) => {
      if (isThreadAttached(thread)) {
        setAppState({
          commentThreads: detachCommentThread(commentThreads, {
            threadId: thread.id,
          }),
        });
        return;
      }

      const element = app.getElementAtPosition(
        thread.anchor.x,
        thread.anchor.y,
      );

      if (!element) {
        return;
      }

      const center = getElementAnchorCenter(element);

      setAppState({
        commentThreads: attachCommentThread(commentThreads, {
          threadId: thread.id,
          elementId: element.id,
          offsetX: thread.anchor.x - center.x,
          offsetY: thread.anchor.y - center.y,
        }),
      });
    },
    [app, commentThreads, setAppState],
  );

  return (
    <div className="comment-layer" data-testid="comment-layer">
      {visibleThreads.map((thread) => {
        const anchorPoint = getThreadPosition(thread);
        const position = toContainerCoords(anchorPoint.x, anchorPoint.y);
        const preview = getThreadPreview(thread);
        const replyCount = getThreadReplyCount(thread);
        const isOpen = openCommentThreadId === thread.id;
        const isAttached = isThreadAttached(thread);
        return (
          <button
            key={thread.id}
            type="button"
            className={clsx("comment-pin", {
              "comment-pin--open": isOpen,
              "comment-pin--resolved": thread.resolved,
              "comment-pin--attached": isAttached,
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
            data-attached={isAttached ? "true" : "false"}
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
            {isAttached && (
              <span
                className="comment-pin__attached"
                title={t("comment.attachedToElement")}
                aria-label={t("comment.attachedToElement")}
                data-testid="comment-pin-attached"
              >
                {commentAttachIcon}
              </span>
            )}
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
            // a different pin re-mounts the composer, so its own state — the
            // mention and emoji popups — does not outlive the comment either
            key={composerDraft.generation}
            value={composerDraft.text}
            onChange={(text) =>
              setComposerDraft((draft) => ({ ...draft, text }))
            }
            onSubmit={() => submitComposer(composerDraft.text)}
            onCancel={() => {
              setComposerDraft((draft) => ({ ...draft, text: "" }));
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
            getThreadPosition(openThreadData).x,
            getThreadPosition(openThreadData).y,
          )}
          data-testid="comment-thread-popover"
        >
          <CommentThreadPopover
            // the popover owns the reply draft; keying it by thread makes
            // switching threads start a fresh reply box instead of carrying
            // the previous thread's half-written reply over
            key={openThreadData.id}
            thread={openThreadData}
            currentUser={currentUser}
            mentionCandidates={mentionCandidates}
            onReply={(text, mentions) =>
              replyToThread(openThreadData.id, text, mentions)
            }
            onEditMessage={(messageId, text, mentions) =>
              editMessage(openThreadData.id, messageId, text, mentions)
            }
            onToggleReaction={(messageId, emoji) =>
              toggleReaction(openThreadData.id, messageId, emoji)
            }
            onToggleResolve={() => toggleResolved(openThreadData)}
            onToggleAttachment={() => toggleAttachment(openThreadData)}
            attached={isThreadAttached(openThreadData)}
            onDelete={() => deleteThread(openThreadData)}
            onClose={closeThread}
            readOnly={appState.viewModeEnabled}
          />
        </div>
      )}
    </div>
  );
};
