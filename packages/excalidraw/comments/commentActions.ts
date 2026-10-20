import {
  appendCommentMessage,
  createCommentMessage,
  createCommentThread,
} from "./commentUtils";

import type {
  CommentAnchor,
  CommentAuthor,
  CommentMessage,
  CommentThread,
} from "./types";

/**
 * The comment mutations, as pure functions over the thread list.
 *
 * Keeping them pure means the panel, the composer and the canvas layer all
 * agree on what a "reply" or a "resolve" does, and the rules are testable
 * without a canvas.
 */

export const addCommentThread = (
  threads: readonly CommentThread[],
  {
    anchor,
    author,
    text,
  }: {
    anchor: CommentAnchor;
    author: CommentAuthor;
    text: string;
  },
): CommentThread[] => {
  const message = createCommentMessage({ author, text });
  const thread = createCommentThread({ anchor, message });
  return [...threads, thread];
};

export const addCommentReply = (
  threads: readonly CommentThread[],
  {
    threadId,
    author,
    text,
  }: {
    threadId: string;
    author: CommentAuthor;
    text: string;
  },
): CommentThread[] =>
  threads.map((thread) =>
    thread.id === threadId
      ? appendCommentMessage(thread, createCommentMessage({ author, text }))
      : thread,
  );

export const setCommentThreadResolved = (
  threads: readonly CommentThread[],
  { threadId, resolved }: { threadId: string; resolved: boolean },
): CommentThread[] =>
  threads.map((thread) =>
    thread.id === threadId ? { ...thread, resolved } : thread,
  );

export const removeCommentThread = (
  threads: readonly CommentThread[],
  { threadId }: { threadId: string },
): CommentThread[] => threads.filter((thread) => thread.id !== threadId);

export const getCommentThread = (
  threads: readonly CommentThread[],
  { threadId }: { threadId: string | null },
): CommentThread | null =>
  threadId ? threads.find((thread) => thread.id === threadId) ?? null : null;

export const getThreadLastMessage = (
  thread: CommentThread,
): CommentMessage | null => thread.messages[thread.messages.length - 1] ?? null;
