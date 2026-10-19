import { getSizeFromPoints } from "@excalidraw/common";
import { newElementWith, newFreeDrawElement } from "@excalidraw/element";
import { isFreeDrawElement } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animatedTrail";

import { splitFreedrawByErasePath } from "./precision";
import { getEraserTrailOptions } from "./trailOptions";

import type App from "../components/App";

/** trail width of the precision eraser — thinner than the whole-stroke one */
export const PRECISION_ERASER_TRAIL_SIZE = 3;

/**
 * The precision eraser's drag gesture. It renders the same tapering swipe as
 * the whole-stroke eraser, but also records the path in scene coordinates so
 * the stroke-splitting pass can replay it on pointer up.
 *
 * The erase itself is deliberately deferred to pointer up (as bucket fill
 * does): splitting a stroke is a structural change — elements die, elements
 * are born — and doing it per pointer move would bury the undo stack and
 * churn the scene for every pixel of the drag.
 */
export class PrecisionEraserTrail extends AnimatedTrail {
  private scenePath: GlobalPoint[] = [];

  constructor(app: App) {
    super(app, getEraserTrailOptions(app, PRECISION_ERASER_TRAIL_SIZE));
  }

  startPath(x: number, y: number): void {
    this.endPath();
    this.scenePath = [pointFrom<GlobalPoint>(x, y)];
    super.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    const last = this.scenePath[this.scenePath.length - 1];
    // the trail's own streamline already smooths the visual; the erase path
    // keeps every sample so a fast drag can't skip over points
    if (last && last[0] === x && last[1] === y) {
      return;
    }
    this.scenePath.push(pointFrom<GlobalPoint>(x, y));
    super.addPointToPath(x, y);
  }

  /** the drag so far, in scene coordinates; empty between gestures */
  getScenePath(): readonly GlobalPoint[] {
    return this.scenePath;
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.scenePath = [];
  }
}

/**
 * Applies one precision-erase gesture to the scene's elements.
 *
 * Every unlocked freedraw stroke the path came within `radius` of has the
 * touched points removed: the surviving stretches become separate elements
 * (the first reusing the original element's identity, so its z-order, group
 * and frame membership survive), and a stroke with nothing left is deleted.
 *
 * Returns the next elements, or `null` when the gesture changed nothing — so
 * callers can skip the scene write and the history entry entirely.
 */
export const applyPrecisionErase = (
  elements: readonly ExcalidrawElement[],
  eraserPath: readonly GlobalPoint[],
  radius: number,
): ExcalidrawElement[] | null => {
  if (!eraserPath.length) {
    return null;
  }

  const nextElements: ExcalidrawElement[] = [];
  let didChange = false;

  for (const element of elements) {
    if (element.isDeleted || element.locked || !isFreeDrawElement(element)) {
      nextElements.push(element);
      continue;
    }

    const split = splitFreedrawByErasePath(element, eraserPath, radius);

    if (!split) {
      nextElements.push(element);
      continue;
    }

    didChange = true;

    if (!split.runs.length) {
      nextElements.push(newElementWith(element, { isDeleted: true }));
      continue;
    }

    for (const [index, run] of split.runs.entries()) {
      const { width, height } = getSizeFromPoints(run.points);
      const x = element.x + run.offset.x;
      const y = element.y + run.offset.y;

      if (index === 0) {
        // keep the original element for the leading run: its id carries the
        // group/frame membership and its index carries the z-order, so the
        // surviving ink doesn't jump behind or in front of its neighbours
        nextElements.push(
          newElementWith(element, {
            x,
            y,
            width,
            height,
            points: run.points,
            pressures: run.pressures,
          }),
        );
      } else {
        nextElements.push(
          newFreeDrawElement({
            type: "freedraw",
            x,
            y,
            width,
            height,
            points: run.points,
            pressures: run.pressures,
            simulatePressure: element.simulatePressure,
            strokeOptions: element.strokeOptions,
            strokeColor: element.strokeColor,
            backgroundColor: element.backgroundColor,
            fillStyle: element.fillStyle,
            strokeWidth: element.strokeWidth,
            strokeStyle: element.strokeStyle,
            roughness: element.roughness,
            opacity: element.opacity,
            angle: element.angle,
            groupIds: element.groupIds,
            frameId: element.frameId,
            roundness: element.roundness,
            link: element.link,
            locked: element.locked,
            seed: element.seed,
          }),
        );
      }
    }
  }

  return didChange ? nextElements : null;
};
