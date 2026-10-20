import { randomId } from "@excalidraw/common";

import { getStickyNoteAuthor } from "../components/sticky-note/stickyNoteAuthor";

import type { AppState } from "../types";
import type {
  CommentAnchor,
  CommentAuthor,
  CommentMessage,
  CommentThread,
} from "./types";

/**
 * Accent colors used for pins and author chips. The color is derived from
 * the author's id so the same person keeps the same color across threads
 * (and across reloads) without the host app having to assign one.
 */
export const COMMENT_AUTHOR_COLORS = [
  "#6965db",
  "#e03131",
  "#2f9e44",
  "#f08c00",
  "#0c8599",
  "#c2255c",
  "#5f3dc4",
  "#1971c2",
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getCommentAuthorColor = (id: string) =>
  COMMENT_AUTHOR_COLORS[hashString(id) % COMMENT_AUTHOR_COLORS.length];

/**
 * The person writing the comment.
 *
 * Mirrors the sticky note's author resolution: a live session knows the
 * user's name through the collaborator entry, the share dialog's name is the
 * fallback. An anonymous author is fine — the chip then shows a neutral
 * "Anonymous" label.
 */
export const getCommentAuthor = (appState: AppState): CommentAuthor => {
  for (const collaborator of appState.collaborators.values()) {
    if (collaborator.isCurrentUser) {
      const name = collaborator.username || appState.name || "";
      const id = collaborator.socketId || "current-user";
      return {
        id,
        name: name || "Anonymous",
        color: getCommentAuthorColor(id),
      };
    }
  }
  const name = getStickyNoteAuthor(appState) || "";
  const id = "current-user";
  return {
    id,
    name: name || "Anonymous",
    color: getCommentAuthorColor(id),
  };
};

/** the scene coordinates the pin of a thread is drawn at */
export const getThreadAnchorPoint = (
  thread: CommentThread,
): { x: number; y: number } => ({
  x: thread.anchor.x,
  y: thread.anchor.y,
});

export const createCommentMessage = ({
  author,
  text,
  createdAt,
}: {
  author: CommentAuthor;
  text: string;
  createdAt?: number;
}): CommentMessage => ({
  id: randomId(),
  author,
  text,
  createdAt: createdAt ?? Date.now(),
});

export const createCommentThread = ({
  anchor,
  message,
}: {
  anchor: CommentAnchor;
  message: CommentMessage;
}): CommentThread => ({
  id: randomId(),
  anchor,
  messages: [message],
  resolved: false,
  createdAt: message.createdAt,
  updatedAt: message.createdAt,
});

/** appends a message to a thread, keeping `updatedAt` in sync */
export const appendCommentMessage = (
  thread: CommentThread,
  message: CommentMessage,
): CommentThread => ({
  ...thread,
  messages: [...thread.messages, message],
  updatedAt: message.createdAt,
});

/** the text shown on the pin — the first line of the first message */
export const getThreadPreview = (thread: CommentThread): string => {
  const first = thread.messages[0];
  if (!first) {
    return "";
  }
  const line = first.text.split("\n")[0].trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
};

export const getThreadReplyCount = (thread: CommentThread): number =>
  Math.max(0, thread.messages.length - 1);

/** newest activity first — the order the comments panel lists threads in */
export const sortThreadsByActivity = (
  threads: readonly CommentThread[],
): CommentThread[] => [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A short, human readable timestamp ("3m", "2h", "Mar 4"). Deliberately
 * coarse — a comment feed is read at a glance, not audited.
 */
export const formatCommentTime = (
  timestamp: number,
  now: number = Date.now(),
): string => {
  const delta = Math.max(0, now - timestamp);
  if (delta < MINUTE) {
    return "now";
  }
  if (delta < HOUR) {
    return `${Math.floor(delta / MINUTE)}m`;
  }
  if (delta < DAY) {
    return `${Math.floor(delta / HOUR)}h`;
  }
  if (delta < 7 * DAY) {
    return `${Math.floor(delta / DAY)}d`;
  }
  const date = new Date(timestamp);
  const month = date.toLocaleString(undefined, { month: "short" });
  return `${month} ${date.getDate()}`;
};

// -----------------------------------------------------------------------------
// restoring persisted (untrusted) data
// -----------------------------------------------------------------------------

const isString = (value: unknown): value is string => typeof value === "string";

const restoreAuthor = (value: unknown): CommentAuthor | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const author = value as Partial<CommentAuthor>;
  if (!isString(author.id)) {
    return null;
  }
  return {
    id: author.id,
    name: isString(author.name) ? author.name : "Anonymous",
    avatarUrl: isString(author.avatarUrl) ? author.avatarUrl : undefined,
    color: isString(author.color) ? author.color : undefined,
  };
};

const restoreMessage = (value: unknown): CommentMessage | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const message = value as Partial<CommentMessage>;
  const author = restoreAuthor(message.author);
  if (!author || !isString(message.text) || !isString(message.id)) {
    return null;
  }
  return {
    id: message.id,
    author,
    text: message.text,
    createdAt:
      typeof message.createdAt === "number" && isFinite(message.createdAt)
        ? message.createdAt
        : Date.now(),
  };
};

const restoreAnchor = (value: unknown): CommentAnchor | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const anchor = value as Partial<CommentAnchor>;
  if (
    typeof anchor.x !== "number" ||
    typeof anchor.y !== "number" ||
    !isFinite(anchor.x) ||
    !isFinite(anchor.y)
  ) {
    return null;
  }
  if (anchor.type === "element") {
    if (!isString(anchor.elementId)) {
      return null;
    }
    return {
      type: "element",
      elementId: anchor.elementId,
      x: anchor.x,
      y: anchor.y,
    };
  }
  return { type: "point", x: anchor.x, y: anchor.y };
};

/**
 * Sanitizes comment threads coming from an untrusted source (an imported
 * file, a shared link, a board rehydrated from storage). Malformed threads
 * are dropped rather than repaired — a broken comment is not worth guessing
 * at, and a partially-restored thread would confuse the user.
 */
export const restoreCommentThreads = (value: unknown): CommentThread[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const threads: CommentThread[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const thread = entry as Partial<CommentThread>;
    const anchor = restoreAnchor(thread.anchor);
    if (!anchor || !isString(thread.id)) {
      continue;
    }
    const messages = Array.isArray(thread.messages)
      ? thread.messages
          .map(restoreMessage)
          .filter((m): m is CommentMessage => !!m)
      : [];
    if (!messages.length) {
      continue;
    }
    threads.push({
      id: thread.id,
      anchor,
      messages,
      resolved: thread.resolved === true,
      createdAt:
        typeof thread.createdAt === "number" && isFinite(thread.createdAt)
          ? thread.createdAt
          : messages[0].createdAt,
      updatedAt:
        typeof thread.updatedAt === "number" && isFinite(thread.updatedAt)
          ? thread.updatedAt
          : messages[messages.length - 1].createdAt,
    });
  }
  return threads;
};
