import { useEffect, useRef } from "react";

import type {
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { drawFrameThumbnail } from "./frameThumbnail";

import type { AppClassProperties, AppState } from "../../types";

/** the thumbnail's size, in CSS px */
export const FRAME_THUMBNAIL_WIDTH = 88;
export const FRAME_THUMBNAIL_HEIGHT = 56;

/**
 * How long the panel waits for the scene to settle before it redraws a
 * thumbnail. Editing a frame updates the scene on every keystroke and
 * every pointer move; the thumbnail only has to catch up with the last of
 * them.
 */
const REFRESH_DELAY = 120;

type FrameThumbnailProps = {
  frame: ExcalidrawFrameLikeElement;
  elements: readonly NonDeletedExcalidrawElement[];
  /**
   * A fingerprint of the frame's contents. The thumbnail is redrawn when
   * it changes — and only then, so that a change elsewhere on the board
   * does not cost a redraw.
   */
  contentKey: string;
  theme: AppState["theme"];
  viewBackgroundColor: string;
  imageCache: AppClassProperties["imageCache"];
};

/**
 * The miniature of a frame, as it stands on the board.
 */
export const FrameThumbnail = ({
  frame,
  elements,
  contentKey,
  theme,
  viewBackgroundColor,
  imageCache,
}: FrameThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // the redraw is debounced, so it reads the scene as it is when the
  // delay is over — not as it was when the redraw was scheduled
  const latest = useRef({
    frame,
    elements,
    theme,
    viewBackgroundColor,
    imageCache,
  });

  useEffect(() => {
    latest.current = {
      frame,
      elements,
      theme,
      viewBackgroundColor,
      imageCache,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const timer = setTimeout(() => {
      const { frame, elements, theme, viewBackgroundColor, imageCache } =
        latest.current;

      drawFrameThumbnail({
        canvas,
        frame,
        elements,
        theme,
        viewBackgroundColor,
        imageCache,
        width: FRAME_THUMBNAIL_WIDTH,
        height: FRAME_THUMBNAIL_HEIGHT,
        scale: window.devicePixelRatio || 1,
      });
    }, REFRESH_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [contentKey, theme, viewBackgroundColor]);

  return <canvas className="frames-panel__thumbnail-canvas" ref={canvasRef} />;
};
