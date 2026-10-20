import { PollLayer } from "./PollLayer";
import { VotingLayer } from "./VotingLayer";

/**
 * The facilitation layer: everything the facilitation tools draw on the
 * canvas — the vote badges and the poll cards.
 *
 * It is rendered next to the canvas, inside the editor's container, so
 * it can be positioned in the canvas' own coordinate space.
 */
export const FacilitationLayer = () => {
  return (
    <div className="facilitation-layer" data-testid="facilitation-layer">
      <VotingLayer />
      <PollLayer />
    </div>
  );
};
