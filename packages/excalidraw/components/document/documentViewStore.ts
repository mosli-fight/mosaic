/**
 * Which view the document pane is showing.
 *
 * The pane has three views — the document alone, the document beside the
 * canvas, and the canvas alone — and they are exactly the three states this
 * store holds. "Canvas" means the pane is not on screen, which is also what
 * the pane's close button sets, so there is one notion of "showing" rather
 * than two that could disagree.
 *
 * Like the assistant and diagram panes, this is a surface of the editor
 * rather than part of the document: switching views must not make the board
 * dirty, so the view is kept out of the app state and is not saved with the
 * board. The notes themselves are saved separately, per board.
 */

import { useSyncExternalStore } from "react";

/** the three views the pane can be in */
export type DocumentView = "document" | "both" | "canvas";

/** the views in the order the toggle shows them */
export const DOCUMENT_VIEWS: readonly DocumentView[] = [
  "document",
  "both",
  "canvas",
];

/** the view the pane opens in */
export const DEFAULT_DOCUMENT_VIEW: DocumentView = "both";

/** the view the pane is in */
let view: DocumentView = "canvas";

/** the last view that showed the document, so a reopen returns to it */
let lastDocumentView: DocumentView = DEFAULT_DOCUMENT_VIEW;

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

/** registers a listener for view changes (what the hook subscribes with) */
export const subscribeDocumentView = subscribe;

/** the view the pane is in */
export const getDocumentView = (): DocumentView => view;

/** whether the pane is on screen */
export const isDocumentPaneVisible = (): boolean => view !== "canvas";

/** the view the pane is in, for the toolbar button and the pane itself */
export const useDocumentView = (): DocumentView =>
  useSyncExternalStore(subscribe, getDocumentView, getDocumentView);

/** shows the pane in one of its views */
export const setDocumentView = (next: DocumentView) => {
  if (next !== "canvas") {
    lastDocumentView = next;
  }

  if (view === next) {
    return;
  }

  view = next;
  notify();
};

/** hides the pane, remembering the view it was in */
export const closeDocumentPane = () => {
  setDocumentView("canvas");
};

/**
 * Shows the pane if it is hidden, and hides it if it is not.
 *
 * Reopening returns to the last view that showed the document rather than
 * always to the same one, so closing the pane to look at the canvas and
 * opening it again does not lose the layout the user chose.
 */
export const toggleDocumentPane = () => {
  setDocumentView(view === "canvas" ? lastDocumentView : "canvas");
};

/** moves to the next view in the toggle's order */
export const cycleDocumentView = () => {
  const index = DOCUMENT_VIEWS.indexOf(view);

  setDocumentView(DOCUMENT_VIEWS[(index + 1) % DOCUMENT_VIEWS.length]);
};

/** puts the store back to its starting state (for tests) */
export const resetDocumentView = () => {
  view = "canvas";
  lastDocumentView = DEFAULT_DOCUMENT_VIEW;
  notify();
};
