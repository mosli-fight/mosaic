import { easeOut, THEME } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import type { AnimatedTrailOptions } from "../animatedTrail";

import type App from "../components/App";

/**
 * The trail look shared by every eraser variant: a tapering, fading swipe in
 * the theme's ink color. Only `size` differs between them, which is what makes
 * the precision eraser read as the finer tool.
 *
 * Lives in its own module so the two eraser classes can share it without
 * importing each other.
 */
export const getEraserTrailOptions = (
  app: App,
  size: number,
): Partial<LaserPointerOptions> & Partial<AnimatedTrailOptions> => ({
  streamline: 0.2,
  size,
  keepHead: true,
  sizeMapping: (c) => {
    const DECAY_TIME = 200;
    const DECAY_LENGTH = 10;
    const t = Math.max(0, 1 - (performance.now() - c.pressure) / DECAY_TIME);
    const l =
      (DECAY_LENGTH - Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
      DECAY_LENGTH;

    return Math.min(easeOut(l), easeOut(t));
  },
  fill: () =>
    app.state.theme === THEME.LIGHT
      ? "rgba(0, 0, 0, 0.2)"
      : "rgba(255, 255, 255, 0.2)",
});

/** trail width of the whole-stroke eraser */
export const ERASER_TRAIL_SIZE = 5;

/** radius of the whole-stroke eraser's cursor circle, in screen pixels */
export const ERASER_CURSOR_RADIUS = 5;
