import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { defaultDiagramOrigin } from "../src/diagram.js";
import { runInsertDiagram } from "../src/writeTools.js";

import type { BoardRow, Database } from "../src/db.js";

/**
 * Tests for `insert_diagram`.
 *
 * The point of this tool is that it *reuses* the diagram engine rather than
 * re-implementing a layout, so these tests check the properties that reuse is
 * supposed to buy: the diagram renders, hand-drawn work survives, the icons
 * bring their files, and a second insert replaces the first rather than
 * stacking on top of it.
 */

const boardId = "11111111-1111-4111-8111-111111111111";

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

const fakeDb = (initial: { scene: string | null; present?: boolean }) => {
  const calls: { text: string; params: unknown[] }[] = [];
  const state = { scene: initial.scene, sceneVersion: 3 };

  const db: Database = {
    query: async (text, params = []) => {
      calls.push({ text, params });

      if (text.startsWith("SELECT")) {
        return initial.present === false
          ? []
          : [
              row({
                scene: state.scene,
                scene_version: state.sceneVersion,
                scene_bytes: state.scene
                  ? Buffer.byteLength(state.scene)
                  : null,
              }),
            ];
      }

      if (text.startsWith("UPDATE boards")) {
        const [scene, sceneBytes] = params as [string, number];
        state.scene = scene;
        state.sceneVersion += 1;
        return [
          row({
            scene,
            scene_version: state.sceneVersion,
            scene_bytes: sceneBytes,
          }),
        ];
      }

      return [];
    },
  };

  return { db, calls, state };
};

const stored = (state: { scene: string | null }) =>
  JSON.parse(state.scene as string) as {
    elements: Record<string, unknown>[];
    files: Record<string, unknown>;
  };

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

const sceneWith = (elements: unknown[]) =>
  JSON.stringify({ elements, appState: {}, files: {} });

const input = (overrides: Record<string, unknown> = {}) => ({
  boardId,
  expectedSceneVersion: 3,
  type: "architecture" as const,
  code: "api: API server\ndb: Database\napi -> db: reads",
  ...overrides,
});

describe("runInsertDiagram", () => {
  it("inserts a diagram and reports what it drew", async () => {
    const { db, state } = fakeDb({ scene: null });

    const result = await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input(),
    );

    expect(result.elementIds.length).toBeGreaterThan(0);
    expect(result.board.sceneVersion).toBe(4);

    const elements = stored(state).elements;
    expect(elements.length).toBe(result.elementIds.length);
    expect(elements.every((element) => element.customData)).toBe(true);
    expect(result.message).toContain("architecture diagram");
  });

  it("keeps hand-drawn elements exactly as they were", async () => {
    const { db, state } = fakeDb({ scene: sceneWith([handDrawn]) });

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input(),
    );

    const elements = stored(state).elements;
    const kept = elements.find((element) => element.id === "hand-1");
    expect(kept).toMatchObject(handDrawn);
  });

  it("places the diagram to the right of existing work", async () => {
    const { db, state } = fakeDb({ scene: sceneWith([handDrawn]) });

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input(),
    );

    const diagram = stored(state).elements.filter(
      (element) => element.id !== "hand-1",
    );
    const left = Math.min(...diagram.map((element) => element.x as number));

    // hand-drawn box ends at x=5100; the diagram starts past it, not on top.
    expect(left).toBeGreaterThanOrEqual(5100);
  });

  it("honours an explicit origin", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input({ x: 1000, y: 2000 }),
    );

    const left = Math.min(
      ...stored(state).elements.map((element) => element.x as number),
    );
    expect(left).toBe(1000);
  });

  it("brings the image files its icons need", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input({ code: "a [icon: kubernetes]: Cluster\nb [icon: postgres]: DB" }),
    );

    const document = stored(state);
    const images = document.elements.filter(
      (element) => element.type === "image",
    );
    expect(images.length).toBeGreaterThan(0);

    for (const image of images) {
      expect(document.files[image.fileId as string]).toBeDefined();
    }
  });

  it("keeps files that were already on the board", async () => {
    const { db, state } = fakeDb({
      scene: JSON.stringify({
        elements: [],
        appState: {},
        files: { "existing-file": { id: "existing-file" } },
      }),
    });

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input(),
    );

    expect(stored(state).files["existing-file"]).toEqual({
      id: "existing-file",
    });
  });

  it("replaces a diagram inserted earlier instead of stacking", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input(),
    );
    const first = stored(state).elements.length;

    await runInsertDiagram(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      input({ expectedSceneVersion: 4 }),
    );

    // The second insert has the same node count, so the scene is the same
    // size: the first diagram was replaced, not added to.
    expect(stored(state).elements.length).toBe(first);
  });

  it("refuses code that does not parse and writes nothing", async () => {
    const { db, calls } = fakeDb({ scene: null });

    await expect(
      runInsertDiagram(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        // An unclosed group: the parser reports it with the line number.
        input({ code: "Frontend {\n  api: API server" }),
      ),
    ).rejects.toThrow(/could not be parsed.*never closed/s);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("refuses code that parses to nothing", async () => {
    const { db, calls } = fakeDb({ scene: null });

    await expect(
      runInsertDiagram(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        input({ code: "   \n\n  " }),
      ),
    ).rejects.toThrow(/no nodes/);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("refuses a stale scene_version", async () => {
    const { db, calls } = fakeDb({ scene: null });

    await expect(
      runInsertDiagram(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        input({ expectedSceneVersion: 1 }),
      ),
    ).rejects.toThrow(/scene_version 3/);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("refuses a board that is not the caller's", async () => {
    const { db } = fakeDb({ scene: null, present: false });

    await expect(
      runInsertDiagram(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        input(),
      ),
    ).rejects.toThrow(/No board with id/);
  });

  it("refuses a scene that would exceed the size cap", async () => {
    const { db, calls } = fakeDb({ scene: null });

    await expect(
      runInsertDiagram(
        db,
        { kind: "user", userId: "user-123" },
        { ...DEFAULT_OPTIONS, maxSceneBytes: 200 },
        input(),
      ),
    ).rejects.toThrow(/above the 200-byte cap/);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });
});

describe("defaultDiagramOrigin", () => {
  it("is the origin on an empty board", () => {
    expect(defaultDiagramOrigin([])).toEqual({ x: 0, y: 0 });
  });

  it("ignores deleted elements", () => {
    const deleted = { ...handDrawn, isDeleted: true };
    expect(defaultDiagramOrigin([deleted as never])).toEqual({ x: 0, y: 0 });
  });

  it("sits to the right of the rightmost element", () => {
    const origin = defaultDiagramOrigin([handDrawn as never]);
    expect(origin.x).toBeGreaterThan(5100);
    expect(origin.y).toBe(5000);
  });
});
