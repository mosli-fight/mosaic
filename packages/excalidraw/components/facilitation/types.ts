/**
 * Mosaic facilitation tools.
 *
 * The facilitation kit is the Miro-style "run a workshop" toolbox: a timer
 * for the agenda, a vote on what is on the board, and a poll the room can
 * answer. All three are *local* tools — they live in the browser, they are
 * not part of the document, and they never touch the editor's history.
 *
 * The data model lives here; the behaviour lives in `storage.ts` (the
 * browser-side store), `utils.ts` (the pure helpers) and the components
 * next door.
 */

/** the timer's lifecycle */
export type TimerStatus = "idle" | "running" | "paused" | "done";

export type FacilitationTimerState = {
  /** how long the countdown runs, in milliseconds */
  durationMs: number;
  /** how much is left when the timer is not running */
  remainingMs: number;
  /** epoch ms the countdown ends at; `null` when it is not running */
  endsAt: number | null;
  status: TimerStatus;
  /** where the widget floats, in viewport pixels; `null` = default corner */
  position: { x: number; y: number } | null;
};

/**
 * A voting session: the elements the room votes on, and who voted for
 * what.
 *
 * Votes are keyed by *participant* rather than by a plain counter, so a
 * participant can take their vote back, and so a session opened in two
 * tabs of the same browser counts as two participants.
 */
export type VotingSession = {
  id: string;
  /** the ids of the elements taking part in the vote */
  elementIds: string[];
  /** element id -> the participants that voted for it */
  votes: Record<string, string[]>;
  /** epoch ms */
  startedAt: number;
  /** epoch ms; `null` while the session is still running */
  endedAt: number | null;
};

/** one answer of a poll */
export type PollOption = {
  id: string;
  text: string;
};

/**
 * The poll's *content* — the question and its options.
 *
 * It is stored on the poll card's element (`customData`), so it is part of
 * the board: it is saved with the file and it moves with the card.
 */
export type PollData = {
  id: string;
  question: string;
  options: PollOption[];
};

/** how many options a poll may have */
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 5;

/** the key the poll's content is stored under, on the card's element */
export const POLL_CUSTOM_DATA_KEY = "mosaicPoll";

/**
 * Reads the poll content off an element, if it carries one.
 *
 * The data comes from a file (or a board), so it cannot be trusted: it is
 * validated field by field, and anything that does not fit is dropped.
 */
export const getPollData = (
  element: { customData?: Record<string, any> } | null | undefined,
): PollData | null => {
  const raw = element?.customData?.[POLL_CUSTOM_DATA_KEY];

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const { id, question, options } = raw as Partial<PollData>;

  if (typeof id !== "string" || !id) {
    return null;
  }

  if (typeof question !== "string") {
    return null;
  }

  if (!Array.isArray(options)) {
    return null;
  }

  const parsedOptions: PollOption[] = [];
  const seen = new Set<string>();

  for (const option of options) {
    if (!option || typeof option !== "object") {
      continue;
    }
    const { id: optionId, text } = option as Partial<PollOption>;
    if (typeof optionId !== "string" || !optionId || seen.has(optionId)) {
      continue;
    }
    if (typeof text !== "string") {
      continue;
    }
    seen.add(optionId);
    parsedOptions.push({ id: optionId, text });
  }

  if (parsedOptions.length < MIN_POLL_OPTIONS) {
    return null;
  }

  return {
    id,
    question,
    options: parsedOptions.slice(0, MAX_POLL_OPTIONS),
  };
};
