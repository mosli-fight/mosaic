import { getBoundsFromPoints } from "@excalidraw/element";

import {
  distanceToLineSegment,
  lineSegment,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";

import type {
  GlobalPoint,
  LineSegment,
  LocalPoint,
} from "@excalidraw/math/types";
import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

/**
 * Radius of the eraser cursor circle in *screen* pixels. Smaller than the
 * whole-stroke eraser's 5px, which is what makes the precision mode read as
 * the finer tool; `AppCursor.applyPrecisionEraser` paints the matching circle.
 */
export const PRECISION_ERASER_CURSOR_RADIUS = 4;

/**
 * Floor for the scene-space radius. Zooming out divides the cursor radius by
 * the zoom, which would otherwise let a single touch swallow a whole stroke.
 * Same shape (and same value) as the whole-stroke eraser's freedraw tolerance.
 */
export const PRECISION_ERASER_MIN_RADIUS = 2.25;

/**
 * A surviving run shorter than this renders as nothing at all — the editor
 * already treats a freedraw element with fewer than 2 points as invisibly
 * small (`isInvisiblySmallElement`), so such a run is dropped rather than
 * left behind as an invisible element.
 */
export const MIN_FREEDRAW_RUN_POINTS = 2;

/**
 * The scene-space radius the precision eraser removes points within, for the
 * given zoom. Zoom-independent in *screen* terms, so the erased area tracks
 * the cursor circle the user actually sees.
 */
export const getPrecisionEraserRadius = (zoom: number) =>
  Math.max(PRECISION_ERASER_MIN_RADIUS, PRECISION_ERASER_CURSOR_RADIUS / zoom);

/** One surviving stretch of a split stroke, in the original element's frame. */
export type FreedrawRun = {
  points: LocalPoint[];
  pressures: number[];
  /**
   * Translation to apply to the original element's `x`/`y` so this run renders
   * exactly where its points used to. Zero for unrotated strokes; non-zero
   * only because a freedraw element rotates about the center of its own
   * points, and a subset of those points has a different center.
   */
  offset: { x: number; y: number };
};

export type FreedrawSplit = {
  /** surviving runs, in stroke order; empty when every point was erased */
  runs: FreedrawRun[];
  /** how many of the original points the eraser path removed */
  erasedCount: number;
};

/** Center of a point set, in the same (local) frame as the points. */
const getLocalCenter = (points: readonly LocalPoint[]) => {
  const [minX, minY, maxX, maxY] = getBoundsFromPoints(points);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};

/**
 * A freedraw element's points are local to `element.x`/`element.y` and the
 * whole stroke is rotated about the center of its own bounds — the same pivot
 * `getElementAbsoluteCoords` derives. Reproduce that here so hit-testing
 * happens in scene space, where the eraser path lives.
 */
const toScenePoint = (
  element: ExcalidrawFreeDrawElement,
  point: LocalPoint,
  localCenter: { x: number; y: number },
): GlobalPoint =>
  pointRotateRads(
    pointFrom<GlobalPoint>(point[0] + element.x, point[1] + element.y),
    pointFrom<GlobalPoint>(
      element.x + localCenter.x,
      element.y + localCenter.y,
    ),
    element.angle,
  );

/**
 * The eraser gesture as segments. A single-point path (a click) becomes a
 * degenerate segment, which measures distance to that point.
 */
const toEraserSegments = (
  eraserPath: readonly GlobalPoint[],
): LineSegment<GlobalPoint>[] => {
  if (eraserPath.length === 0) {
    return [];
  }
  if (eraserPath.length === 1) {
    return [lineSegment(eraserPath[0], eraserPath[0])];
  }

  const segments: LineSegment<GlobalPoint>[] = [];
  for (let i = 1; i < eraserPath.length; i++) {
    segments.push(lineSegment(eraserPath[i - 1], eraserPath[i]));
  }
  return segments;
};

/**
 * Freedraw points are sampled per pointer move, so a fast drag leaves them
 * tens of units apart. Hit-testing only those samples would let the eraser
 * cross the visible line *between* two samples and erase nothing — the
 * stroke is therefore densified first: any segment longer than the erase
 * radius is subdivided (interpolating pressures) until neighbouring samples
 * are at most one radius apart, so a crossing always lands within the radius
 * of a sample, and the samples erased around it leave a gap that matches the
 * eraser circle the user saw.
 */
const densifyStroke = (
  points: readonly LocalPoint[],
  pressures: readonly number[],
  radius: number,
): { points: LocalPoint[]; pressures: number[] } => {
  // pressures are index-aligned with points; a mismatched array is stale, so
  // don't try to interpolate it (the renderer only reads it when not
  // simulating)
  const hasPressures = pressures.length === points.length;
  const densePoints: LocalPoint[] = [];
  const densePressures: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    densePoints.push(point);
    if (hasPressures) {
      densePressures.push(pressures[i]);
    }

    const next = points[i + 1];
    if (!next) {
      break;
    }

    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const subdivisions = Math.floor(length / radius);
    for (let j = 1; j <= subdivisions; j++) {
      const t = j / (subdivisions + 1);
      densePoints.push(
        pointFrom<LocalPoint>(
          point[0] + (next[0] - point[0]) * t,
          point[1] + (next[1] - point[1]) * t,
        ),
      );
      if (hasPressures) {
        densePressures.push(
          pressures[i] + (pressures[i + 1] - pressures[i]) * t,
        );
      }
    }
  }

  return { points: densePoints, pressures: densePressures };
};

/**
 * Builds a run from the point indices that survived, and works out where the
 * run's element has to sit to render in place.
 *
 * A freedraw element rotates about the center of its own points, so a subset
 * of the points rotates about a different pivot. Solving
 * `pivot' + R(p - c) = pivot + R(p - c_old)` for the new position gives
 * `t = (I - R)(c_old - c)` — zero when the element isn't rotated.
 */
const buildRun = (
  strokePoints: readonly LocalPoint[],
  strokePressures: readonly number[],
  indices: number[],
  angle: ExcalidrawFreeDrawElement["angle"],
  originalCenter: { x: number; y: number },
): FreedrawRun => {
  const points = indices.map((index) => strokePoints[index]);

  const pressures =
    strokePressures.length === strokePoints.length
      ? indices.map((index) => strokePressures[index])
      : [];

  const runCenter = getLocalCenter(points);
  const delta = pointFrom<GlobalPoint>(
    originalCenter.x - runCenter.x,
    originalCenter.y - runCenter.y,
  );
  const rotatedDelta = pointRotateRads(
    delta,
    pointFrom<GlobalPoint>(0, 0),
    angle,
  );

  return {
    points,
    pressures,
    offset: {
      x: delta[0] - rotatedDelta[0],
      y: delta[1] - rotatedDelta[1],
    },
  };
};

/**
 * Splits a freedraw stroke around the points the eraser path touched:
 * every (densified) point within `radius` of the path is removed, and the
 * points that survive are grouped into runs — one element per run.
 *
 * Returns `null` when the path touched nothing, so callers can skip the
 * element entirely. A split with no runs means the whole stroke was erased.
 */
export const splitFreedrawByErasePath = (
  element: ExcalidrawFreeDrawElement,
  eraserPath: readonly GlobalPoint[],
  radius: number,
): FreedrawSplit | null => {
  const segments = toEraserSegments(eraserPath);
  if (!segments.length || element.points.length === 0) {
    return null;
  }

  const stroke = densifyStroke(element.points, element.pressures, radius);

  const localCenter = getLocalCenter(stroke.points);
  const scenePoints = stroke.points.map((point) =>
    toScenePoint(element, point, localCenter),
  );

  const isErased = scenePoints.map((scenePoint) =>
    segments.some(
      (segment) => distanceToLineSegment(scenePoint, segment) <= radius,
    ),
  );

  if (!isErased.some(Boolean)) {
    return null;
  }

  const runs: FreedrawRun[] = [];
  let run: number[] = [];

  const flushRun = () => {
    if (run.length >= MIN_FREEDRAW_RUN_POINTS) {
      runs.push(
        buildRun(
          stroke.points,
          stroke.pressures,
          run,
          element.angle,
          localCenter,
        ),
      );
    }
    run = [];
  };

  for (let i = 0; i < isErased.length; i++) {
    if (isErased[i]) {
      flushRun();
    } else {
      run.push(i);
    }
  }
  flushRun();

  return {
    runs,
    erasedCount: isErased.filter(Boolean).length,
  };
};
