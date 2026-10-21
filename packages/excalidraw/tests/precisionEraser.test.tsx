import { pointFrom } from "@excalidraw/math";

import { CaptureUpdateAction, newFreeDrawElement } from "@excalidraw/element";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math/types";
import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import {
  MIN_FREEDRAW_RUN_POINTS,
  PRECISION_ERASER_CURSOR_RADIUS,
  PRECISION_ERASER_MIN_RADIUS,
  getPrecisionEraserRadius,
  splitFreedrawByErasePath,
} from "../eraser/precision";
import { applyPrecisionErase } from "../eraser/precisionEraser";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

const createStroke = (
  points: readonly [number, number][],
  overrides: Partial<ExcalidrawFreeDrawElement> = {},
) =>
  newFreeDrawElement({
    type: "freedraw",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    simulatePressure: true,
    points: points.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
    pressures: points.map(() => 0.5),
    ...overrides,
  });

/** a horizontal stroke from x=0 to x=100 on y=0, one point per unit */
const createHorizontalStroke = (
  overrides: Partial<ExcalidrawFreeDrawElement> = {},
) =>
  createStroke(
    Array.from({ length: 101 }, (_, x) => [x, 0] as [number, number]),
    overrides,
  );

const erasePath = (points: readonly [number, number][]) =>
  points.map(([x, y]) => pointFrom<GlobalPoint>(x, y));

describe("precision eraser: split geometry", () => {
  it("returns null when the path touches nothing", () => {
    const element = createHorizontalStroke();

    expect(splitFreedrawByErasePath(element, erasePath([[50, 50]]), 5)).toBe(
      null,
    );
  });

  it("splits a stroke into two runs when the middle is erased", () => {
    const element = createHorizontalStroke();

    const split = splitFreedrawByErasePath(element, erasePath([[50, 0]]), 5)!;

    expect(split).not.toBe(null);
    expect(split.runs).toHaveLength(2);
    expect(split.erasedCount).toBe(11); // x = 45..55 inclusive

    // the two runs carry the untouched ends of the original stroke
    expect(split.runs[0].points[0]).toEqual([0, 0]);
    expect(split.runs[0].points.at(-1)).toEqual([44, 0]);
    expect(split.runs[1].points[0]).toEqual([56, 0]);
    expect(split.runs[1].points.at(-1)).toEqual([100, 0]);
  });

  it("keeps a single run when only the end of the stroke is erased", () => {
    const element = createHorizontalStroke();

    const split = splitFreedrawByErasePath(element, erasePath([[0, 0]]), 5)!;

    expect(split.runs).toHaveLength(1);
    expect(split.runs[0].points[0]).toEqual([6, 0]);
    expect(split.runs[0].points.at(-1)).toEqual([100, 0]);
  });

  it("produces no runs when the whole stroke is erased", () => {
    const element = createHorizontalStroke();

    const split = splitFreedrawByErasePath(
      element,
      erasePath([
        [0, 0],
        [100, 0],
      ]),
      5,
    )!;

    expect(split.runs).toHaveLength(0);
    expect(split.erasedCount).toBe(101);
  });

  it("drops runs too short to render", () => {
    const element = createStroke([
      [0, 0],
      [40, 0],
    ]);

    // the drag starts just past the first sample, stranding it on its own —
    // a one-point run renders as nothing, so it must not survive as an
    // invisible element
    const split = splitFreedrawByErasePath(
      element,
      erasePath([
        [6, -10],
        [6, 10],
      ]),
      5,
    )!;

    expect(MIN_FREEDRAW_RUN_POINTS).toBe(2);
    expect(split.erasedCount).toBe(2);
    expect(split.runs).toHaveLength(1);
    expect(split.runs[0].points[0][0]).toBeGreaterThan(10);
    expect(split.runs[0].points.at(-1)).toEqual([40, 0]);
  });

  it("splits a sparse stroke crossed between its samples", () => {
    // a fast pen drag samples sparsely — here the visible line runs from
    // x=50 to x=100 with no sample in between, and the eraser crosses it at
    // x=75. Hit-testing only the original samples would erase nothing.
    const element = createStroke([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);

    const split = splitFreedrawByErasePath(
      element,
      erasePath([
        [75, -20],
        [75, 20],
      ]),
      4,
    )!;

    expect(split).not.toBe(null);
    expect(split.erasedCount).toBeGreaterThan(0);
    expect(split.runs).toHaveLength(2);
    expect(split.runs[0].points.at(-1)![0]).toBeLessThan(75);
    expect(split.runs[1].points[0][0]).toBeGreaterThan(75);
  });

  it("still misses a sparse stroke beyond the radius", () => {
    const element = createStroke([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);

    expect(
      splitFreedrawByErasePath(
        element,
        erasePath([
          [75, 10],
          [75, 30],
        ]),
        4,
      ),
    ).toBe(null);
  });

  it("erases along the whole dragged path, not just its endpoints", () => {
    const element = createHorizontalStroke();

    // a diagonal drag crossing the stroke at x=20: only points near x=20 go
    const split = splitFreedrawByErasePath(
      element,
      erasePath([
        [20, -20],
        [20, 20],
      ]),
      2,
    )!;

    expect(split.runs).toHaveLength(2);
    expect(split.runs[0].points.at(-1)).toEqual([17, 0]);
    expect(split.runs[1].points[0]).toEqual([23, 0]);
  });

  it("hit-tests a rotated stroke in scene space", () => {
    // a vertical stroke (x=0, y=0..100) rotated 90° about the center of its
    // own points — (0, 50) — lands along y=50, running from x=50 to x=-50.
    // Hit-testing the raw points would instead look along x=0.
    const element = createStroke(
      Array.from({ length: 21 }, (_, i) => [0, i * 5] as [number, number]),
      { angle: (Math.PI / 2) as ExcalidrawFreeDrawElement["angle"] },
    );

    // where the stroke actually is
    expect(splitFreedrawByErasePath(element, erasePath([[0, 50]]), 5)).not.toBe(
      null,
    );
    // where the unrotated points would have been — must miss
    expect(splitFreedrawByErasePath(element, erasePath([[0, 10]]), 5)).toBe(
      null,
    );
  });

  it("scales the erase radius with zoom, with a floor", () => {
    // the cursor circle keeps its on-screen size: zooming in shrinks the
    // radius in scene terms
    expect(getPrecisionEraserRadius(1)).toBe(PRECISION_ERASER_CURSOR_RADIUS);
    expect(getPrecisionEraserRadius(1.5)).toBeCloseTo(
      PRECISION_ERASER_CURSOR_RADIUS / 1.5,
    );
    // zoomed far out it must not collapse to nothing
    expect(getPrecisionEraserRadius(100)).toBe(PRECISION_ERASER_MIN_RADIUS);
    expect(PRECISION_ERASER_MIN_RADIUS).toBeLessThan(
      PRECISION_ERASER_CURSOR_RADIUS,
    );
  });
});

describe("precision eraser: applying to a scene", () => {
  it("replaces the touched stroke with its surviving runs", () => {
    const element = createHorizontalStroke();

    const next = applyPrecisionErase([element], erasePath([[50, 0]]), 5)!;

    expect(next).toHaveLength(2);
    // the leading run keeps the original element's identity, so its z-order
    // and group membership survive the split
    expect(next[0].id).toBe(element.id);
    expect(next[1].id).not.toBe(element.id);
  });

  it("deletes a stroke whose points were all erased", () => {
    const element = createHorizontalStroke();

    const next = applyPrecisionErase(
      [element],
      erasePath([
        [0, 0],
        [100, 0],
      ]),
      5,
    )!;

    expect(next).toHaveLength(1);
    expect(next[0].isDeleted).toBe(true);
  });

  it("returns null when nothing was touched", () => {
    const element = createHorizontalStroke();

    expect(applyPrecisionErase([element], erasePath([[50, 50]]), 5)).toBe(null);
  });

  it("leaves non-freedraw and locked elements alone", () => {
    const locked = createHorizontalStroke({ locked: true });
    const rectangle = API.createElement({ type: "rectangle", x: 0, y: 0 });

    const next = applyPrecisionErase(
      [locked, rectangle],
      erasePath([[50, 0]]),
      5,
    );

    expect(next).toBe(null);
  });
});

describe("precision eraser: in the editor", () => {
  it("splits a stroke dragged across, as one undoable step", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const element = createHorizontalStroke();
    // committed through the store so the scene is a real history baseline —
    // assigning `h.elements` directly would leave undo with nothing to
    // restore to
    API.updateScene({
      elements: [element],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    act(() => {
      window.h.app.setActiveTool({ type: "eraser" });
      window.h.setState({ precisionEraserActive: true });
    });

    const undoStackBefore = API.getUndoStack().length;

    const mouse = new Pointer("mouse");
    // drag vertically across the middle of the stroke
    mouse.moveTo(50, -20);
    mouse.down();
    mouse.moveTo(50, 20);
    mouse.up();

    const elements = window.h.app.scene.getNonDeletedElements();
    expect(elements).toHaveLength(2);
    // the whole gesture is a single history entry
    expect(API.getUndoStack().length).toBe(undoStackBefore + 1);

    Keyboard.undo();
    expect(window.h.app.scene.getNonDeletedElements()).toHaveLength(1);
  });

  it("splits a sparse stroke dragged across between samples", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // a stroke sampled like a fast real pen drag: no point anywhere near
    // where the eraser will cross (x=75)
    const element = createStroke([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
    API.updateScene({
      elements: [element],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    act(() => {
      window.h.app.setActiveTool({ type: "eraser" });
      window.h.setState({ precisionEraserActive: true });
    });

    const mouse = new Pointer("mouse");
    mouse.moveTo(75, -20);
    mouse.down();
    mouse.moveTo(75, 20);
    mouse.up();

    expect(window.h.app.scene.getNonDeletedElements()).toHaveLength(2);
  });

  it("leaves the stroke untouched when the drag misses it", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const element = createHorizontalStroke();
    API.setElements([element]);

    act(() => {
      window.h.app.setActiveTool({ type: "eraser" });
      window.h.setState({ precisionEraserActive: true });
    });

    const mouse = new Pointer("mouse");
    mouse.moveTo(50, 50);
    mouse.down();
    mouse.moveTo(60, 60);
    mouse.up();

    expect(window.h.app.scene.getNonDeletedElements()).toHaveLength(1);
  });

  it("leaves other strokes and whole-stroke erasing alone", async () => {
    await render(<Excalidraw />);

    const crossed = createHorizontalStroke();
    const elsewhere = createStroke([
      [0, 200],
      [100, 200],
    ]);
    API.setElements([crossed, elsewhere]);

    act(() => {
      window.h.app.setActiveTool({ type: "eraser" });
      window.h.setState({ precisionEraserActive: true });
    });

    const mouse = new Pointer("mouse");
    mouse.moveTo(50, -20);
    mouse.down();
    mouse.moveTo(50, 20);
    mouse.up();

    const ids = window.h.app.scene.getNonDeletedElements().map((el) => el.id);
    // the untouched stroke is still there, whole
    expect(ids).toContain(elsewhere.id);
    // and the crossed one became two
    expect(ids).toContain(crossed.id);
    expect(ids).toHaveLength(3);
  });

  it("erases the whole stroke when the precision mode is off", async () => {
    await render(<Excalidraw />);

    const element = createHorizontalStroke();
    API.setElements([element]);

    act(() => {
      window.h.app.setActiveTool({ type: "eraser" });
      window.h.setState({ precisionEraserActive: false });
    });

    const mouse = new Pointer("mouse");
    mouse.moveTo(50, -20);
    mouse.down();
    mouse.moveTo(50, 20);
    mouse.up();

    // the plain eraser still deletes the entire stroke, not a segment
    expect(window.h.app.scene.getNonDeletedElements()).toHaveLength(0);
  });
});

describe("precision eraser: in the drawing-tools popover", () => {
  const openPopover = async (container: HTMLElement) => {
    fireEvent.click(
      container.querySelector('[data-testid="toolbar-freedraw"]')!,
    );
    await waitFor(() =>
      expect(document.querySelector(".drawing-tools-popover-content")).not.toBe(
        null,
      ),
    );
  };

  const clickOption = (type: string) =>
    fireEvent.click(
      document.querySelector(
        `.drawing-tools-popover-content [data-testid="toolbar-${type}"]`,
      )!,
    );

  it("activates the eraser tool in its precision mode", async () => {
    const { container } = await render(<Excalidraw />);

    await openPopover(container);
    clickOption("precisionEraser");

    expect(window.h.state.activeTool.type).toBe("eraser");
    expect(window.h.state.precisionEraserActive).toBe(true);
  });

  it("switches back to whole-stroke erasing when the plain eraser is picked", async () => {
    const { container } = await render(<Excalidraw />);

    await openPopover(container);
    clickOption("precisionEraser");
    expect(window.h.state.precisionEraserActive).toBe(true);

    clickOption("eraser");
    expect(window.h.state.activeTool.type).toBe("eraser");
    expect(window.h.state.precisionEraserActive).toBe(false);
  });

  it("drops the precision mode when the eraser tool is left", async () => {
    const { container } = await render(<Excalidraw />);

    await openPopover(container);
    clickOption("precisionEraser");
    expect(window.h.state.precisionEraserActive).toBe(true);

    act(() => {
      window.h.app.setActiveTool({ type: "selection" });
    });

    // pressing E later must hand back the plain eraser, not the precision one
    expect(window.h.state.precisionEraserActive).toBe(false);
  });
});
