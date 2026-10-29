import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { renderDiagram } from "../src/diagram.js";
import { runSceneToDsl } from "../src/sceneToDsl.js";

import type { OwnerIdentity } from "../src/config.js";
import type { BoardRow, Database } from "../src/db.js";

/**
 * Tests for `scene_to_dsl`.
 *
 * The tool is the reverse of `insert_diagram`, so most of these tests are
 * built the same way the forward direction is: render code into elements with
 * the real engine, store that as a scene, and read it back. That is the only
 * way to test the property that matters — that the code which comes out
 * describes the diagram that went in — without hand-writing element JSON that
 * would drift from what the engine actually produces.
 */

const boardId = "11111111-1111-4111-8111-111111111111";

const owner: OwnerIdentity = { kind: "user", userId: "user-123" };

const row = (overrides: Partial<BoardRow> = {}): BoardRow => ({
  id: boardId,
  name: "Architecture",
  folder_id: null,
  folder_name: null,
  favorite: false,
  trashed_at: null,
  scene_version: 3,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
  last_opened_at: null,
  scene_bytes: 2048,
  scene: null,
  ...overrides,
});

const fakeDb = (options: {
  scene: string | null;
  present?: boolean;
  calls?: { text: string; params: unknown[] }[];
}): Database => ({
  query: async (text, params = []) => {
    options.calls?.push({ text, params });
    return options.present === false ? [] : [row({ scene: options.scene })];
  },
});

/** A scene holding the elements the engine makes for some code. */
const sceneFor = (code: string, type: Parameters<typeof renderDiagram>[2]) => {
  const rendered = renderDiagram([], code, type);
  return JSON.stringify({
    elements: rendered.elements,
    appState: {},
    files: rendered.files,
  });
};

const read = async (scene: string | null) =>
  runSceneToDsl(fakeDb({ scene }), owner, DEFAULT_OPTIONS, boardId);

describe("runSceneToDsl", () => {
  it("writes a node per shape and an edge per arrow", async () => {
    const result = await read(
      sceneFor(
        "API server\nDatabase\nAPI server > Database: reads",
        "architecture",
      ),
    );

    expect(result.type).toBe("architecture");
    expect(result.code).toContain("API server");
    expect(result.code).toContain("Database");
    expect(result.code).toContain("API server > Database: reads");
    expect(result.counts.nodes).toBe(2);
    expect(result.counts.edges).toBe(1);
  });

  it("writes attributes only when they are not implied", async () => {
    const result = await read(
      sceneFor(
        "Web App [icon: browser] [color: blue]\nAPI [color: blue]\nWeb App > API",
        "architecture",
      ),
    );

    expect(result.code).toContain("[icon: browser]");
    expect(result.code).toContain("[color: blue]");
    // a rectangle is what an architecture node is by default
    expect(result.code).not.toContain("[shape: rectangle]");
  });

  it("writes a shape the label does not imply", async () => {
    const result = await read(
      sceneFor(
        "Start\nCheck?\nStore [shape: ellipse]\nStart > Check?",
        "flowchart",
      ),
    );

    // "Start" and "Check?" are shaped by their own words, so they carry no
    // attribute; "Store" is drawn as an ellipse only because the code said so.
    expect(result.code).toContain("Start");
    expect(result.code).toContain("Check?");
    expect(result.code).toContain("Store [shape: ellipse]");
  });

  it("writes an ERD's fields after a colon", async () => {
    const result = await read(
      sceneFor(
        "users: id, name, email\norders: id, user_id\nusers > orders",
        "erd",
      ),
    );

    expect(result.type).toBe("erd");
    expect(result.code).toContain("users: id, name, email");
    expect(result.code).toContain("orders: id, user_id");
  });

  it("writes a two-way edge as <>", async () => {
    const result = await read(sceneFor("Browser <> CDN", "architecture"));

    expect(result.code).toContain("<>");
  });

  it("writes a brace group around its members", async () => {
    const result = await read(
      sceneFor("Backend {\n  API\n  DB\n}\nAPI > DB", "architecture"),
    );

    expect(result.code).toContain("Backend {");
    expect(result.code).toContain("}");
    expect(result.counts.groups).toBe(1);
  });

  it("reports hand-drawn elements instead of dropping them", async () => {
    const rendered = renderDiagram([], "API server", "architecture");
    const handDrawn = {
      id: "hand-1",
      type: "rectangle",
      x: 5000,
      y: 5000,
      width: 100,
      height: 100,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };

    const result = await read(
      JSON.stringify({
        elements: [...rendered.elements, handDrawn],
        appState: {},
        files: {},
      }),
    );

    expect(result.skippedCount).toBe(1);
    expect(result.skipped[0]).toMatchObject({ id: "hand-1" });
    expect(result.skipped[0].reason).toMatch(/drawn by hand/);
    expect(result.message).toContain("not in the code");
  });

  it("reports a node whose label the DSL would read as syntax", async () => {
    const rendered = renderDiagram([], "API server", "architecture");
    const shape = rendered.elements.find(
      (element) => element.type === "rectangle",
    )!;
    const label = rendered.elements.find((element) => element.type === "text")!;

    // the person renamed the node on the canvas to something the language
    // cannot express
    const edited = rendered.elements.map((element) =>
      element.id === label.id
        ? { ...element, originalText: "a > b", text: "a > b" }
        : element,
    );

    const result = await read(
      JSON.stringify({ elements: edited, appState: {}, files: {} }),
    );

    expect(result.code).toBe("");
    expect(result.skipped.some((entry) => entry.id === shape.id)).toBe(true);
    expect(
      result.skipped.some((entry) => /reads as an arrow/.test(entry.reason)),
    ).toBe(true);
  });

  it("reports an empty board rather than failing", async () => {
    const result = await read(null);

    expect(result.code).toBe("");
    expect(result.counts.nodes).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/no diagram/);
  });

  it("refuses a board the caller does not own", async () => {
    const calls: { text: string; params: unknown[] }[] = [];

    await expect(
      runSceneToDsl(
        fakeDb({ scene: null, present: false, calls }),
        owner,
        DEFAULT_OPTIONS,
        boardId,
      ),
    ).rejects.toThrow(/No board with id/);

    expect(calls[0].text).toContain("user_id");
    expect(calls[0].params).toContain("user-123");
  });

  it("refuses a scene larger than it will parse", async () => {
    await expect(
      runSceneToDsl(
        fakeDb({ scene: sceneFor("API", "architecture") }),
        owner,
        { ...DEFAULT_OPTIONS, maxSceneBytes: 10 },
        boardId,
      ),
    ).rejects.toThrow(/MOSAIC_MCP_MAX_SCENE_BYTES/);
  });

  it("refuses a scene it cannot parse", async () => {
    await expect(read("{ not json")).rejects.toThrow(/not valid JSON/);
  });

  it("round-trips: the code it writes describes the same diagram", async () => {
    const code = [
      "Web App [icon: browser] [color: blue]",
      "API Gateway [color: violet]",
      "Postgres [icon: database] [color: green] [shape: ellipse]",
      "",
      "Web App > API Gateway",
      "API Gateway > Postgres: reads",
    ].join("\n");

    const result = await read(sceneFor(code, "architecture"));

    // Re-rendering the generated code must produce the same diagram: same
    // node labels, same shapes, same colours, same edges.
    const original = renderDiagram([], code, "architecture");
    const again = renderDiagram([], result.code, result.type);

    const signature = (elements: readonly Record<string, unknown>[]) =>
      elements
        .filter((element) => element.type !== "text")
        .map((element) =>
          [
            element.type,
            element.strokeColor,
            element.backgroundColor,
            element.startBinding ? "bound" : "",
            element.endBinding ? "bound" : "",
          ].join("|"),
        )
        .sort();

    expect(signature(again.elements as never)).toEqual(
      signature(original.elements as never),
    );

    const labels = (elements: readonly Record<string, unknown>[]) =>
      elements
        .filter((element) => element.type === "text")
        .map((element) => element.originalText)
        .sort();

    expect(labels(again.elements as never)).toEqual(
      labels(original.elements as never),
    );
  });

  it("round-trips a sequence diagram", async () => {
    const code = [
      "Browser",
      "Server",
      "Database",
      "",
      "Browser > Server: request",
      "Server > Database: query",
      "Database > Server: rows",
      "Server > Browser: response",
    ].join("\n");

    const result = await read(sceneFor(code, "sequence"));

    expect(result.type).toBe("sequence");
    expect(result.code).toContain("Browser > Server: request");
    expect(result.code).not.toContain("[shape:");
  });
});
