import { describe, expect, it } from "vitest";

import { newElement } from "@excalidraw/element";

import { getDiagramTag, isDiagramElement } from "../components/diagram/scene";
import {
  DiagramSyncGuard,
  applyCanvasRenames,
  exampleFor,
  findCanvasRenames,
  hasDiagramOnBoard,
  syncCodeToScene,
} from "../components/diagram/sync";

/**
 * The loop between the code and the canvas.
 *
 * Both directions are tested here, because the danger is not either one on
 * its own — it is what happens when one triggers the other. A malformed line
 * must leave the board standing; a rename on the canvas must reach the code
 * without forking the node; and the guard must be able to tell the pane's own
 * writes from a person's.
 */

const nodeShapes = (elements: ReturnType<typeof syncCodeToScene>["elements"]) =>
  elements.filter((element) => getDiagramTag(element)?.diagramRole === "node");

const nodeByKey = (
  elements: ReturnType<typeof syncCodeToScene>["elements"],
  key: string,
) =>
  nodeShapes(elements).find(
    (element) => getDiagramTag(element)?.diagramNode === key,
  )!;

describe("syncCodeToScene", () => {
  it("draws the code", () => {
    const result = syncCodeToScene([], "A > B", "flowchart");

    expect(result.errors).toEqual([]);
    expect(result.hasDiagram).toBe(true);
    expect(nodeShapes(result.elements)).toHaveLength(2);
  });

  it("reports a malformed line and keeps the last good scene", () => {
    const good = syncCodeToScene([], "A > B", "flowchart");
    const broken = syncCodeToScene(good.elements, "A >\nB", "flowchart");

    expect(broken.errors).toHaveLength(1);
    expect(broken.errors[0].line).toBe(1);
    expect(broken.elements).toEqual(good.elements);
    expect(broken.hasDiagram).toBe(false);
  });

  it("never wipes the board on a malformed line", () => {
    const good = syncCodeToScene([], "A > B", "flowchart");
    const broken = syncCodeToScene(good.elements, "}}}}", "flowchart");

    expect(broken.elements).toHaveLength(good.elements.length);
  });

  it("removes what the pane drew when the code is emptied, and nothing else", () => {
    const drawn = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const good = syncCodeToScene([drawn], "A > B", "flowchart");
    const empty = syncCodeToScene(good.elements, "", "flowchart");

    expect(empty.hasDiagram).toBe(false);
    expect(empty.elements).toHaveLength(1);
    expect(empty.elements[0].id).toBe(drawn.id);
  });

  it("leaves hand-drawn elements alone", () => {
    const drawn = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const result = syncCodeToScene([drawn], "A > B", "flowchart");

    expect(result.elements[0].id).toBe(drawn.id);
    expect(result.elements.filter(isDiagramElement)).toHaveLength(
      result.elements.length - 1,
    );
  });

  it("updates in place across a code edit", () => {
    const first = syncCodeToScene([], "A > B", "flowchart");
    const second = syncCodeToScene(first.elements, "A > B\nB > C", "flowchart");

    expect(nodeByKey(second.elements, "a").id).toBe(
      nodeByKey(first.elements, "a").id,
    );
    expect(nodeByKey(second.elements, "b").id).toBe(
      nodeByKey(first.elements, "b").id,
    );
  });

  it("keeps a renamed node's element when told what it was called", () => {
    const first = syncCodeToScene([], "A > B", "flowchart");
    const second = syncCodeToScene(first.elements, "Alpha > B", "flowchart", {
      renamedFrom: new Map([["alpha", "a"]]),
    });

    expect(nodeByKey(second.elements, "alpha").id).toBe(
      nodeByKey(first.elements, "a").id,
    );
  });

  it("switches a diagram from one type to another", () => {
    const flow = syncCodeToScene([], "A > B", "flowchart");
    const sequence = syncCodeToScene(flow.elements, "A > B", "sequence");

    expect(sequence.errors).toEqual([]);
    expect(
      sequence.elements.filter(
        (element) => getDiagramTag(element)?.diagramRole === "lifeline",
      ),
    ).toHaveLength(2);
  });
});

describe("findCanvasRenames", () => {
  /** a scene with one node renamed on the canvas, as the editor would leave it */
  const renameOnCanvas = (
    elements: ReturnType<typeof syncCodeToScene>["elements"],
    nodeKey: string,
    label: string,
  ) => {
    const shape = nodeByKey(elements, nodeKey);
    const labelId = shape.boundElements?.find(
      (entry) => entry.type === "text",
    )!.id;

    return elements.map((element) =>
      element.id === labelId
        ? { ...element, text: label, originalText: label }
        : element,
    );
  };

  it("finds a label edited on the canvas", () => {
    const scene = syncCodeToScene([], "A > B", "flowchart");
    const edited = renameOnCanvas(scene.elements, "a", "Alpha");
    const renames = findCanvasRenames(edited, "A > B", "flowchart");

    expect(renames).toEqual([{ nodeId: "a", label: "Alpha" }]);
  });

  it("finds nothing when the canvas matches the code", () => {
    const scene = syncCodeToScene([], "A > B", "flowchart");

    expect(findCanvasRenames(scene.elements, "A > B", "flowchart")).toEqual([]);
  });

  it("does not mistake wrapping for a rename", () => {
    const scene = syncCodeToScene([], "A very long label", "flowchart");
    const shape = nodeByKey(scene.elements, "a-very-long-label");
    const labelId = shape.boundElements?.find(
      (entry) => entry.type === "text",
    )!.id;

    const wrapped = scene.elements.map((element) =>
      element.id === labelId
        ? {
            ...element,
            text: "A very\nlong label",
            originalText: "A very long label",
          }
        : element,
    );

    expect(
      findCanvasRenames(wrapped, "A very long label", "flowchart"),
    ).toEqual([]);
  });

  it("reads only the name of a table card, not its fields", () => {
    const scene = syncCodeToScene([], "users: id, name", "erd");
    const shape = nodeByKey(scene.elements, "users");
    const labelId = shape.boundElements?.find(
      (entry) => entry.type === "text",
    )!.id;

    const edited = scene.elements.map((element) =>
      element.id === labelId
        ? {
            ...element,
            text: "people\n\nid\nname",
            originalText: "people\n\nid\nname",
          }
        : element,
    );

    expect(findCanvasRenames(edited, "users: id, name", "erd")).toEqual([
      { nodeId: "users", label: "people" },
    ]);
  });

  it("ignores hand-drawn elements", () => {
    const drawn = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    expect(findCanvasRenames([drawn], "A", "flowchart")).toEqual([]);
  });
});

describe("applyCanvasRenames", () => {
  it("writes a rename back into the code", () => {
    const result = applyCanvasRenames(
      "A > B",
      [{ nodeId: "a", label: "Alpha" }],
      "flowchart",
    );

    expect(result).not.toBeNull();
    expect(result!.code).toBe("Alpha > B");
    expect(result!.renamedFrom.get("alpha")).toBe("a");
  });

  it("renames the node's own line and every edge that names it", () => {
    const result = applyCanvasRenames(
      "A\nA > B\nB > A",
      [{ nodeId: "a", label: "Alpha" }],
      "flowchart",
    );

    expect(result!.code).toBe("Alpha\nAlpha > B\nB > Alpha");
  });

  it("applies several renames in one pass", () => {
    const result = applyCanvasRenames(
      "A > B",
      [
        { nodeId: "a", label: "Alpha" },
        { nodeId: "b", label: "Beta" },
      ],
      "flowchart",
    );

    expect(result!.code).toBe("Alpha > Beta");
    expect([...result!.renamedFrom.keys()].sort()).toEqual(["alpha", "beta"]);
  });

  it("returns null when there is nothing to change", () => {
    expect(applyCanvasRenames("A > B", [], "flowchart")).toBe(null);
    expect(
      applyCanvasRenames(
        "A > B",
        [{ nodeId: "nope", label: "X" }],
        "flowchart",
      ),
    ).toBe(null);
  });

  it("round-trips: a canvas rename reaches the code, and the code re-parses to the same node", () => {
    const scene = syncCodeToScene([], "A > B", "flowchart");
    const shape = nodeByKey(scene.elements, "a");
    const labelId = shape.boundElements?.find(
      (entry) => entry.type === "text",
    )!.id;
    const edited = scene.elements.map((element) =>
      element.id === labelId
        ? { ...element, text: "Alpha", originalText: "Alpha" }
        : element,
    );

    const renames = findCanvasRenames(edited, "A > B", "flowchart");
    const applied = applyCanvasRenames("A > B", renames, "flowchart")!;
    const next = syncCodeToScene(scene.elements, applied.code, "flowchart", {
      renamedFrom: applied.renamedFrom,
    });

    expect(applied.code).toBe("Alpha > B");
    expect(nodeByKey(next.elements, "alpha").id).toBe(shape.id);
    expect(nodeShapes(next.elements)).toHaveLength(2);
  });
});

describe("DiagramSyncGuard", () => {
  it("is closed by default", () => {
    expect(new DiagramSyncGuard().isApplying).toBe(false);
  });

  it("is open while the update runs", () => {
    const guard = new DiagramSyncGuard();
    let seen = false;

    guard.run(() => {
      seen = guard.isApplying;
    });

    expect(seen).toBe(true);
    expect(guard.isApplying).toBe(false);
  });

  it("stays open through a nested pass", () => {
    const guard = new DiagramSyncGuard();
    let innerSaw = false;
    let outerSawAfter = false;

    guard.run(() => {
      guard.run(() => {
        innerSaw = guard.isApplying;
      });
      outerSawAfter = guard.isApplying;
    });

    expect(innerSaw).toBe(true);
    expect(outerSawAfter).toBe(true);
    expect(guard.isApplying).toBe(false);
  });

  it("closes even when the update throws", () => {
    const guard = new DiagramSyncGuard();

    expect(() =>
      guard.run(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(guard.isApplying).toBe(false);
  });

  it("returns what the update returned", () => {
    expect(new DiagramSyncGuard().run(() => 42)).toBe(42);
  });
});

describe("examples", () => {
  const types = ["flowchart", "architecture", "erd", "sequence"] as const;

  it("gives every type an example that parses without errors", () => {
    for (const type of types) {
      const result = syncCodeToScene([], exampleFor(type), type);

      expect(result.errors, `${type} example`).toEqual([]);
      expect(result.hasDiagram, `${type} example`).toBe(true);
    }
  });

  it("draws each example without duplicating anything", () => {
    for (const type of types) {
      const first = syncCodeToScene([], exampleFor(type), type);
      const second = syncCodeToScene(first.elements, exampleFor(type), type);

      expect(second.elements.map((element) => element.id).sort()).toEqual(
        first.elements.map((element) => element.id).sort(),
      );
    }
  });
});

describe("hasDiagramOnBoard", () => {
  it("is false for an empty board", () => {
    expect(hasDiagramOnBoard([])).toBe(false);
  });

  it("is false for a board of hand-drawn elements", () => {
    expect(
      hasDiagramOnBoard([
        newElement({ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }),
      ]),
    ).toBe(false);
  });

  it("is true once the pane has drawn", () => {
    const scene = syncCodeToScene([], "A", "flowchart");

    expect(hasDiagramOnBoard(scene.elements)).toBe(true);
  });
});
