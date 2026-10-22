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
  isImageElement,
  isTextElement,
} from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { zoomToFitBounds } from "./viewport";

import type { AppClassProperties, Offsets } from "./types";
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
 * The frame the viewport is looking at — the one the frames panel
 * highlights.
 *
 * "Looking at" is about how much of the frame is on screen: the frame
 * covering most of the canvas is the one being looked at. A frame that is
 * entirely off screen is not, and neither is a hidden one — it is not on
 * the board to look at.
 */
export const getFrameInView = ({
  frames,
  appState,
  elementsMap,
}: {
  frames: readonly ExcalidrawFrameLikeElement[];
  appState: Pick<AppState, "scrollX" | "scrollY" | "zoom" | "width" | "height">;
  elementsMap: ElementsMap;
}): ExcalidrawFrameLikeElement | null => {
  const zoom = appState.zoom.value;

  if (!(zoom > 0) || !(appState.width > 0) || !(appState.height > 0)) {
    return null;
  }

  // the part of the scene the canvas shows
  const left = -appState.scrollX;
  const top = -appState.scrollY;
  const right = appState.width / zoom - appState.scrollX;
  const bottom = appState.height / zoom - appState.scrollY;

  let frameInView: ExcalidrawFrameLikeElement | null = null;
  let visibleArea = 0;

  for (const frame of frames) {
    if (isFrameHidden(frame)) {
      continue;
    }

    const [x1, y1, x2, y2] = getFrameBounds(frame, elementsMap);

    const visibleWidth = Math.min(x2, right) - Math.max(x1, left);
    const visibleHeight = Math.min(y2, bottom) - Math.max(y1, top);

    if (visibleWidth <= 0 || visibleHeight <= 0) {
      continue;
    }

    const area = visibleWidth * visibleHeight;

    if (area > visibleArea) {
      visibleArea = area;
      frameInView = frame;
    }
  }

  return frameInView;
};

/**
 * A fingerprint of what each frame holds: it changes when the frame, or
 * anything on it, changes.
 *
 * The frames panel uses it to know when a thumbnail is stale, without
 * having to compare the contents of every frame on every scene change.
 *
 * All the frames are fingerprinted in one pass over the scene, so that a
 * board of many frames does not cost a pass each.
 */
export const getFrameContentKeys = (
  frames: readonly ExcalidrawFrameLikeElement[],
  elements: readonly ExcalidrawElement[],
  imageCache?: AppClassProperties["imageCache"],
): Map<string, string> => {
  // the frame itself is part of its own fingerprint: it may have been
  // moved or resized
  const versions = new Map<string, string[]>(
    frames.map((frame) => [frame.id, [`${frame.id}:${frame.version}`]]),
  );

  // where each element sits: on one of these frames, or nowhere
  const frameOfElement = new Map<string, string>();

  for (const element of elements) {
    if (element.frameId && versions.has(element.frameId)) {
      frameOfElement.set(element.id, element.frameId);
    }
  }

  for (const element of elements) {
    let frameId = frameOfElement.get(element.id);

    // the label bound to an element on the frame is on the frame too
    if (!frameId && isTextElement(element) && element.containerId) {
      frameId = frameOfElement.get(element.containerId);
    }

    if (!frameId) {
      continue;
    }

    versions
      .get(frameId)!
      .push(
        `${element.id}:${element.version}:${getImageState(
          element,
          imageCache,
        )}`,
      );
  }

  const keys = new Map<string, string>();

  for (const [frameId, frameVersions] of versions) {
    keys.set(frameId, frameVersions.sort().join("|"));
  }

  return keys;
};

/**
 * How an image on a frame stands at the moment: still loading, or there.
 *
 * An image does not change the element it belongs to when it finishes
 * loading, so the element's version cannot tell the two apart — but the
 * thumbnail has to.
 */
const getImageState = (
  element: ExcalidrawElement,
  imageCache: AppClassProperties["imageCache"] | undefined,
) => {
  if (!isImageElement(element)) {
    return "";
  }

  const fileId = element.fileId;

  if (!fileId) {
    return "none";
  }

  const cached = imageCache?.get(fileId);

  if (!cached) {
    return "none";
  }

  return cached.image instanceof Promise ? "loading" : "ready";
};

/**
 * The type of a frame that is not deleted.
 */
export type BoardFrame = NonDeleted<ExcalidrawFrameLikeElement>;
