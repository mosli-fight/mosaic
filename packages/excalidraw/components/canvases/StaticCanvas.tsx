import React, { useEffect, useRef } from "react";

import { isShallowEqual, MIME_TYPES } from "@excalidraw/common";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { isRenderThrottlingEnabled } from "../../reactUtils";
import { renderStaticScene } from "../../renderer/staticScene";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../../scene/types";
import type { AppState, StaticCanvasAppState } from "../../types";
import type { RoughCanvas } from "roughjs/bin/canvas";

type StaticCanvasProps = {
  canvas: HTMLCanvasElement;
  rc: RoughCanvas;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  canvasNonce: string;
  selectionNonce: number | undefined;
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

/**
 * How often the canvas is drawn again while a GIF is on it.
 *
 * A GIF moves at its own pace, but it does not need to be drawn at the
 * display's full rate to look like it is moving.
 */
const GIF_FRAME_INTERVAL = 1000 / 30;

/**
 * Whether an animated GIF is on the board.
 *
 * The canvas draws the frame the browser has ready at the time it draws,
 * so a GIF on the board only moves if the board is drawn again and again.
 */
const hasAnimatedGif = (
  visibleElements: readonly NonDeletedExcalidrawElement[],
  renderConfig: StaticCanvasRenderConfig,
) =>
  visibleElements.some(
    (element) =>
      element.type === "image" &&
      !!element.fileId &&
      renderConfig.imageCache.get(element.fileId)?.mimeType === MIME_TYPES.gif,
  );

const StaticCanvas = (props: StaticCanvasProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isComponentMounted = useRef(false);
  /** the scene as it was last drawn, so that it can be drawn again */
  const latestScene = useRef<StaticSceneRenderConfig | null>(null);
  /** the frame the animation loop is waiting on, if it is running */
  const animationFrame = useRef<number | null>(null);
  /** when the animation loop last drew the scene */
  const lastFrameAt = useRef(0);

  const stopAnimation = () => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };

  const startAnimation = () => {
    if (
      animationFrame.current !== null ||
      typeof requestAnimationFrame !== "function"
    ) {
      return;
    }

    const tick = () => {
      const scene = latestScene.current;
      const now = Date.now();

      if (scene && now - lastFrameAt.current >= GIF_FRAME_INTERVAL) {
        lastFrameAt.current = now;

        try {
          renderStaticScene(scene);
        } catch {
          // the canvas is gone — nothing left to draw on
          stopAnimation();
          return;
        }
      }

      animationFrame.current = requestAnimationFrame(tick);
    };

    animationFrame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    props.canvas.style.width = `${props.appState.width}px`;
    props.canvas.style.height = `${props.appState.height}px`;
    props.canvas.width = props.appState.width * props.scale;
    props.canvas.height = props.appState.height * props.scale;
  }, [props.appState.height, props.appState.width, props.canvas, props.scale]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const canvas = props.canvas;

    if (!isComponentMounted.current) {
      isComponentMounted.current = true;

      wrapper.replaceChildren(canvas);
      canvas.classList.add("excalidraw__canvas", "static");
    }

    const scene: StaticSceneRenderConfig = {
      canvas,
      rc: props.rc,
      scale: props.scale,
      elementsMap: props.elementsMap,
      allElementsMap: props.allElementsMap,
      visibleElements: props.visibleElements,
      appState: props.appState,
      renderConfig: props.renderConfig,
    };

    latestScene.current = scene;

    renderStaticScene(scene, isRenderThrottlingEnabled());

    if (hasAnimatedGif(props.visibleElements, props.renderConfig)) {
      startAnimation();
    } else {
      stopAnimation();
    }
  });

  useEffect(() => {
    return () => {
      stopAnimation();
      latestScene.current = null;
    };
  }, []);

  return <div className="excalidraw__canvas-wrapper" ref={wrapperRef} />;
};

const getRelevantAppStateProps = (appState: AppState): StaticCanvasAppState => {
  const relevantAppStateProps = {
    zoom: appState.zoom,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    width: appState.width,
    height: appState.height,
    viewModeEnabled: appState.viewModeEnabled,
    openDialog: appState.openDialog,
    hoveredElementIds: appState.hoveredElementIds,
    offsetLeft: appState.offsetLeft,
    offsetTop: appState.offsetTop,
    theme: appState.theme,
    shouldCacheIgnoreZoom: appState.shouldCacheIgnoreZoom,
    viewBackgroundColor: appState.viewBackgroundColor,
    exportScale: appState.exportScale,
    selectedElementsAreBeingDragged: appState.selectedElementsAreBeingDragged,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
    frameRendering: appState.frameRendering,
    selectedElementIds: appState.selectedElementIds,
    frameToHighlight: appState.frameToHighlight,
    editingGroupId: appState.editingGroupId,
    currentHoveredFontFamily: appState.currentHoveredFontFamily,
    croppingElementId: appState.croppingElementId,
    suggestedBinding: appState.suggestedBinding,
  };

  return relevantAppStateProps;
};

const areEqual = (
  prevProps: StaticCanvasProps,
  nextProps: StaticCanvasProps,
) => {
  if (
    prevProps.canvasNonce !== nextProps.canvasNonce ||
    prevProps.scale !== nextProps.scale ||
    // we need to memoize on elementsMap because they may have renewed
    // even if canvasNonce didn't change (e.g. we filter elements out based
    // on appState)
    prevProps.elementsMap !== nextProps.elementsMap ||
    prevProps.visibleElements !== nextProps.visibleElements
  ) {
    return false;
  }

  return (
    isShallowEqual(
      // asserting AppState because we're being passed the whole AppState
      // but resolve to only the StaticCanvas-relevant props
      getRelevantAppStateProps(prevProps.appState as AppState),
      getRelevantAppStateProps(nextProps.appState as AppState),
    ) && isShallowEqual(prevProps.renderConfig, nextProps.renderConfig)
  );
};

export default React.memo(StaticCanvas, areEqual);
