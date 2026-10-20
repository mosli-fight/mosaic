import clsx from "clsx";
import { useMemo } from "react";

import { t } from "../../i18n";

import { useExcalidrawAppState, useExcalidrawElements } from "../App";
import { voteIcon } from "../icons";

import {
  castVote,
  clearVotingSession,
  endVotingSession,
  startVotingSession,
} from "./votingActions";
import { useFacilitationStore, useParticipantId } from "./useFacilitationStore";
import { rankSessionVotes } from "./utils";

/**
 * The voting half of the facilitation panel.
 *
 * A session is opened on the elements the facilitator has selected (or
 * on the whole board, when nothing is selected), the room votes on them
 * from the canvas, and the results are ranked here when the session
 * ends.
 */
export const VotingSection = () => {
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements();
  const { voting } = useFacilitationStore();
  const participantId = useParticipantId();

  const selectedIds = useMemo(
    () => Object.keys(appState.selectedElementIds),
    [appState.selectedElementIds],
  );

  const votableElements = useMemo(() => {
    if (selectedIds.length) {
      const selected = new Set(selectedIds);
      return elements.filter((element) => selected.has(element.id));
    }
    return elements;
  }, [elements, selectedIds]);

  const ranking = useMemo(
    () =>
      voting
        ? rankSessionVotes({ session: voting, elements, participantId })
        : [],
    [voting, elements, participantId],
  );

  const totalVotes = ranking.reduce((total, entry) => total + entry.votes, 0);
  const isFinished = !!voting && voting.endedAt != null;

  if (!voting) {
    return (
      <section
        className="facilitation-panel__section"
        data-testid="facilitation-voting-section"
      >
        <h4 className="facilitation-panel__heading">
          {voteIcon}
          {t("facilitation.voting.title")}
        </h4>

        <p className="facilitation-panel__hint">
          {selectedIds.length
            ? t("facilitation.voting.hintSelected", {
                count: selectedIds.length,
              })
            : t("facilitation.voting.hintAll", { count: elements.length })}
        </p>

        <button
          type="button"
          className="facilitation-panel__button facilitation-panel__button--primary"
          disabled={!votableElements.length}
          onClick={() =>
            startVotingSession(votableElements.map((element) => element.id))
          }
          data-testid="facilitation-voting-start"
        >
          {t("facilitation.voting.start")}
        </button>
      </section>
    );
  }

  return (
    <section
      className="facilitation-panel__section"
      data-testid="facilitation-voting-section"
    >
      <h4 className="facilitation-panel__heading">
        {voteIcon}
        {isFinished
          ? t("facilitation.voting.results")
          : t("facilitation.voting.live")}
      </h4>

      <p className="facilitation-panel__hint">
        {t("facilitation.voting.tally", {
          votes: totalVotes,
          count: voting.elementIds.length,
        })}
      </p>

      <ol
        className="facilitation-ranking"
        data-testid="facilitation-voting-ranking"
      >
        {ranking.map((entry, index) => (
          <li
            className={clsx("facilitation-ranking__item", {
              "facilitation-ranking__item--mine": entry.votedByMe,
            })}
            key={entry.elementId}
            data-testid="facilitation-voting-result"
          >
            {isFinished ? (
              <>
                <span className="facilitation-ranking__position">
                  {index + 1}
                </span>
                <span className="facilitation-ranking__label">
                  {entry.label}
                </span>
                <span className="facilitation-ranking__bar">
                  <span
                    className="facilitation-ranking__bar-fill"
                    style={{
                      width: `${
                        totalVotes ? (entry.votes / totalVotes) * 100 : 0
                      }%`,
                    }}
                  />
                </span>
                <span className="facilitation-ranking__count">
                  {entry.votes}
                </span>
              </>
            ) : (
              <button
                type="button"
                className="facilitation-ranking__button"
                title={t("facilitation.voting.voteFor", {
                  label: entry.label,
                })}
                onClick={() =>
                  castVote({
                    elementId: entry.elementId,
                    participantId,
                  })
                }
                data-testid={`facilitation-voting-vote-${entry.elementId}`}
              >
                <span className="facilitation-ranking__position">
                  {index + 1}
                </span>
                <span className="facilitation-ranking__label">
                  {entry.label}
                </span>
                <span className="facilitation-ranking__bar">
                  <span
                    className="facilitation-ranking__bar-fill"
                    style={{
                      width: `${
                        totalVotes ? (entry.votes / totalVotes) * 100 : 0
                      }%`,
                    }}
                  />
                </span>
                <span className="facilitation-ranking__count">
                  {entry.votes}
                </span>
              </button>
            )}
          </li>
        ))}
      </ol>

      {isFinished ? (
        <button
          type="button"
          className="facilitation-panel__button"
          onClick={() => clearVotingSession()}
          data-testid="facilitation-voting-close"
        >
          {t("facilitation.voting.closeResults")}
        </button>
      ) : (
        <div className="facilitation-panel__row">
          <button
            type="button"
            className="facilitation-panel__button facilitation-panel__button--primary"
            onClick={() => endVotingSession()}
            data-testid="facilitation-voting-end"
          >
            {t("facilitation.voting.end")}
          </button>
          <button
            type="button"
            className="facilitation-panel__button"
            onClick={() => clearVotingSession()}
            data-testid="facilitation-voting-cancel"
          >
            {t("facilitation.voting.cancel")}
          </button>
        </div>
      )}

      {!isFinished && (
        <p className="facilitation-panel__hint">
          {t("facilitation.voting.hintVoteOnCanvas")}
        </p>
      )}
    </section>
  );
};
