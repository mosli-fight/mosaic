import clsx from "clsx";
import { useMemo } from "react";

import { actionDeletePoll } from "../../actions";
import { t } from "../../i18n";

import {
  useExcalidrawActionManager,
  useExcalidrawAppState,
  useExcalidrawElements,
} from "../App";

import {
  forgetPoll,
  castPollVote,
  resetPollVotes,
  setPollClosed,
} from "./votingActions";
import { useFacilitationStore, useParticipantId } from "./useFacilitationStore";
import { getPollData } from "./types";
import { tallyPollVotes } from "./utils";

import "./facilitation.scss";

/**
 * The poll cards.
 *
 * A poll is a card on the board: the rectangle that holds it is a real
 * element (it moves with the board, it is saved with the file), and this
 * layer draws its content — the question, the options and the live
 * percentages — on top of it.
 */
export const PollLayer = () => {
  const app = useExcalidrawActionManager();
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements();
  const { pollVotes, pollClosed } = useFacilitationStore();
  const participantId = useParticipantId();

  const { scrollX, scrollY, zoom } = appState;
  const zoomValue = zoom.value;

  const polls = useMemo(
    () =>
      elements
        .map((element) => {
          const poll = getPollData(element);
          return poll ? { element, poll } : null;
        })
        .filter(
          (
            entry,
          ): entry is {
            element: typeof elements[number];
            poll: NonNullable<ReturnType<typeof getPollData>>;
          } => !!entry,
        ),
    [elements],
  );

  if (!polls.length) {
    return null;
  }

  return (
    <div
      className="facilitation-poll-layer"
      data-testid="facilitation-poll-layer"
    >
      {polls.map(({ element, poll }) => {
        const isClosed = !!pollClosed[poll.id];
        const isSelected = !!appState.selectedElementIds[element.id];

        const { tally, total } = tallyPollVotes({
          poll,
          votes: pollVotes[poll.id] ?? {},
          participantId,
        });

        const left = (element.x + scrollX) * zoomValue;
        const top = (element.y + scrollY) * zoomValue;

        return (
          <div
            key={poll.id}
            className={clsx("facilitation-poll-card", {
              "facilitation-poll-card--closed": isClosed,
            })}
            style={{
              left,
              top,
              width: element.width,
              height: element.height,
              transform: `scale(${zoomValue})`,
            }}
            data-testid="facilitation-poll-card"
            data-poll-id={poll.id}
            onKeyDown={(event) => {
              // the widget has the focus: the editor must not steal the
              // keys — Enter would start editing the card's shape, and
              // Space would pan the board instead of casting the vote
              event.stopPropagation();
            }}
          >
            <div className="facilitation-poll-card__question">
              {poll.question}
            </div>

            <div className="facilitation-poll-card__options">
              {tally.map((option) => (
                <button
                  type="button"
                  key={option.optionId}
                  className={clsx("facilitation-poll-card__option", {
                    "facilitation-poll-card__option--mine": option.votedByMe,
                    "facilitation-poll-card__option--closed": isClosed,
                  })}
                  title={
                    isClosed
                      ? t("facilitation.poll.closed")
                      : t("facilitation.poll.voteFor", { label: option.text })
                  }
                  disabled={isClosed}
                  data-testid="facilitation-poll-option"
                  data-option-id={option.optionId}
                  onClick={(event) => {
                    event.stopPropagation();
                    castPollVote({
                      pollId: poll.id,
                      optionId: option.optionId,
                      participantId,
                    });
                  }}
                >
                  <span className="facilitation-poll-card__option-bar">
                    <span
                      className="facilitation-poll-card__option-fill"
                      style={{ width: `${option.share * 100}%` }}
                    />
                  </span>
                  <span className="facilitation-poll-card__option-label">
                    {option.text}
                  </span>
                  <span className="facilitation-poll-card__option-share">
                    {Math.round(option.share * 100)}%
                  </span>
                </button>
              ))}
            </div>

            <div className="facilitation-poll-card__footer">
              <span className="facilitation-poll-card__tally">
                {t("facilitation.poll.tally", { votes: total })}
              </span>

              {isSelected && (
                <span className="facilitation-poll-card__actions">
                  <button
                    type="button"
                    className="facilitation-poll-card__action"
                    title={t("facilitation.poll.close")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPollClosed({ pollId: poll.id, closed: true });
                    }}
                    data-testid="facilitation-poll-close"
                  >
                    {t("facilitation.poll.close")}
                  </button>
                  <button
                    type="button"
                    className="facilitation-poll-card__action"
                    title={t("facilitation.poll.resetVotes")}
                    onClick={(event) => {
                      event.stopPropagation();
                      resetPollVotes(poll.id);
                    }}
                    data-testid="facilitation-poll-reset"
                  >
                    {t("facilitation.poll.resetVotes")}
                  </button>
                  <button
                    type="button"
                    className="facilitation-poll-card__action facilitation-poll-card__action--danger"
                    title={t("facilitation.poll.delete")}
                    onClick={(event) => {
                      event.stopPropagation();
                      forgetPoll(poll.id);
                      app.executeAction(actionDeletePoll, "ui", {
                        elementId: element.id,
                      });
                    }}
                    data-testid="facilitation-poll-delete"
                  >
                    {t("facilitation.poll.delete")}
                  </button>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
