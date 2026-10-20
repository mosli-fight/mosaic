/**
 * The browser-side store behind the facilitation tools.
 *
 * Everything the facilitator does — the countdown, the votes, the poll
 * results — is *session* state: it belongs to the room, not to the
 * document, and it must never end up in the editor's history (undoing a
 * vote would be nonsense).
 *
 * So it lives in `localStorage`, in one small document, and it is shared
 * by every tab of the same browser. Each tab counts as one participant:
 * the participant id lives in `sessionStorage`, which is per tab, while
 * the votes themselves live in `localStorage`, which is shared. Opening
 * the board in two tabs is therefore enough to see a real vote count.
 */

import { randomId } from "@excalidraw/common";

import type { FacilitationTimerState, VotingSession } from "./types";

/** the key the facilitation document is stored under */
const STORE_KEY = "mosaic-facilitation-store";

/** the key the participant id is stored under (per tab) */
const PARTICIPANT_KEY = "mosaic-facilitation-participant";

export type FacilitationStore = {
  version: 1;
  /** the countdown, or `null` when the timer widget is closed */
  timer: FacilitationTimerState | null;
  /** the running (or finished) voting session */
  voting: VotingSession | null;
  /** poll id -> participant id -> the option they picked */
  pollVotes: Record<string, Record<string, string>>;
  /** poll id -> whether the poll is closed */
  pollClosed: Record<string, boolean>;
};

const EMPTY_STORE: FacilitationStore = {
  version: 1,
  timer: null,
  voting: null,
  pollVotes: {},
  pollClosed: {},
};

/** the listeners notified whenever the store changes */
const listeners = new Set<() => void>();

/**
 * The store as it is right now.
 *
 * It is cached so that the value handed to React stays referentially
 * stable between changes — otherwise every consumer would re-render on
 * every tick of the clock.
 */
let cachedStore: FacilitationStore = EMPTY_STORE;

/** the id of the participant using this tab */
let cachedParticipantId: string | null = null;

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Reads the stored document, repairing whatever is broken in it.
 *
 * The document is written by us, but it can be edited by hand, or left
 * behind by an older version of the editor, so nothing in it is trusted.
 */
const readStore = (): FacilitationStore => {
  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(STORE_KEY);
  } catch (error) {
    console.warn(`facilitation: localStorage.getItem error: ${error}`);
    return EMPTY_STORE;
  }

  if (!raw) {
    return EMPTY_STORE;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`facilitation: could not parse the stored document`);
    return EMPTY_STORE;
  }

  if (!isPlainObject(parsed)) {
    return EMPTY_STORE;
  }

  const timer = parsed.timer;
  const voting = parsed.voting;

  return {
    version: 1,
    timer: isPlainObject(timer)
      ? {
          durationMs: Number(timer.durationMs) || 0,
          remainingMs: Number(timer.remainingMs) || 0,
          endsAt: typeof timer.endsAt === "number" ? timer.endsAt : null,
          status: (["idle", "running", "paused", "done"] as const).includes(
            timer.status,
          )
            ? timer.status
            : "idle",
          position:
            isPlainObject(timer.position) &&
            typeof timer.position.x === "number" &&
            typeof timer.position.y === "number"
              ? { x: timer.position.x, y: timer.position.y }
              : null,
        }
      : null,
    voting: isPlainObject(voting)
      ? {
          id: String(voting.id ?? randomId()),
          elementIds: Array.isArray(voting.elementIds)
            ? voting.elementIds.filter(
                (id): id is string => typeof id === "string",
              )
            : [],
          votes: isPlainObject(voting.votes)
            ? (voting.votes as Record<string, string[]>)
            : {},
          startedAt: Number(voting.startedAt) || 0,
          endedAt: typeof voting.endedAt === "number" ? voting.endedAt : null,
        }
      : null,
    pollVotes: isPlainObject(parsed.pollVotes)
      ? (parsed.pollVotes as Record<string, Record<string, string>>)
      : {},
    pollClosed: isPlainObject(parsed.pollClosed)
      ? (parsed.pollClosed as Record<string, boolean>)
      : {},
  };
};

/** writes the document out and tells the listeners about it */
const writeStore = (store: FacilitationStore) => {
  cachedStore = store;

  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn(`facilitation: localStorage.setItem error: ${error}`);
  }

  listeners.forEach((listener) => listener());
};

/**
 * The facilitation document, as it is right now.
 */
export const getFacilitationStore = (): FacilitationStore => {
  return cachedStore;
};

/**
 * Updates the document.
 *
 * The update is given the current document and returns the next one; the
 * document is written back as a whole, so a change in one tab never
 * clobbers an unrelated change in another (the tabs are merged by
 * re-reading before writing).
 */
export const updateFacilitationStore = (
  update: (store: FacilitationStore) => FacilitationStore,
) => {
  // re-read before writing: another tab may have changed the document
  // since we last saw it
  const current = readStore();
  cachedStore = current;
  writeStore(update(current));
};

/** subscribes to the document's changes; returns the unsubscribe function */
export const subscribeToFacilitationStore = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Forgets everything: the timer, the votes and the poll results.
 *
 * It is what happens when the board is cleared — the facilitation tools
 * belong to a session, not to a board.
 */
export const resetFacilitationStore = () => {
  cachedStore = EMPTY_STORE;

  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch (error) {
    console.warn(`facilitation: localStorage.removeItem error: ${error}`);
  }

  listeners.forEach((listener) => listener());
};

/**
 * The id of the participant using this tab.
 *
 * It is kept in `sessionStorage`, so every tab of the browser is its own
 * participant — which is what makes the votes add up.
 */
export const getParticipantId = (): string => {
  if (cachedParticipantId) {
    return cachedParticipantId;
  }

  try {
    const stored = window.sessionStorage.getItem(PARTICIPANT_KEY);
    if (stored) {
      cachedParticipantId = stored;
      return stored;
    }
    const id = randomId();
    window.sessionStorage.setItem(PARTICIPANT_KEY, id);
    cachedParticipantId = id;
    return id;
  } catch (error) {
    // no session storage (private mode, embedded frame): fall back to a
    // per-session id that lives as long as the tab does
    if (!cachedParticipantId) {
      cachedParticipantId = randomId();
    }
    return cachedParticipantId;
  }
};

/**
 * Watches for changes made in *other* tabs of the same browser.
 *
 * The `storage` event only fires in the tabs that did not make the
 * change, so the tab that wrote the document updates itself directly.
 */
export const watchFacilitationStore = () => {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORE_KEY) {
      return;
    }
    cachedStore = readStore();
    listeners.forEach((listener) => listener());
  };

  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("storage", onStorage);
  };
};

// read the document once, so the first render already has it
cachedStore = readStore();
