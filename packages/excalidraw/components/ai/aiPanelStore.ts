/**
 * Whether the assistant panel is open.
 *
 * The panel is a surface of the editor rather than a part of the document,
 * so it is kept out of the scene's state: it is not saved with the board
 * and it is not restored with it.
 *
 * The state lives in a small store of its own rather than in the app's
 * state, so that opening the panel does not make the board dirty.
 */

import { useSyncExternalStore } from "react";

/** whether the panel is on screen */
let isOpen = false;

/** the components that are showing the panel */
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/** whether the panel is open */
export const isAIPanelOpen = (): boolean => isOpen;

/** shows the panel */
export const openAIPanel = () => {
  isOpen = true;
  notify();
};

/** hides the panel */
export const closeAIPanel = () => {
  isOpen = false;
  notify();
};

/** shows the panel if it is hidden, and hides it if it is not */
export const toggleAIPanel = () => {
  isOpen = !isOpen;
  notify();
};

/**
 * Whether the panel is open.
 *
 * The toolbar button and the panel itself both read it, so that the button
 * knows whether the panel is already up.
 */
export const useAIPanelOpen = (): boolean =>
  useSyncExternalStore(subscribe, isAIPanelOpen, isAIPanelOpen);
