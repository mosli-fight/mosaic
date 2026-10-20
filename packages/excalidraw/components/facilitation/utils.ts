/**
 * The pure helpers of the facilitation tools: formatting the clock,
 * counting the votes, naming the elements that are up for a vote.
 *
 * They are deliberately free of React and of the editor, so they can be
 * tested (and reasoned about) on their own.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { FacilitationTimerState, PollData, VotingSession } from "./types";

/** the timer's default duration: five minutes */
export const DEFAULT_TIMER_DURATION_MS = 5 * 60 * 1000;

/** the durations the panel offers as one-click presets */
export const TIMER_PRESETS_MS = [
  1 * 60 * 1000,
  3 * 60 * 1000,
  5 * 60 * 1000,
  10 * 60 * 1000,
  15 * 60 * 1000,
];

/**
 * Formats a duration as a clock: `mm:ss`, or `h:mm:ss` when it takes
 * more than an hour.
 */
export const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => value.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
};

/**
 * How much is left on the clock.
 *
 * A running timer is measured against the wall clock (so it keeps
 * counting while the tab is in the background); a paused one keeps what
 * it had.
 */
export const getTimerRemaining = (
  timer: FacilitationTimerState,
  now: number = Date.now(),
) => {
  if (timer.status === "running" && timer.endsAt != null) {
    return Math.max(0, timer.endsAt - now);
  }
  return Math.max(0, timer.remainingMs);
};

/** how much of the countdown is left, as a fraction between 0 and 1 */
export const getTimerProgress = (
  timer: FacilitationTimerState,
  now: number = Date.now(),
) => {
  if (!timer.durationMs) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(0, getTimerRemaining(timer, now) / timer.durationMs),
  );
};

/** a fresh, idle timer */
export const createDefaultTimer = (): FacilitationTimerState => ({
  durationMs: DEFAULT_TIMER_DURATION_MS,
  remainingMs: DEFAULT_TIMER_DURATION_MS,
  endsAt: null,
  status: "idle",
  position: null,
});

/**
 * The name of an element, for the vote list.
 *
 * A shape has no name of its own, so it gets one from its kind; a text
 * element (or a sticky note) is named by what it says.
 */
export const getElementLabel = (
  element: ExcalidrawElement,
  index: number,
): string => {
  if (
    (element.type === "text" || element.type === "stickynote") &&
    "text" in element &&
    element.text
  ) {
    const text = element.text.replace(/\s+/g, " ").trim();
    if (text) {
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
  }

  const kind = (
    {
      rectangle: "Rectangle",
      diamond: "Diamond",
      ellipse: "Ellipse",
      arrow: "Arrow",
      line: "Line",
      text: "Text",
      image: "Image",
      frame: "Frame",
      embeddable: "Embed",
      stickynote: "Sticky note",
      freedraw: "Drawing",
      selection: "Shape",
    } as Record<string, string | undefined>
  )[element.type];

  return `${kind ?? "Shape"} ${index + 1}`;
};

/** one line of the vote ranking */
export type VoteRank = {
  elementId: string;
  label: string;
  /** how many participants voted for it */
  votes: number;
  /** whether the local participant voted for it */
  votedByMe: boolean;
};

/**
 * The votes of a session, ranked.
 *
 * The order is the one the results are shown in: most votes first, and
 * ties are broken by the order the elements took part in the vote (so the
 * ranking does not shuffle around between two renders).
 */
export const rankSessionVotes = ({
  session,
  elements,
  participantId,
}: {
  session: VotingSession;
  elements: readonly ExcalidrawElement[];
  participantId: string;
}): VoteRank[] => {
  const byId = new Map(elements.map((element) => [element.id, element]));

  return session.elementIds
    .map((elementId, index) => {
      const element = byId.get(elementId);
      const voters = session.votes[elementId] ?? [];

      return {
        elementId,
        label: element
          ? getElementLabel(element, index)
          : `Element ${index + 1}`,
        votes: voters.length,
        votedByMe: voters.includes(participantId),
      };
    })
    .sort((a, b) => b.votes - a.votes);
};

/** the outcome of a poll, per option */
export type PollTally = {
  optionId: string;
  text: string;
  votes: number;
  /** the share of the votes, between 0 and 1 */
  share: number;
  /** whether the local participant picked this option */
  votedByMe: boolean;
};

/**
 * Counts the votes of a poll.
 *
 * A participant votes for exactly one option; their vote is moved rather
 * than added when they pick another one.
 */
export const tallyPollVotes = ({
  poll,
  votes,
  participantId,
}: {
  poll: PollData;
  votes: Record<string, string>;
  participantId: string;
}): { tally: PollTally[]; total: number } => {
  const counts = new Map<string, number>(
    poll.options.map((option) => [option.id, 0]),
  );

  let total = 0;

  for (const optionId of Object.values(votes)) {
    if (!counts.has(optionId)) {
      continue;
    }
    counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    total++;
  }

  const tally = poll.options.map((option) => {
    const optionVotes = counts.get(option.id) ?? 0;
    return {
      optionId: option.id,
      text: option.text,
      votes: optionVotes,
      share: total ? optionVotes / total : 0,
      votedByMe: votes[participantId] === option.id,
    };
  });

  return { tally, total };
};
