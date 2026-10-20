import { randomId, ROUNDNESS } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  newElement,
  newElementWith,
} from "@excalidraw/element";

import {
  getPollCardHeight,
  POLL_CARD_WIDTH,
} from "../components/facilitation/pollCard";
import {
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  POLL_CUSTOM_DATA_KEY,
} from "../components/facilitation/types";

import { register } from "./register";

import type { PollData, PollOption } from "../components/facilitation/types";

/**
 * The facilitation tools' own actions.
 *
 * A poll is a real card on the board, so creating, editing and deleting
 * one are element operations — they belong to the scene, and they are
 * undoable like any other change to it. The *votes* are not: they are
 * session state, and they live in the browser (see
 * `components/facilitation/storage.ts`).
 */

/** the card's look: a plain white card, so the content drawn on it reads */
const POLL_CARD_STYLE = {
  strokeColor: "#d9d9de",
  backgroundColor: "#ffffff",
  fillStyle: "solid" as const,
  strokeWidth: 1,
  strokeStyle: "solid" as const,
  roughness: 0,
  opacity: 100,
  roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
};

const cleanUpOptions = (options: string[] | undefined): string[] =>
  (options ?? [])
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, MAX_POLL_OPTIONS);

const toPollOptions = (options: string[]): PollOption[] =>
  options.map((text) => ({ id: randomId(), text }));

/**
 * Creates a poll card in the middle of what the facilitator is looking
 * at.
 */
export const actionCreatePoll = register<{
  question: string;
  options: string[];
}>({
  name: "createPoll",
  label: "facilitation.poll.create",
  trackEvent: { category: "facilitation" },
  perform: (elements, appState, value) => {
    const question = value?.question?.trim() ?? "";
    const optionTexts = cleanUpOptions(value?.options);

    if (!question || optionTexts.length < MIN_POLL_OPTIONS) {
      return false;
    }

    const poll: PollData = {
      id: randomId(),
      question,
      options: toPollOptions(optionTexts),
    };

    const width = POLL_CARD_WIDTH;
    const height = getPollCardHeight(poll.options.length);

    // the card lands in the middle of the viewport, so it is where the
    // facilitator is looking when they create it
    const x =
      (appState.width / 2 - appState.scrollX) / appState.zoom.value - width / 2;
    const y =
      (appState.height / 2 - appState.scrollY) / appState.zoom.value -
      height / 2;

    const element = newElement({
      type: "rectangle",
      x,
      y,
      width,
      height,
      ...POLL_CARD_STYLE,
      customData: { [POLL_CUSTOM_DATA_KEY]: poll },
    });

    return {
      elements: [...elements, element],
      appState: {
        selectedElementIds: { [element.id]: true },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

/**
 * Rewrites the content of a poll card — its question and its options.
 *
 * The card grows (or shrinks) with its options, so the content always
 * fits the shape it is drawn on.
 */
export const actionUpdatePoll = register<{
  elementId: string;
  question: string;
  options: string[];
}>({
  name: "updatePoll",
  label: "facilitation.poll.update",
  trackEvent: { category: "facilitation" },
  perform: (elements, appState, value) => {
    const { elementId } = value ?? {};

    if (!elementId) {
      return false;
    }

    const question = value?.question?.trim() ?? "";
    const optionTexts = cleanUpOptions(value?.options);

    if (!question || optionTexts.length < MIN_POLL_OPTIONS) {
      return false;
    }

    let updated = false;

    const nextElements = elements.map((element) => {
      if (element.id !== elementId) {
        return element;
      }

      const poll = element.customData?.[POLL_CUSTOM_DATA_KEY] as
        | PollData
        | undefined;

      if (!poll) {
        return element;
      }

      updated = true;

      // the options keep their identity as long as they keep their text,
      // so the votes cast for them survive an edit
      const options: PollOption[] = optionTexts.map((text, index) => {
        const previous = poll.options[index];
        return previous && previous.text === text
          ? previous
          : { id: previous?.id ?? randomId(), text };
      });

      const nextPoll: PollData = { ...poll, question, options };

      return newElementWith(element, {
        height: getPollCardHeight(options.length),
        customData: { ...element.customData, [POLL_CUSTOM_DATA_KEY]: nextPoll },
      });
    });

    if (!updated) {
      return false;
    }

    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

/**
 * Removes a poll card from the board.
 */
export const actionDeletePoll = register<{ elementId: string }>({
  name: "deletePoll",
  label: "facilitation.poll.delete",
  trackEvent: { category: "facilitation" },
  perform: (elements, appState, value) => {
    const { elementId } = value ?? {};

    if (!elementId) {
      return false;
    }

    const element = elements.find((el) => el.id === elementId);

    if (!element?.customData?.[POLL_CUSTOM_DATA_KEY]) {
      return false;
    }

    return {
      elements: elements.filter((el) => el.id !== elementId),
      appState: {
        selectedElementIds: Object.fromEntries(
          Object.entries(appState.selectedElementIds).filter(
            ([id]) => id !== elementId,
          ),
        ),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
