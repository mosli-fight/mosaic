import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  addCommentReply,
  addCommentThread,
  removeCommentThread,
  setCommentThreadResolved,
} from "../comments/commentActions";
import { getCommentAuthor } from "../comments/commentUtils";
import { commentToolIcon } from "../components/icons";

import { register } from "./register";

import type { CommentAnchor } from "../comments/types";

/**
 * Toggles the visibility of every comment pin on the canvas (Shift+C).
 */
export const actionToggleComments = register({
  name: "toggleComments",
  label: "comment.toggleVisibility",
  icon: commentToolIcon,
  viewMode: true,
  trackEvent: { category: "comment" },
  keywords: ["comment", "hide", "show", "toggle"],
  perform(elements, appState) {
    return {
      appState: {
        commentsVisible: !appState.commentsVisible,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.commentsVisible,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.altKey &&
    event.shiftKey &&
    event.code === CODES.C,
});

/**
 * Toggles whether resolved threads are shown (on the canvas and in the
 * comments panel). Resolved threads are hidden by default.
 */
export const actionToggleResolvedComments = register({
  name: "toggleResolvedComments",
  label: "comment.toggleResolvedVisibility",
  viewMode: true,
  trackEvent: { category: "comment" },
  keywords: ["comment", "resolved", "toggle", "show", "hide"],
  perform(elements, appState) {
    return {
      appState: {
        showResolvedComments: !appState.showResolvedComments,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.showResolvedComments,
});

/**
 * Creates a thread anchored at the given position (or element).
 */
export const actionAddComment = register<{
  anchor: CommentAnchor;
  text: string;
}>({
  name: "addComment",
  label: "comment.submit",
  viewMode: true,
  trackEvent: { category: "comment" },
  perform(elements, appState, value) {
    if (!value?.text?.trim()) {
      return false;
    }
    return {
      appState: {
        commentThreads: addCommentThread(appState.commentThreads, {
          anchor: value.anchor,
          author: getCommentAuthor(appState),
          text: value.text.trim(),
        }),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

/**
 * Appends a message to an existing thread.
 */
export const actionAddCommentReply = register<{
  threadId: string;
  text: string;
}>({
  name: "addCommentReply",
  label: "comment.reply",
  viewMode: true,
  trackEvent: { category: "comment" },
  perform(elements, appState, value) {
    if (!value?.text?.trim() || !value.threadId) {
      return false;
    }
    return {
      appState: {
        commentThreads: addCommentReply(appState.commentThreads, {
          threadId: value.threadId,
          author: getCommentAuthor(appState),
          text: value.text.trim(),
        }),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

/**
 * Marks a thread as resolved (or reopens it).
 */
export const actionSetCommentResolved = register<{
  threadId: string;
  resolved: boolean;
}>({
  name: "setCommentResolved",
  label: "comment.resolve",
  viewMode: true,
  trackEvent: { category: "comment" },
  perform(elements, appState, value) {
    if (!value?.threadId) {
      return false;
    }
    return {
      appState: {
        commentThreads: setCommentThreadResolved(appState.commentThreads, {
          threadId: value.threadId,
          resolved: value.resolved,
        }),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

/**
 * Deletes a thread and everything in it.
 */
export const actionDeleteComment = register<{
  threadId: string;
}>({
  name: "deleteComment",
  label: "comment.deleteThread",
  viewMode: true,
  trackEvent: { category: "comment" },
  perform(elements, appState, value) {
    if (!value?.threadId) {
      return false;
    }
    return {
      appState: {
        commentThreads: removeCommentThread(appState.commentThreads, {
          threadId: value.threadId,
        }),
        openCommentThreadId:
          appState.openCommentThreadId === value.threadId
            ? null
            : appState.openCommentThreadId,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
