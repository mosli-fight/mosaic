import {
  appendCommentMessage,
  createCommentMessage,
  createCommentThread,
} from "./commentUtils";

import type {
  CommentAnchor,
  CommentAuthor,
  CommentMention,
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
    mentions,
  }: {
    anchor: CommentAnchor;
    author: CommentAuthor;
    text: string;
    mentions?: CommentMention[];
  },
): CommentThread[] => {
  const message = createCommentMessage({ author, text, mentions });
  const thread = createCommentThread({ anchor, message });
  return [...threads, thread];
};

export const addCommentReply = (
  threads: readonly CommentThread[],
  {
    threadId,
    author,
    text,
    mentions,
  }: {
    threadId: string;
    author: CommentAuthor;
    text: string;
    mentions?: CommentMention[];
  },
): CommentThread[] =>
  threads.map((thread) =>
    thread.id === threadId
      ? appendCommentMessage(
          thread,
          createCommentMessage({ author, text, mentions }),
        )
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

/**
 * Rewrites the text of a message.
 *
 * Only the author of a message may edit it — the check itself belongs to the
 * caller, which knows who the current user is; this only carries the change
 * out.
 */
export const editCommentMessage = (
  threads: readonly CommentThread[],
  {
    threadId,
    messageId,
    text,
    mentions,
    editedAt,
  }: {
    threadId: string;
    messageId: string;
    text: string;
    mentions?: CommentMention[];
    editedAt?: number;
  },
): CommentThread[] =>
  threads.map((thread) =>
    thread.id !== threadId
      ? thread
      : {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id !== messageId
              ? message
              : {
                  ...message,
                  text,
                  edited: true,
                  editedAt: editedAt ?? Date.now(),
                  ...(mentions?.length
                    ? { mentions }
                    : { mentions: undefined }),
                },
          ),
        },
  );

/**
 * Adds or removes the current user's reaction to a message.
 *
 * One reaction per emoji: reacting again with the same emoji takes the
 * reaction back, and a reaction nobody left is dropped altogether.
 */
export const toggleCommentReaction = (
  threads: readonly CommentThread[],
  {
    threadId,
    messageId,
    emoji,
    authorId,
  }: {
    threadId: string;
    messageId: string;
    emoji: string;
    authorId: string;
  },
): CommentThread[] =>
  threads.map((thread) => {
    if (thread.id !== threadId) {
      return thread;
    }

    return {
      ...thread,
      messages: thread.messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        const reactions = [...(message.reactions ?? [])];
        const index = reactions.findIndex(
          (reaction) => reaction.emoji === emoji,
        );

        if (index === -1) {
          reactions.push({ emoji, authorIds: [authorId] });
        } else {
          const reaction = reactions[index];
          const authorIds = reaction.authorIds.includes(authorId)
            ? reaction.authorIds.filter((id) => id !== authorId)
            : [...reaction.authorIds, authorId];

          if (authorIds.length) {
            reactions[index] = { ...reaction, authorIds };
          } else {
            reactions.splice(index, 1);
          }
        }

        return {
          ...message,
          ...(reactions.length ? { reactions } : { reactions: undefined }),
        };
      }),
    };
  });

/**
 * Attaches a thread to an element, so its pin follows the element around.
 *
 * The offset is the pin's distance from the element's centre; the caller
 * computes it, which keeps this function free of element geometry.
 */
export const attachCommentThread = (
  threads: readonly CommentThread[],
  {
    threadId,
    elementId,
    offsetX,
    offsetY,
  }: {
    threadId: string;
    elementId: string;
    offsetX: number;
    offsetY: number;
  },
): CommentThread[] =>
  threads.map((thread) =>
    thread.id !== threadId
      ? thread
      : {
          ...thread,
          anchor: {
            type: "element",
            elementId,
            offsetX,
            offsetY,
            x: thread.anchor.x,
            y: thread.anchor.y,
          },
        },
  );

/** detaches a thread from its element — its pin stays where it is */
export const detachCommentThread = (
  threads: readonly CommentThread[],
  { threadId }: { threadId: string },
): CommentThread[] =>
  threads.map((thread) =>
    thread.id !== threadId
      ? thread
      : {
          ...thread,
          anchor: { type: "point", x: thread.anchor.x, y: thread.anchor.y },
        },
  );
