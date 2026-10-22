import { describe, expect, it } from "vitest";

import { layoutDiagram } from "../components/diagram/layout";
import { parseDiagram } from "../components/diagram/parser";

import type { DiagramType } from "../components/diagram/types";

/**
 * Where a diagram's things go.
 *
 * The layout is deterministic on purpose: the same code always produces the
 * same rectangles. That is what lets a re-parse move an element instead of
 * duplicating it, so these tests pin the shape of the result rather than
 * exact pixels.
 */

const layoutOf = (code: string, type: DiagramType = "flowchart") => {
  const { model, errors } = parseDiagram(code, type);

  expect(errors).toEqual([]);

  return layoutDiagram(model, type);
};

describe("layoutDiagram: layered layout", () => {
  it("puts a node with no incoming edge in the first column", () => {
    const layout = layoutOf("Start");

    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].x).toBeGreaterThanOrEqual(0);
  });

  it("puts the target of an edge to the right of its source", () => {
    const layout = layoutOf("A > B");
    const a = layout.nodes.find((node) => node.id === "a")!;
    const b = layout.nodes.find((node) => node.id === "b")!;

    expect(b.x).toBeGreaterThan(a.x + a.width);
  });

  it("gives every node in a column the same x", () => {
    const layout = layoutOf("A > C\nB > C");
    const a = layout.nodes.find((node) => node.id === "a")!;
    const b = layout.nodes.find((node) => node.id === "b")!;

    expect(a.x).toBe(b.x);
  });

  it("stacks the nodes of a column without overlapping them", () => {
    const layout = layoutOf("A > C\nB > C");
    const a = layout.nodes.find((node) => node.id === "a")!;
    const b = layout.nodes.find((node) => node.id === "b")!;

    const [upper, lower] = a.y < b.y ? [a, b] : [b, a];

    expect(lower.y).toBeGreaterThanOrEqual(upper.y + upper.height);
  });

  it("puts a chain in successive columns", () => {
    const layout = layoutOf("A > B\nB > C");
    const a = layout.nodes.find((node) => node.id === "a")!;
    const b = layout.nodes.find((node) => node.id === "b")!;
    const c = layout.nodes.find((node) => node.id === "c")!;

    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
  });

  it("terminates on a cycle", () => {
    const layout = layoutOf("A > B\nB > C\nC > A");

    expect(layout.nodes).toHaveLength(3);
  });

  it("is deterministic", () => {
    const code = "A > B\nA > C\nB > D\nC > D\nGroup {\n  E\n}";

    expect(layoutOf(code)).toEqual(layoutOf(code));
  });

  it("sizes a box to hold a long label", () => {
    const short = layoutOf("A");
    const long = layoutOf("A really quite long label that needs room");

    expect(long.nodes[0].width).toBeGreaterThan(short.nodes[0].width);
  });

  it("runs an arrow from the source's right edge to the target's left", () => {
    const layout = layoutOf("A > B");
    const a = layout.nodes.find((node) => node.id === "a")!;
    const b = layout.nodes.find((node) => node.id === "b")!;
    const edge = layout.edges[0];

    expect(edge.start.x).toBeCloseTo(a.x + a.width);
    expect(edge.start.y).toBeCloseTo(a.y + a.height / 2);
    expect(edge.end.x).toBeCloseTo(b.x);
    expect(edge.end.y).toBeCloseTo(b.y + b.height / 2);
  });
});

describe("layoutDiagram: groups", () => {
  it("wraps a group's members", () => {
    const layout = layoutOf("Backend {\n  Auth\n  Database\n}");

    expect(layout.groups).toHaveLength(1);

    const group = layout.groups[0];

    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(group.x);
      expect(node.y).toBeGreaterThanOrEqual(group.y);
      expect(node.x + node.width).toBeLessThanOrEqual(group.x + group.width);
      expect(node.y + node.height).toBeLessThanOrEqual(group.y + group.height);
    }
  });

  it("wraps a nested group inside its parent", () => {
    const layout = layoutOf("Outer {\n  Inner {\n    Node\n  }\n}");

    const outer = layout.groups.find((group) => group.id === "outer")!;
    const inner = layout.groups.find((group) => group.id === "outer-inner")!;

    expect(inner.x).toBeGreaterThanOrEqual(outer.x);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y);
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
    expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
  });

  it("does not put a group's title on top of its first member", () => {
    const layout = layoutOf("Backend {\n  Auth\n}");

    const group = layout.groups[0];
    const node = layout.nodes[0];

    expect(node.y).toBeGreaterThan(group.y);
  });
});

describe("layoutDiagram: ERD", () => {
  it("makes a table card taller for each field", () => {
    const one = layoutOf("users: id", "erd");
    const three = layoutOf("users: id, name, email", "erd");

    expect(three.nodes[0].height).toBeGreaterThan(one.nodes[0].height);
  });

  it("makes a table card wider for a long field", () => {
    const short = layoutOf("t: id", "erd");
    const long = layoutOf("t: an_extremely_long_column_name_here", "erd");

    expect(long.nodes[0].width).toBeGreaterThan(short.nodes[0].width);
  });
});

describe("layoutDiagram: sequence", () => {
  it("puts the participants across the top, in code order", () => {
    const layout = layoutOf("Browser > Server\nServer > Database", "sequence");

    expect(layout.participants.map((participant) => participant.id)).toEqual([
      "browser",
      "server",
      "database",
    ]);

    const xs = layout.participants.map((participant) => participant.x);

    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);

    // all on one row
    expect(
      new Set(layout.participants.map((participant) => participant.y)).size,
    ).toBe(1);
  });

  it("puts the messages at increasing y, in code order", () => {
    const layout = layoutOf(
      "Browser > Server\nServer > Database\nDatabase > Server",
      "sequence",
    );

    const ys = layout.edges.map((edge) => edge.start.y);

    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it("draws a message horizontally between the two lifelines", () => {
    const layout = layoutOf("Browser > Server", "sequence");
    const edge = layout.edges[0];

    expect(edge.start.y).toBe(edge.end.y);
    expect(edge.start.x).toBeLessThan(edge.end.x);
  });

  it("runs every lifeline past the last message", () => {
    const layout = layoutOf("A > B\nB > A", "sequence");
    const lastMessageY = Math.max(...layout.edges.map((edge) => edge.start.y));

    for (const participant of layout.participants) {
      expect(
        participant.lifeline.y + participant.lifeline.height,
      ).toBeGreaterThan(lastMessageY);
    }
  });

  it("keeps a participant that takes part in no message", () => {
    const layout = layoutOf("A > B\nObserver", "sequence");

    expect(layout.participants.map((participant) => participant.id)).toContain(
      "observer",
    );
  });
});

describe("layoutDiagram: bounds", () => {
  it("covers every node", () => {
    const layout = layoutOf("A > B\nB > C");
    const bounds = layout.bounds;

    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(bounds.x);
      expect(node.y).toBeGreaterThanOrEqual(bounds.y);
      expect(node.x + node.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(node.y + node.height).toBeLessThanOrEqual(
        bounds.y + bounds.height,
      );
    }
  });

  it("is empty for an empty diagram", () => {
    const layout = layoutOf("");

    expect(layout.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
