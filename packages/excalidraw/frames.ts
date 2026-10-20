/**
 * The frame vocabulary of the editor: which frames are on the board, in
 * what order a presentation walks them, and where the viewport has to go
 * for a frame to fill the screen.
 *
 * The element package owns what a frame *is*; this module owns what the
 * editor does with a set of them — the frames panel and present mode both
 * need the same answers, and they must agree on them.
 */

import {
  getElementAbsoluteCoords,
  getFrameChildren,
  getFrameLikeTitle,
  isFrameHidden,
  isFrameLikeElement,
} from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { zoomToFitBounds } from "./viewport";

import type { Offsets } from "./types";
import type { AppState } from "./types";

/**
 * The frames of the board, in the order they are stacked — the order the
 * frames panel lists them in, and the order present mode walks them.
 *
 * Hidden frames are included: they are still frames, and the panel has to
 * offer a way to bring them back.
 */
export const getBoardFrames = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawFrameLikeElement[] => {
  return elements.filter((element): element is ExcalidrawFrameLikeElement =>
    isFrameLikeElement(element),
  );
};

/**
 * The frames a presentation walks through — the ones that are on the board.
 *
 * A hidden frame is off the board, so it is not part of the show.
 */
export const getPresentableFrames = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawFrameLikeElement[] => {
  return getBoardFrames(elements).filter((frame) => !isFrameHidden(frame));
};

/**
 * The index of the given frame among the presentable ones, or `-1` when it
 * is not one of them (it is hidden, or it is not a frame).
 */
export const getPresentableFrameIndex = (
  frames: readonly ExcalidrawFrameLikeElement[],
  frameId: ExcalidrawElement["id"] | null,
) => {
  if (!frameId) {
    return -1;
  }
  return frames.findIndex((frame) => frame.id === frameId);
};

/**
 * The bounds of a frame, in scene coordinates.
 */
export const getFrameBounds = (
  frame: ExcalidrawFrameLikeElement,
  elementsMap: ElementsMap,
): [number, number, number, number] => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);
  return [x1, y1, x2, y2];
};

/**
 * The viewport that shows the given frame filling the viewport.
 *
 * A presentation shows a frame as a slide: the frame is the slide, and it
 * fills the screen. The frame is fitted rather than scaled to fit, so a
 * frame that is wider than tall is fitted by its width — the slide keeps
 * its shape.
 */
export const getFrameViewport = ({
  frame,
  appState,
  elementsMap,
  canvasOffsets,
}: {
  frame: ExcalidrawFrameLikeElement;
  appState: AppState;
  elementsMap: ElementsMap;
  canvasOffsets?: Offsets;
}) => {
  const bounds = getFrameBounds(frame, elementsMap);

  const { appState: nextAppState } = zoomToFitBounds({
    bounds,
    appState,
    fit: "contain",
    canvasOffsets,
  });

  return {
    scrollX: nextAppState.scrollX,
    scrollY: nextAppState.scrollY,
    zoom: nextAppState.zoom,
  };
};

/**
 * A one-line description of what sits on a frame, for the frames panel.
 */
export const getFrameContentCount = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
) => {
  return getFrameChildren(elements, frame.id).filter(
    (element) => !(element.type === "text" && element.containerId),
  ).length;
};

/**
 * The title of a frame, falling back to the default name.
 */
export const getFrameTitle = (frame: ExcalidrawFrameLikeElement) =>
  getFrameLikeTitle(frame);

/**
 * The type of a frame that is not deleted.
 */
export type BoardFrame = NonDeleted<ExcalidrawFrameLikeElement>;
