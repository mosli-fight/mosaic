import clsx from "clsx";
import { useMemo } from "react";

import { t } from "../../i18n";

import { useExcalidrawAppState, useExcalidrawElements } from "../App";

import { castVote } from "./votingActions";
import { useFacilitationStore, useParticipantId } from "./useFacilitationStore";

import "./facilitation.scss";

/**
 * The vote badges.
 *
 * Every element taking part in the vote gets a badge in its corner: the
 * badge counts the votes, and clicking it votes for the element (or
 * takes the vote back).
 */
export const VotingLayer = () => {
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements();
  const { voting } = useFacilitationStore();
  const participantId = useParticipantId();

  const { scrollX, scrollY, zoom } = appState;
  const zoomValue = zoom.value;

  const targets = useMemo(() => {
    if (!voting) {
      return [];
    }

    const byId = new Map(elements.map((element) => [element.id, element]));

    return voting.elementIds
      .map((elementId) => byId.get(elementId))
      .filter((element): element is NonNullable<typeof element> => !!element);
  }, [voting, elements]);

  if (!voting) {
    return null;
  }

  const isFinished = voting.endedAt != null;

  return (
    <div
      className="facilitation-voting-layer"
      data-testid="facilitation-voting-layer"
    >
      {targets.map((element) => {
        const voters = voting.votes[element.id] ?? [];
        const votedByMe = voters.includes(participantId);

        const left = (element.x + element.width + scrollX) * zoomValue;
        const top = (element.y + scrollY) * zoomValue;

        return (
          <button
            type="button"
            key={element.id}
            className={clsx("facilitation-vote-badge", {
              "facilitation-vote-badge--voted": votedByMe,
              "facilitation-vote-badge--empty": voters.length === 0,
              "facilitation-vote-badge--finished": isFinished,
            })}
            style={{ left, top }}
            title={t("facilitation.voting.voteFor", {
              label: t("facilitation.voting.thisElement"),
            })}
            aria-label={t("facilitation.voting.voteFor", {
              label: t("facilitation.voting.thisElement"),
            })}
            disabled={isFinished}
            data-testid="facilitation-vote-badge"
            data-element-id={element.id}
            onClick={(event) => {
              event.stopPropagation();
              castVote({ elementId: element.id, participantId });
            }}
          >
            {voters.length > 0 ? voters.length : "+"}
          </button>
        );
      })}
    </div>
  );
};
