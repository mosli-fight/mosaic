/**
 * The way into a code block's HTML surfaces.
 *
 * A code block is painted on the canvas, but it is *edited* and *copied* in
 * HTML laid over the card. Those surfaces — the textarea, the language
 * picker, the copy button — are a lazily loaded chunk, the way the document
 * pane is: a board that only ever paints code blocks never downloads the
 * editor, and a board with no code block downloads nothing at all.
 *
 * What stays in the main bundle is this wrapper: two cheap checks of app
 * state that decide whether a surface should exist. The chunk is requested
 * the first time one does.
 */

import { Suspense, lazy } from "react";

import { isCodeBlockElement } from "@excalidraw/element";

import { useApp, useExcalidrawAppState } from "../App";

const CodeBlockEditorBody = lazy(() =>
  import("./CodeBlockEditor").then((module) => ({
    default: module.CodeBlockEditor,
  })),
);

const CodeBlockToolbarBody = lazy(() =>
  import("./CodeBlockEditor").then((module) => ({
    default: module.CodeBlockToolbar,
  })),
);

/**
 * The overlay over the block being edited, if it is one.
 *
 * Mounted once, by the app, and renders nothing unless a block is being
 * edited — so a board with no code block never pays for it.
 */
export const CodeBlockEditorOverlay = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const editing = appState.editingCodeBlock
    ? app.scene.getElement(appState.editingCodeBlock)
    : null;

  if (!isCodeBlockElement(editing)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CodeBlockEditorBody element={editing} />
    </Suspense>
  );
};

/** the toolbar over a selected block, if exactly one is selected */
export const CodeBlockToolbarOverlay = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const selected = app.scene.getSelectedElements(appState);

  if (
    selected.length !== 1 ||
    !isCodeBlockElement(selected[0]) ||
    appState.editingCodeBlock === selected[0].id
  ) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CodeBlockToolbarBody element={selected[0]} />
    </Suspense>
  );
};
