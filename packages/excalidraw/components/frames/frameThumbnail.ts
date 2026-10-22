import rough from "roughjs/bin/rough";

import { arrayToMap, toBrandedType } from "@excalidraw/common";

import {
  getElementAbsoluteCoords,
  getElementsOverlappingFrame,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { renderStaticScene } from "../../renderer/staticScene";

import type { RenderableElementsMap } from "../../scene/types";
import type {
  AppClassProperties,
  AppState,
  NormalizedZoomValue,
  StaticCanvasAppState,
} from "../../types";

/**
 * The miniature of a frame.
 *
 * The thumbnail is not a drawing of the frame — it *is* the frame's
 * contents, rendered by the very renderer the canvas uses, at the scale
 * that fits the frame into the thumbnail. What the panel shows is
 * therefore what the frame holds, down to its colors and its text.
 */

export type FrameThumbnailOptions = {
  canvas: HTMLCanvasElement;
  frame: ExcalidrawFrameLikeElement;
  elements: readonly NonDeletedExcalidrawElement[];
  theme: AppState["theme"];
  viewBackgroundColor: string;
  imageCache: AppClassProperties["imageCache"];
  /** the thumbnail's size, in CSS px */
  width: number;
  height: number;
  /** device pixels per CSS px */
  scale?: number;
};

/** the room left around the frame inside the thumbnail, in CSS px */
const THUMBNAIL_PADDING = 2;

/**
 * A stroke is a couple of scene units wide, which is a fraction of a
 * pixel once the frame is scaled down to a thumbnail — it would all but
 * vanish. Strokes are widened to a CSS pixel so the thumbnail still shows
 * what is drawn on the frame.
 */
const MIN_STROKE_WIDTH = 1;

/**
 * Draws the contents of a frame into the given canvas.
 */
export const drawFrameThumbnail = ({
  canvas,
  frame,
  elements,
  theme,
  viewBackgroundColor,
  imageCache,
  width,
  height,
  scale = 1,
}: FrameThumbnailOptions) => {
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const elementsMap = toBrandedType<RenderableElementsMap>(
    arrayToMap(elements),
  );
  // the render only ever looks elements up by id, so the scene's ordering
  // of them is of no consequence here
  const allElementsMap = arrayToMap(
    elements,
  ) as unknown as NonDeletedSceneElementsMap;

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);

  const frameWidth = Math.max(x2 - x1, 1);
  const frameHeight = Math.max(y2 - y1, 1);

  // the frame is fitted into the thumbnail, with a hair of breathing room
  const zoom = Math.max(
    Math.min(
      (width - THUMBNAIL_PADDING * 2) / frameWidth,
      (height - THUMBNAIL_PADDING * 2) / frameHeight,
    ),
    0.001,
  );

  // the scroll that puts the frame's top-left corner at the padding
  const scrollX = THUMBNAIL_PADDING / zoom - x1;
  const scrollY = THUMBNAIL_PADDING / zoom - y1;

  // what the editor shows on the frame: the frame itself, and everything
  // that sits on it
  const visibleElements = getElementsOverlappingFrame(
    elements,
    frame,
    elementsMap,
  );

  const minStrokeWidth = MIN_STROKE_WIDTH / zoom;

  const renderedElements = visibleElements.map((element) =>
    isTextElement(element) || element.strokeWidth >= minStrokeWidth
      ? element
      : newElementWith(element, { strokeWidth: minStrokeWidth }),
  );

  const appState: StaticCanvasAppState = {
    zoom: { value: zoom as NormalizedZoomValue },
    scrollX,
    scrollY,
    width,
    height,
    viewModeEnabled: false,
    openDialog: null,
    editingGroupId: null,
    selectedElementIds: {},
    frameToHighlight: null,
    offsetLeft: 0,
    offsetTop: 0,
    theme,
    shouldCacheIgnoreZoom: true,
    viewBackgroundColor,
    exportScale: 1,
    selectedElementsAreBeingDragged: false,
    gridSize: 20,
    gridStep: 5,
    frameRendering: { enabled: true, outline: false, name: false, clip: true },
    currentHoveredFontFamily: null,
    hoveredElementIds: {},
    suggestedBinding: null,
    croppingElementId: null,
  };

  const renderConfig = {
    canvasBackgroundColor: viewBackgroundColor,
    imageCache,
    renderGrid: false,
    // the thumbnail is a picture of the frame, not the frame itself: no
    // link icons, no cached bitmaps, vectors drawn afresh
    isExporting: true,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set<string>(),
    pendingFlowchartNodes: null,
    theme,
  };

  renderStaticScene({
    canvas,
    rc: rough.canvas(canvas),
    elementsMap,
    allElementsMap,
    visibleElements: renderedElements,
    scale,
    appState,
    renderConfig,
  });
};
