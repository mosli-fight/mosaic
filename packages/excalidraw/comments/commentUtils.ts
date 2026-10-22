import { randomId } from "@excalidraw/common";
import { isFreeDrawElement, isLinearElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getStickyNoteAuthor } from "../components/sticky-note/stickyNoteAuthor";

import type { AppState } from "../types";
import type {
  CommentAnchor,
  CommentAuthor,
  CommentCandidate,
  CommentMention,
  CommentMessage,
  CommentReaction,
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

// -----------------------------------------------------------------------------
// anchoring a thread to the canvas
// -----------------------------------------------------------------------------

/**
 * The centre of an element, in scene coordinates.
 *
 * The centre is the point an element keeps when it is turned, which makes it
 * the right reference for a comment pin: the pin keeps its place on the
 * element even after the element is rotated.
 */
export const getElementAnchorCenter = (
  element: ExcalidrawElement,
): { x: number; y: number } => {
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    // the points of a linear element are relative to its origin
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [px, py] of element.points) {
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }

    if (!isFinite(minX) || !isFinite(minY)) {
      return { x: element.x, y: element.y };
    }

    return {
      x: element.x + (minX + maxX) / 2,
      y: element.y + (minY + maxY) / 2,
    };
  }

  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
};

/** the id of the element a thread is attached to, if any */
export const getThreadElementId = (thread: CommentThread): string | null =>
  thread.anchor.type === "element" ? thread.anchor.elementId : null;

/**
 * Whether the thread's pin follows an element around the canvas.
 *
 * Threads created before comments could be attached carry no offset; their
 * pin stays where it was dropped.
 */
export const isThreadAttached = (thread: CommentThread): boolean =>
  thread.anchor.type === "element" &&
  thread.anchor.offsetX != null &&
  thread.anchor.offsetY != null;

/**
 * The scene coordinates the pin of a thread is drawn at.
 *
 * A thread attached to an element is drawn relative to the element, so the
 * pin travels with it. When the element is gone the pin falls back to the
 * position it was dropped at.
 */
export const getThreadAnchorPoint = (
  thread: CommentThread,
  element?: ExcalidrawElement | null,
): { x: number; y: number } => {
  const anchor = thread.anchor;

  if (
    anchor.type === "element" &&
    element &&
    anchor.offsetX != null &&
    anchor.offsetY != null
  ) {
    const center = getElementAnchorCenter(element);
    return {
      x: center.x + anchor.offsetX,
      y: center.y + anchor.offsetY,
    };
  }

  return { x: anchor.x, y: anchor.y };
};

// -----------------------------------------------------------------------------
// mentions
// -----------------------------------------------------------------------------

/** a piece of a comment's text — plain text, or a mention of somebody */
export type CommentTextSegment =
  | { type: "text"; text: string }
  | { type: "mention"; text: string; mention: CommentMention };

const isWordCharacter = (char: string) => !!char && /[\w@]/.test(char);

/**
 * The people mentioned in a piece of text.
 *
 * A mention is written "@Name". The name is matched against the candidates
 * the composer offers; where two names match at the same place, the longer
 * one wins, so that "@Ada Lovelace" is a mention of Ada Lovelace and not of
 * Ada. A mention only counts when it stands on its own — "@Ada!" is a
 * mention, "ada@example.com" is not.
 */
export const parseMentions = (
  text: string,
  candidates: readonly CommentCandidate[],
): CommentMention[] => {
  const lowerText = text.toLowerCase();
  const matches: {
    index: number;
    length: number;
    candidate: CommentCandidate;
  }[] = [];

  for (const candidate of candidates) {
    const needle = `@${candidate.name}`.toLowerCase();
    let index = lowerText.indexOf(needle);

    while (index !== -1) {
      const before = index === 0 ? "" : text[index - 1];
      const after = text[index + needle.length] ?? "";

      if (!isWordCharacter(before) && !isWordCharacter(after)) {
        matches.push({ index, length: needle.length, candidate });
      }

      index = lowerText.indexOf(needle, index + 1);
    }
  }

  // the longest name wins where two of them match at the same place
  matches.sort((a, b) => a.index - b.index || b.length - a.length);

  const mentions = new Map<string, CommentMention>();
  let consumedUntil = -1;

  for (const match of matches) {
    if (match.index < consumedUntil) {
      continue;
    }
    consumedUntil = match.index + match.length;
    mentions.set(match.candidate.id, {
      id: match.candidate.id,
      name: match.candidate.name,
    });
  }

  return [...mentions.values()];
};

/**
 * Splits a comment's text into plain text and mentions.
 *
 * The rendering uses this to draw a mention as a highlighted token; the text
 * itself is left untouched.
 */
export const splitTextByMentions = (
  text: string,
  mentions: readonly CommentMention[],
): CommentTextSegment[] => {
  if (!mentions.length || !text) {
    return [{ type: "text", text }];
  }

  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);

  const segments: CommentTextSegment[] = [];
  let rest = text;

  while (rest.length) {
    const lowerRest = rest.toLowerCase();
    let found: {
      index: number;
      length: number;
      mention: CommentMention;
    } | null = null;

    for (const mention of sorted) {
      const needle = `@${mention.name}`.toLowerCase();
      const index = lowerRest.indexOf(needle);

      if (index === -1) {
        continue;
      }

      if (
        !found ||
        index < found.index ||
        (index === found.index && needle.length > found.length)
      ) {
        found = { index, length: needle.length, mention };
      }
    }

    if (!found) {
      segments.push({ type: "text", text: rest });
      break;
    }

    if (found.index > 0) {
      segments.push({ type: "text", text: rest.slice(0, found.index) });
    }

    segments.push({
      type: "mention",
      text: rest.slice(found.index, found.index + found.length),
      mention: found.mention,
    });

    rest = rest.slice(found.index + found.length);
  }

  return segments;
};

/** the mentions of a message, whoever wrote it */
export const getMessageMentions = (message: CommentMessage): CommentMention[] =>
  message.mentions ?? [];

// -----------------------------------------------------------------------------
// reactions
// -----------------------------------------------------------------------------

/** how many reactions a message carries, all told */
export const getMessageReactionCount = (message: CommentMessage): number =>
  (message.reactions ?? []).reduce(
    (total, reaction) => total + reaction.authorIds.length,
    0,
  );

/** whether the given user has already reacted with this emoji */
export const hasReactedWith = (
  message: CommentMessage,
  { emoji, authorId }: { emoji: string; authorId: string },
): boolean =>
  (message.reactions ?? []).some(
    (reaction) =>
      reaction.emoji === emoji && reaction.authorIds.includes(authorId),
  );

// -----------------------------------------------------------------------------
// creating threads and messages
// -----------------------------------------------------------------------------

export const createCommentMessage = ({
  author,
  text,
  createdAt,
  mentions,
}: {
  author: CommentAuthor;
  text: string;
  createdAt?: number;
  mentions?: CommentMention[];
}): CommentMessage => ({
  id: randomId(),
  author,
  text,
  createdAt: createdAt ?? Date.now(),
  ...(mentions?.length ? { mentions } : {}),
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

const restoreMentions = (value: unknown): CommentMention[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const mentions = value
    .filter(
      (mention): mention is Partial<CommentMention> =>
        !!mention && typeof mention === "object",
    )
    .filter((mention) => isString(mention.id) && isString(mention.name))
    .map((mention) => ({ id: mention.id!, name: mention.name! }));

  return mentions.length ? mentions : undefined;
};

const restoreReactions = (value: unknown): CommentReaction[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const reactions = value
    .filter(
      (reaction): reaction is Partial<CommentReaction> =>
        !!reaction && typeof reaction === "object",
    )
    .filter((reaction) => isString(reaction.emoji))
    .map((reaction) => ({
      emoji: reaction.emoji!,
      authorIds: Array.isArray(reaction.authorIds)
        ? reaction.authorIds.filter(isString)
        : [],
    }))
    // a reaction nobody left is no reaction at all
    .filter((reaction) => reaction.authorIds.length > 0);

  return reactions.length ? reactions : undefined;
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
  const mentions = restoreMentions(message.mentions);
  const reactions = restoreReactions(message.reactions);
  return {
    id: message.id,
    author,
    text: message.text,
    createdAt:
      typeof message.createdAt === "number" && isFinite(message.createdAt)
        ? message.createdAt
        : Date.now(),
    ...(mentions ? { mentions } : {}),
    ...(reactions ? { reactions } : {}),
    ...(message.edited === true ? { edited: true } : {}),
    ...(typeof message.editedAt === "number" && isFinite(message.editedAt)
      ? { editedAt: message.editedAt }
      : {}),
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
    const hasOffset =
      typeof anchor.offsetX === "number" &&
      isFinite(anchor.offsetX) &&
      typeof anchor.offsetY === "number" &&
      isFinite(anchor.offsetY);

    return {
      type: "element",
      elementId: anchor.elementId,
      x: anchor.x,
      y: anchor.y,
      ...(hasOffset
        ? {
            offsetX: anchor.offsetX as number,
            offsetY: anchor.offsetY as number,
          }
        : {}),
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
