/**
 * Whether the diagram pane is open.
 *
 * Like the assistant panel, the pane is a surface of the editor rather than
 * part of the document, so its open/closed state lives in a store of its
 * own: opening it must not make the board dirty, and it is not saved with
 * the board. The code it edits *is* saved — that lives in the app state.
 */

import { useSyncExternalStore } from "react";

/** whether the pane is on screen */
let isOpen = false;

/** the components that are showing the pane */
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

/** whether the pane is open */
export const isDiagramPanelOpen = (): boolean => isOpen;

/** shows the pane */
export const openDiagramPanel = () => {
  isOpen = true;
  notify();
};

/** hides the pane */
export const closeDiagramPanel = () => {
  isOpen = false;
  notify();
};

/** shows the pane if it is hidden, and hides it if it is not */
export const toggleDiagramPanel = () => {
  isOpen = !isOpen;
  notify();
};

/** whether the pane is open, for the toolbar button and the pane itself */
export const useDiagramPanelOpen = (): boolean =>
  useSyncExternalStore(subscribe, isDiagramPanelOpen, isDiagramPanelOpen);
