import { describe, expect, it } from "vitest";

import { newElement, newTextElement } from "@excalidraw/element";

import { layoutDiagram } from "../components/diagram/layout";
import { parseDiagram } from "../components/diagram/parser";
import {
  buildDiagramElements,
  findGroupFrame,
  getDiagramTag,
  getNodeLabelFromCanvas,
  isDiagramElement,
  nodeLabelText,
  reconcileDiagram,
  resolveIconGlyph,
  resolveNodeColor,
} from "../components/diagram/scene";

import type { DiagramType } from "../components/diagram/types";

/**
 * What the code becomes on the board.
 *
 * The reconciliation is the part that has to be conservative: it may replace
 * what the pane drew last time, and nothing else. These tests hold it to
 * that, and to keeping element ids stable so an update is an update rather
 * than a delete and a re-create.
 */

const build = (code: string, type: DiagramType = "flowchart") => {
  const { model, errors } = parseDiagram(code, type);

  expect(errors).toEqual([]);

  return { model, layout: layoutDiagram(model, type) };
};

const elementsFor = (code: string, type: DiagramType = "flowchart") => {
  const { model, layout } = build(code, type);

  return buildDiagramElements(model, layout, type);
};

/** a shape drawn by hand, as a person would leave it on the board */
const handDrawn = (label: string) =>
  newElement({
    type: "rectangle",
    x: 900,
    y: 900,
    width: 120,
    height: 60,
    strokeColor: "#000000",
    backgroundColor: "transparent",
  });

const nodeElements = (elements: ReturnType<typeof elementsFor>) =>
  elements.filter((element) => getDiagramTag(element)?.diagramRole === "node");

describe("buildDiagramElements", () => {
  it("makes a shape and a bound label for each node", () => {
    const elements = elementsFor("A\nB");

    expect(nodeElements(elements)).toHaveLength(2);
    expect(
      elements.filter(
        (element) => getDiagramTag(element)?.diagramRole === "label",
      ),
    ).toHaveLength(2);
  });

  it("tags every element it makes", () => {
    const elements = elementsFor("A > B");

    expect(elements.length).toBeGreaterThan(0);
    expect(elements.every(isDiagramElement)).toBe(true);
  });

  it("tags a node with its slug", () => {
    const elements = elementsFor("API Gateway");

    expect(getDiagramTag(nodeElements(elements)[0])?.diagramNode).toBe(
      "api-gateway",
    );
  });

  it("binds each arrow to the shapes at its ends", () => {
    const elements = elementsFor("A > B");
    const arrow = elements.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge",
    )!;
    const shapes = nodeElements(elements);
    const shapeIds = shapes.map((shape) => shape.id);

    expect(arrow.type).toBe("arrow");

    const arrowElement = arrow as typeof arrow & {
      startBinding?: { elementId: string };
      endBinding?: { elementId: string };
    };

    expect(shapeIds).toContain(arrowElement.startBinding?.elementId);
    expect(shapeIds).toContain(arrowElement.endBinding?.elementId);

    for (const shape of shapes) {
      expect(shape.boundElements?.some((entry) => entry.id === arrow.id)).toBe(
        true,
      );
    }
  });

  it("gives a two-way edge an arrowhead at both ends", () => {
    const elements = elementsFor("A <> B");
    const arrow = elements.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge",
    ) as { startArrowhead: string | null; endArrowhead: string | null };

    expect(arrow.startArrowhead).toBe("arrow");
    expect(arrow.endArrowhead).toBe("arrow");
  });

  it("makes a frame for a group and puts its members inside", () => {
    const elements = elementsFor("Backend {\n  Auth\n  Database\n}");
    const frame = findGroupFrame(elements, "backend");

    expect(frame).not.toBeNull();

    for (const shape of nodeElements(elements)) {
      expect(shape.frameId).toBe(frame!.id);
    }
  });

  it("draws a decision as a diamond and a start as an ellipse", () => {
    const elements = elementsFor("Start\nValid?\nSave");
    const shapes = nodeElements(elements);

    expect(shapes[0].type).toBe("ellipse");
    expect(shapes[1].type).toBe("diamond");
    expect(shapes[2].type).toBe("rectangle");
  });

  it("honours an explicit shape attribute", () => {
    const elements = elementsFor("Cache [shape: ellipse]", "architecture");

    expect(nodeElements(elements)[0].type).toBe("ellipse");
  });

  it("puts a table's fields in its label", () => {
    const elements = elementsFor("users: id, name, email", "erd");
    const label = elements.find(
      (element) => getDiagramTag(element)?.diagramRole === "label",
    ) as { originalText: string };

    expect(label.originalText).toBe("users\n\nid\nname\nemail");
  });

  it("draws an edge's label on the arrow, bound to it", () => {
    const elements = elementsFor("Client > Server: request");
    const arrow = elements.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge",
    )!;
    const label = elements.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge-label",
    ) as { id: string; originalText: string; containerId?: string };

    expect(label.originalText).toBe("request");
    expect(label.containerId).toBe(arrow.id);
    expect(arrow.boundElements?.some((entry) => entry.id === label.id)).toBe(
      true,
    );
  });

  it("draws no label for an edge without one", () => {
    const elements = elementsFor("Client > Server");

    expect(
      elements.some(
        (element) => getDiagramTag(element)?.diagramRole === "edge-label",
      ),
    ).toBe(false);
  });

  it("draws a lifeline for every participant of a sequence", () => {
    const elements = elementsFor("A > B\nB > A", "sequence");
    const lifelines = elements.filter(
      (element) => getDiagramTag(element)?.diagramRole === "lifeline",
    );

    expect(lifelines).toHaveLength(2);
  });

  it("uses the element ids it is told to reuse", () => {
    const { model, layout } = build("A");
    const reuse = new Map([["node:a", "kept-node-id"]]);
    const elements = buildDiagramElements(model, layout, "flowchart", reuse);

    expect(nodeElements(elements)[0].id).toBe("kept-node-id");
  });
});

describe("nodeLabelText", () => {
  it("keeps a plain label as it is", () => {
    expect(nodeLabelText("Login", [], "flowchart")).toBe("Login");
  });

  it("puts fields under the table name", () => {
    expect(nodeLabelText("users", ["id", "name"], "erd")).toBe(
      "users\n\nid\nname",
    );
  });

  it("does not add fields to a non-ERD node", () => {
    expect(nodeLabelText("users", ["id"], "flowchart")).toBe("users");
  });
});

describe("resolveNodeColor", () => {
  it("uses the named color", () => {
    const blue = resolveNodeColor("blue");

    expect(blue.background).not.toBe(resolveNodeColor(undefined).background);
    expect(blue.stroke).not.toBe(resolveNodeColor(undefined).stroke);
  });

  it("falls back for an unknown color rather than guessing", () => {
    expect(resolveNodeColor("chartreuse")).toEqual(resolveNodeColor(undefined));
  });

  it("takes a hex color as given", () => {
    expect(resolveNodeColor("#ff0000").stroke).toBe("#ff0000");
  });
});

describe("resolveIconGlyph", () => {
  it("finds a known icon", () => {
    expect(resolveIconGlyph("server")).toBeTruthy();
    expect(resolveIconGlyph("SERVER")).toBe(resolveIconGlyph("server"));
  });

  it("returns null for an unknown icon", () => {
    expect(resolveIconGlyph("frobnicator")).toBeNull();
    expect(resolveIconGlyph(undefined)).toBeNull();
  });
});

describe("reconcileDiagram", () => {
  it("adds the diagram to an empty board", () => {
    const { model, layout } = build("A > B");
    const elements = reconcileDiagram([], model, layout, "flowchart");

    expect(nodeElements(elements)).toHaveLength(2);
  });

  it("leaves hand-drawn elements exactly where they were", () => {
    const drawn = handDrawn("mine");
    const { model, layout } = build("A > B");
    const elements = reconcileDiagram([drawn], model, layout, "flowchart");

    expect(elements[0]).toBe(drawn);
    expect(elements.filter((element) => element.id === drawn.id)).toHaveLength(
      1,
    );
  });

  it("updates an element in place instead of duplicating it", () => {
    const first = build("A > B");
    const before = reconcileDiagram([], first.model, first.layout, "flowchart");

    const second = build("A > B\nB > C");
    const after = reconcileDiagram(
      before,
      second.model,
      second.layout,
      "flowchart",
    );

    const aBefore = nodeElements(before).find(
      (element) => getDiagramTag(element)?.diagramNode === "a",
    )!;
    const aAfter = nodeElements(after).find(
      (element) => getDiagramTag(element)?.diagramNode === "a",
    )!;

    expect(aAfter.id).toBe(aBefore.id);
    expect(after.filter((element) => element.id === aBefore.id)).toHaveLength(
      1,
    );
  });

  it("moves an element when the layout moves it", () => {
    const first = build("A");
    const before = reconcileDiagram([], first.model, first.layout, "flowchart");

    const second = build("X > A");
    const after = reconcileDiagram(
      before,
      second.model,
      second.layout,
      "flowchart",
    );

    const aBefore = nodeElements(before).find(
      (element) => getDiagramTag(element)?.diagramNode === "a",
    )!;
    const aAfter = nodeElements(after).find(
      (element) => getDiagramTag(element)?.diagramNode === "a",
    )!;

    expect(aAfter.x).not.toBe(aBefore.x);
  });

  it("removes an element whose node is gone", () => {
    const first = build("A\nB");
    const before = reconcileDiagram([], first.model, first.layout, "flowchart");

    const second = build("A");
    const after = reconcileDiagram(
      before,
      second.model,
      second.layout,
      "flowchart",
    );

    expect(
      after.some((element) => getDiagramTag(element)?.diagramNode === "b"),
    ).toBe(false);
    expect(
      after.some((element) => getDiagramTag(element)?.diagramNode === "a"),
    ).toBe(true);
  });

  it("removes the frame when its group is gone", () => {
    const first = build("Backend {\n  Auth\n}");
    const before = reconcileDiagram([], first.model, first.layout, "flowchart");

    expect(findGroupFrame(before, "backend")).not.toBeNull();

    const second = build("Auth");
    const after = reconcileDiagram(
      before,
      second.model,
      second.layout,
      "flowchart",
    );

    expect(findGroupFrame(after, "backend")).toBeNull();
  });

  it("keeps a renamed node's element, and its arrows still bind to it", () => {
    const first = build("A > B");
    const before = reconcileDiagram([], first.model, first.layout, "flowchart");

    const aBefore = nodeElements(before).find(
      (element) => getDiagramTag(element)?.diagramNode === "a",
    )!;

    const second = build("Alpha > B");
    const after = reconcileDiagram(
      before,
      second.model,
      second.layout,
      "flowchart",
      {
        renamedFrom: new Map([["alpha", "a"]]),
      },
    );

    const aAfter = nodeElements(after).find(
      (element) => getDiagramTag(element)?.diagramNode === "alpha",
    )!;
    const arrow = after.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge",
    ) as { startBinding?: { elementId: string } };

    expect(aAfter.id).toBe(aBefore.id);
    expect(arrow.startBinding?.elementId).toBe(aBefore.id);
  });

  it("does not touch a hand-drawn element when the diagram is emptied", () => {
    const drawn = handDrawn("mine");
    const first = build("A");
    const before = reconcileDiagram(
      [drawn],
      first.model,
      first.layout,
      "flowchart",
    );

    const empty = build("");
    const after = reconcileDiagram(
      before,
      empty.model,
      empty.layout,
      "flowchart",
    );

    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(drawn.id);
  });

  it("keeps an edge's label element across a re-parse", () => {
    const first = build("Client > Server: request");
    const before = reconcileDiagram([], first.model, first.layout, "flowchart");

    const labelBefore = before.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge-label",
    )!;

    const second = build("Client > Server: request");
    const after = reconcileDiagram(
      before,
      second.model,
      second.layout,
      "flowchart",
    );

    const labelAfter = after.find(
      (element) => getDiagramTag(element)?.diagramRole === "edge-label",
    )!;

    expect(labelAfter.id).toBe(labelBefore.id);
  });

  it("is stable when run twice on the same code", () => {
    const { model, layout } = build("A > B\nBackend {\n  C\n}");
    const once = reconcileDiagram([], model, layout, "flowchart");
    const twice = reconcileDiagram(once, model, layout, "flowchart");

    expect(twice.map((element) => element.id).sort()).toEqual(
      once.map((element) => element.id).sort(),
    );
  });
});

describe("getNodeLabelFromCanvas", () => {
  it("reads what the person typed, not the wrapped text", () => {
    const elements = elementsFor("A");
    const shape = nodeElements(elements)[0];
    const labelId = shape.boundElements?.find(
      (entry) => entry.type === "text",
    )?.id;
    const label = elements.find((element) => element.id === labelId)!;

    const edited = {
      ...label,
      text: "Something\nwrapped",
      originalText: "Something wrapped",
    };

    const next = elements.map((element) =>
      element.id === label.id ? edited : element,
    );

    expect(getNodeLabelFromCanvas(shape, next)).toBe("Something wrapped");
  });

  it("returns null for a shape with no label", () => {
    expect(getNodeLabelFromCanvas(handDrawn("x"), [])).toBeNull();
  });

  it("returns null when the label is not a text element", () => {
    const shape = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const bound = newTextElement({
      x: 0,
      y: 0,
      text: "x",
      originalText: "x",
      fontSize: 16,
      fontFamily: 1,
    });

    const withBinding = {
      ...shape,
      boundElements: [{ type: "text" as const, id: bound.id }],
    };

    expect(
      getNodeLabelFromCanvas(withBinding, [{ ...bound, type: "arrow" } as any]),
    ).toBe(null);
  });
});
