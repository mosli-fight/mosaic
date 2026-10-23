/**
 * The way into the document pane.
 *
 * The pane itself — the markdown parser, the renderer and the editor — is a
 * lazily loaded chunk. This wrapper is the only thing the editor's main
 * bundle carries: it watches the pane's view and only then asks for the
 * chunk, so a board that never opens the document never downloads it.
 *
 * The chunk is requested on first open and kept mounted afterwards, so
 * closing the pane and reopening it does not re-parse the notes or lose
 * what was typed.
 */

import { Suspense, lazy, useEffect, useState } from "react";

import { isWritableElement } from "@excalidraw/common";

import { toggleDocumentPane, useDocumentView } from "./documentViewStore";

const DocumentPaneBody = lazy(() =>
  import("./DocumentPaneBody").then((module) => ({
    default: module.DocumentPaneBody,
  })),
);

/**
 * The keyboard shortcut that shows and hides the pane.
 *
 * `Alt+N` for "notes". It is checked here rather than in the editor's own
 * key handler because the pane is a surface of the editor, not a tool: the
 * shortcut must work whether or not the canvas has focus, and it must never
 * fire while the user is typing into a field.
 */
const TOGGLE_SHORTCUT_KEY = "n";

/** whether the event is the pane's toggle shortcut */
const isToggleShortcut = (event: KeyboardEvent): boolean =>
  event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === TOGGLE_SHORTCUT_KEY;

/**
 * The pane, or nothing while it is closed.
 *
 * `wasOpened` is what keeps the chunk alive after a close: the body stays
 * mounted (hidden by its own view check) so its notes survive a toggle.
 */
export const DocumentPane = () => {
  const view = useDocumentView();
  const isOpen = view !== "canvas";
  const [wasOpened, setWasOpened] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setWasOpened(true);
    }
  }, [isOpen]);

  // the keyboard shortcut, for as long as the editor is on the page
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isToggleShortcut(event) || isWritableElement(event.target)) {
        return;
      }

      event.preventDefault();
      toggleDocumentPane();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!wasOpened) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <DocumentPaneBody />
    </Suspense>
  );
};
