/**
 * Where a code block's HTML overlay sits.
 *
 * The block is painted on the canvas, but its editor and its toolbar are
 * HTML over the canvas. Both have to land exactly on the card: the editor on
 * the code area, the toolbar on the header. The geometry is computed here,
 * once, from the same layout the painter uses, so the overlay and the card
 * cannot drift apart.
 *
 * The returned coordinates are the editor's own (the canvas container's),
 * with the container's offset already subtracted — the same convention the
 * other canvas overlays use.
 */

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type { CodeBlockLayout } from "@excalidraw/common";
import type { ExcalidrawCodeBlockElement } from "@excalidraw/element/types";

import type { AppState } from "../../types";

export type CodeBlockOverlayGeometry = {
  /** the overlay's left edge, in the editor container's coordinates */
  x: number;
  /** the overlay's top edge, in the editor container's coordinates */
  y: number;
  /** the card's width, in scene units (the caller scales it) */
  width: number;
  /** the card's height, in scene units (the caller scales it) */
  height: number;
  /** the room between the top of the overlay and the first line of code */
  paddingTop: number;
};

/**
 * The geometry of a block's overlay.
 *
 * The overlay starts at the card's top-left corner — the header included —
 * so that the same geometry serves both the toolbar (which covers the
 * header) and the editor (which pads past it to reach the code).
 */
export const getCodeBlockEditorGeometry = (
  element: ExcalidrawCodeBlockElement,
  layout: CodeBlockLayout,
  appState: Pick<
    AppState,
    "zoom" | "offsetLeft" | "offsetTop" | "scrollX" | "scrollY"
  >,
): CodeBlockOverlayGeometry => {
  const { x, y } = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    appState,
  );

  return {
    x: x - appState.offsetLeft,
    y: y - appState.offsetTop,
    width: element.width,
    height: element.height,
    // the code starts below the header and the card's padding
    paddingTop: layout.headerHeight + layout.padding,
  };
};
