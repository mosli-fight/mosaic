import * as Element from "@excalidraw/element";
import rough from "roughjs/bin/rough";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { renderStaticScene } from "./staticScene";

import type { StaticSceneRenderConfig } from "../scene/types";

/**
 * Regression for the whole canvas going blank after a sticky tag add or a
 * corner resize. The paint loop used to `save()` before rendering an element
 * and `restore()` only on the success path, so one element throwing left the
 * canvas state stack unbalanced — the element's clip leaked into the rest of
 * the frame and every later frame. The loop now restores in a `finally`, so a
 * single bad element costs only its own paint.
 */
describe("renderStaticScene element isolation", () => {
  const createScene = (
    elements: readonly NonDeletedExcalidrawElement[],
  ): StaticSceneRenderConfig => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;

    const elementsMap = new Map(
      elements.map((element) => [element.id, element]),
    );

    return {
      canvas,
      rc: rough.canvas(canvas),
      elementsMap,
      allElementsMap: elementsMap,
      visibleElements: elements,
      scale: 1,
      appState: {
        zoom: { value: 1 as any },
        scrollX: 0,
        scrollY: 0,
        theme: "light",
        gridSize: null,
        gridStep: 1,
        frameRendering: {
          enabled: false,
          clip: false,
          name: false,
          outline: false,
        },
        viewBackgroundColor: "#ffffff",
      } as any,
      renderConfig: {
        canvasBackgroundColor: "#ffffff",
        imageCache: new Map(),
        renderGrid: false,
        isExporting: true,
        embedsValidationStatus: new Map(),
        elementsPendingErasure: new Set(),
        pendingFlowchartNodes: null,
        theme: "light",
      } as any,
    } as StaticSceneRenderConfig;
  };

  const createElement = (id: string, x: number) =>
    ({
      id,
      type: "rectangle",
      x,
      y: 0,
      width: 100,
      height: 100,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      roundness: null,
      seed: 1,
      version: 1,
      versionNonce: 1,
      index: null,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    } as unknown as NonDeletedExcalidrawElement);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps painting the remaining elements when one throws", () => {
    const first = createElement("first", 0);
    const second = createElement("second", 200);
    const config = createScene([first, second]);

    const renderElement = vi.spyOn(Element, "renderElement");
    renderElement.mockImplementation((element) => {
      if (element.id === "first") {
        throw new Error("broken element");
      }
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => renderStaticScene(config)).not.toThrow();

    // the healthy element was still painted
    expect(renderElement.mock.calls.map(([element]) => element.id)).toEqual([
      "first",
      "second",
    ]);
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps the canvas state stack balanced when an element throws", () => {
    const first = createElement("first", 0);
    const second = createElement("second", 200);
    const config = createScene([first, second]);
    const context = config.canvas!.getContext("2d")!;

    const renderElement = vi.spyOn(Element, "renderElement");
    renderElement.mockImplementation((element) => {
      if (element.id === "first") {
        throw new Error("broken element");
      }
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const save = vi.spyOn(context, "save");
    const restore = vi.spyOn(context, "restore");

    renderStaticScene(config);

    // an unbalanced stack leaks the element's clip into the rest of the frame
    // (and into every later frame), which is what blanked the canvas
    expect(save.mock.calls.length).toBe(restore.mock.calls.length);
  });
});
