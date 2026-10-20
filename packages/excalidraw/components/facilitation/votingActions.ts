/**
 * What can be done to the votes.
 *
 * Like the timer, the votes are session state: they live in the browser
 * and never in the editor's history.
 */

import { randomId } from "@excalidraw/common";

import { updateFacilitationStore } from "./storage";

/**
 * Opens a voting session on the given elements.
 */
export const startVotingSession = (elementIds: string[]) =>
  updateFacilitationStore((store) => ({
    ...store,
    voting: {
      id: randomId(),
      elementIds,
      votes: {},
      startedAt: Date.now(),
      endedAt: null,
    },
  }));

/**
 * Votes for an element — or takes the vote back, when the participant
 * votes for it again.
 */
export const castVote = ({
  elementId,
  participantId,
}: {
  elementId: string;
  participantId: string;
}) =>
  updateFacilitationStore((store) => {
    if (!store.voting || store.voting.endedAt != null) {
      return store;
    }

    const voters = store.voting.votes[elementId] ?? [];
    const hasVoted = voters.includes(participantId);

    const votes = {
      ...store.voting.votes,
      [elementId]: hasVoted
        ? voters.filter((id) => id !== participantId)
        : [...voters, participantId],
    };

    return {
      ...store,
      voting: { ...store.voting, votes },
    };
  });

/**
 * Ends the session: the votes are kept, and the results are final.
 */
export const endVotingSession = () =>
  updateFacilitationStore((store) => {
    if (!store.voting || store.voting.endedAt != null) {
      return store;
    }
    return {
      ...store,
      voting: { ...store.voting, endedAt: Date.now() },
    };
  });

/**
 * Throws the session (and its results) away.
 */
export const clearVotingSession = () =>
  updateFacilitationStore((store) => ({ ...store, voting: null }));

/**
 * Casts a vote on a poll.
 *
 * A participant has one vote per poll: picking another option moves it.
 */
export const castPollVote = ({
  pollId,
  optionId,
  participantId,
}: {
  pollId: string;
  optionId: string;
  participantId: string;
}) =>
  updateFacilitationStore((store) => {
    const votes = store.pollVotes[pollId] ?? {};
    const hasVoted = votes[participantId] === optionId;

    return {
      ...store,
      pollVotes: {
        ...store.pollVotes,
        [pollId]: {
          ...votes,
          [participantId]: hasVoted ? "" : optionId,
        },
      },
    };
  });

/** closes a poll, or opens it again */
export const setPollClosed = ({
  pollId,
  closed,
}: {
  pollId: string;
  closed: boolean;
}) =>
  updateFacilitationStore((store) => ({
    ...store,
    pollClosed: { ...store.pollClosed, [pollId]: closed },
  }));

/** takes every vote of a poll back */
export const resetPollVotes = (pollId: string) =>
  updateFacilitationStore((store) => ({
    ...store,
    pollVotes: { ...store.pollVotes, [pollId]: {} },
  }));

/** forgets everything about a poll that is gone from the board */
export const forgetPoll = (pollId: string) =>
  updateFacilitationStore((store) => {
    const { [pollId]: _votes, ...pollVotes } = store.pollVotes;
    const { [pollId]: _closed, ...pollClosed } = store.pollClosed;
    return { ...store, pollVotes, pollClosed };
  });
