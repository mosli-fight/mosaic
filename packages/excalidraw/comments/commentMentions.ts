import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { CommentCandidate, CommentThread } from "./types";

/**
 * The people a comment can mention.
 *
 * The list is assembled from everything the board knows about, in the order
 * the user is most likely to want them:
 *
 * - the team or board members the host app handed over,
 * - the people in the live session,
 * - the people who already commented on this board,
 * - the people who left a note on this board.
 *
 * The first two are the real member lists. The last two are the fallback for
 * a board that is edited on its own: the people who took part in it are
 * exactly the people worth mentioning.
 */

const normalizeName = (name: string) => name.trim().toLowerCase();

export const getMentionCandidates = ({
  members,
  collaborators,
  currentUserId,
  currentUserName,
  threads,
  elements,
}: {
  /** the team or board members the host app knows about */
  members?: readonly CommentCandidate[];
  /** the people in the live session */
  collaborators?: ReadonlyMap<string, { username?: string | null }>;
  /** the id of the current user — they are never a candidate */
  currentUserId?: string | null;
  /** the name of the current user — they are never a candidate */
  currentUserName?: string | null;
  /** the threads on this board */
  threads?: readonly CommentThread[];
  /** the elements on this board */
  elements?: readonly ExcalidrawElement[];
}): CommentCandidate[] => {
  const candidates: CommentCandidate[] = [];
  const seen = new Set<string>();

  const add = (
    id: string,
    name: string | null | undefined,
    avatarUrl?: string,
  ) => {
    const trimmed = (name ?? "").trim();

    if (!trimmed) {
      return;
    }

    const key = normalizeName(trimmed);

    if (!key || seen.has(key)) {
      return;
    }

    if (
      currentUserName &&
      key === normalizeName(currentUserName) &&
      key !== "anonymous"
    ) {
      return;
    }

    seen.add(key);
    candidates.push({
      id,
      name: trimmed,
      ...(avatarUrl ? { avatarUrl } : {}),
    });
  };

  for (const member of members ?? []) {
    add(member.id, member.name, member.avatarUrl);
  }

  for (const [socketId, collaborator] of collaborators ?? []) {
    if (socketId === currentUserId || collaborator.username == null) {
      continue;
    }
    add(socketId, collaborator.username);
  }

  for (const thread of threads ?? []) {
    for (const message of thread.messages) {
      add(message.author.id, message.author.name, message.author.avatarUrl);
    }
  }

  for (const element of elements ?? []) {
    if (element.type === "stickynote" && element.author) {
      add(`sticky-note-${element.id}`, element.author);
    }
  }

  return candidates;
};
