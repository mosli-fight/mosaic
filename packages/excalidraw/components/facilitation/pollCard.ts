/**
 * The layout of a poll card.
 *
 * A poll is a *card* on the board: a rectangle the facilitator can move,
 * resize and delete like any other shape. The card's content — the
 * question, the options, the live percentages — is drawn on top of it by
 * the poll layer, so the numbers here are the contract between the two:
 * the card's height is derived from the number of options it holds.
 */

/** the width of a poll card, in scene units */
export const POLL_CARD_WIDTH = 280;

/** the space the question takes */
export const POLL_CARD_HEADER_HEIGHT = 52;

/** the space one option takes */
export const POLL_CARD_OPTION_HEIGHT = 40;

/** the space the card's footer takes */
export const POLL_CARD_FOOTER_HEIGHT = 34;

/** the card's inner padding */
export const POLL_CARD_PADDING = 12;

/** how tall a card with the given number of options is */
export const getPollCardHeight = (optionCount: number) =>
  POLL_CARD_HEADER_HEIGHT +
  Math.max(0, optionCount) * POLL_CARD_OPTION_HEIGHT +
  POLL_CARD_FOOTER_HEIGHT;
