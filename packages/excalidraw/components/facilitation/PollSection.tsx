import { useMemo, useState } from "react";

import {
  actionCreatePoll,
  actionDeletePoll,
  actionUpdatePoll,
} from "../../actions";
import { t } from "../../i18n";

import { useExcalidrawActionManager, useExcalidrawElements } from "../App";
import { pollIcon } from "../icons";

import { PollForm } from "./PollForm";
import { forgetPoll, resetPollVotes, setPollClosed } from "./votingActions";
import { useFacilitationStore, useParticipantId } from "./useFacilitationStore";
import { getPollData } from "./types";
import { tallyPollVotes } from "./utils";

import "./facilitation.scss";

import type { PollData } from "./types";

/**
 * The poll half of the facilitation panel.
 *
 * A poll is a card on the board: the panel creates it, lists the polls
 * that are on the board, and lets the facilitator close, reset or delete
 * them.
 */
export const PollSection = () => {
  const app = useExcalidrawActionManager();
  const elements = useExcalidrawElements();
  const { pollVotes, pollClosed } = useFacilitationStore();
  const participantId = useParticipantId();

  /** the poll being created (`isCreating`) or edited */
  const [editing, setEditing] = useState<{
    elementId: string | null;
    poll: PollData | null;
  } | null>(null);

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
          ): entry is { element: typeof elements[number]; poll: PollData } =>
            !!entry,
        ),
    [elements],
  );

  /**
   * Creates a poll, or rewrites one that is already on the board.
   */
  const submitPoll = (question: string, options: string[]) => {
    if (editing?.elementId) {
      app.executeAction(actionUpdatePoll, "ui", {
        elementId: editing.elementId,
        question,
        options,
      });
    } else {
      app.executeAction(actionCreatePoll, "ui", {
        question,
        options,
      });
    }

    setEditing(null);
  };

  return (
    <section
      className="facilitation-panel__section"
      data-testid="facilitation-poll-section"
    >
      <h4 className="facilitation-panel__heading">
        {pollIcon}
        {t("facilitation.poll.title")}
      </h4>

      {editing ? (
        <PollForm
          poll={editing.poll}
          onSubmit={submitPoll}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          className="facilitation-panel__button facilitation-panel__button--primary"
          onClick={() => setEditing({ elementId: null, poll: null })}
          data-testid="facilitation-poll-new"
        >
          {t("facilitation.poll.new")}
        </button>
      )}

      {polls.length > 0 && (
        <ul
          className="facilitation-poll-list"
          data-testid="facilitation-poll-list"
        >
          {polls.map(({ element, poll }) => {
            const { tally, total } = tallyPollVotes({
              poll,
              votes: pollVotes[poll.id] ?? {},
              participantId,
            });
            const isClosed = !!pollClosed[poll.id];

            return (
              <li
                className="facilitation-poll-list__item"
                key={poll.id}
                data-testid="facilitation-poll-item"
              >
                <div className="facilitation-poll-list__head">
                  <span className="facilitation-poll-list__question">
                    {poll.question}
                  </span>
                  {isClosed && (
                    <span className="facilitation-poll-list__badge">
                      {t("facilitation.poll.closed")}
                    </span>
                  )}
                </div>

                <p className="facilitation-panel__hint">
                  {t("facilitation.poll.tally", { votes: total })}
                </p>

                <ul className="facilitation-poll-list__options">
                  {tally.map((option) => (
                    <li
                      key={option.optionId}
                      className="facilitation-poll-list__option"
                    >
                      <span className="facilitation-poll-list__option-label">
                        {option.text}
                      </span>
                      <span className="facilitation-poll-list__option-bar">
                        <span
                          className="facilitation-poll-list__option-fill"
                          style={{ width: `${option.share * 100}%` }}
                        />
                      </span>
                      <span className="facilitation-poll-list__option-count">
                        {Math.round(option.share * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="facilitation-panel__row">
                  <button
                    type="button"
                    className="facilitation-panel__link"
                    onClick={() => setEditing({ elementId: element.id, poll })}
                    data-testid="facilitation-poll-edit"
                  >
                    {t("facilitation.poll.edit")}
                  </button>
                  <button
                    type="button"
                    className="facilitation-panel__link"
                    onClick={() =>
                      setPollClosed({ pollId: poll.id, closed: !isClosed })
                    }
                    data-testid="facilitation-poll-toggle-closed"
                  >
                    {isClosed
                      ? t("facilitation.poll.reopen")
                      : t("facilitation.poll.close")}
                  </button>
                  <button
                    type="button"
                    className="facilitation-panel__link"
                    onClick={() => resetPollVotes(poll.id)}
                    data-testid="facilitation-poll-reset"
                  >
                    {t("facilitation.poll.resetVotes")}
                  </button>
                  <button
                    type="button"
                    className="facilitation-panel__link facilitation-panel__link--danger"
                    onClick={() => {
                      forgetPoll(poll.id);
                      app.executeAction(actionDeletePoll, "ui", {
                        elementId: element.id,
                      });
                    }}
                    data-testid="facilitation-poll-delete"
                  >
                    {t("facilitation.poll.delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
