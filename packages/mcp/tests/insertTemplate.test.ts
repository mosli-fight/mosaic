import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { listTemplates } from "../src/templates.js";
import { runInsertTemplate } from "../src/writeTools.js";

import type { OwnerIdentity } from "../src/config.js";
import type { BoardRow, Database } from "../src/db.js";

/**
 * Tests for `insert_template`.
 *
 * The tool's promise is that it inserts *the repo's own template*, so the
 * assertions are about what the catalogue says and what the gallery's builder
 * produces — not about a copy of the data made here. The catalogue is loaded
 * by the tool itself, which is also what these tests exercise: if the lazy
 * import were broken, every one of them would fail on the first call.
 */

const boardId = "11111111-1111-4111-8111-111111111111";

const owner: OwnerIdentity = { kind: "user", userId: "user-123" };

const row = (overrides: Partial<BoardRow> = {}): BoardRow => ({
  id: boardId,
  name: "Workshop",
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

type StoredElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frameId?: string | null;
  containerId?: string;
  boundElements?: { type: string; id: string }[];
  startBinding?: { elementId: string };
  endBinding?: { elementId: string };
};

const stored = (state: { scene: string | null }) =>
  JSON.parse(state.scene as string) as {
    elements: StoredElement[];
    files: Record<string, unknown>;
  };

const input = (overrides: Record<string, unknown> = {}) => ({
  boardId,
  expectedSceneVersion: 3,
  template: "kanban-board",
  ...overrides,
});

describe("runInsertTemplate", () => {
  it("inserts a template by id", async () => {
    const { db, state } = fakeDb({ scene: null });

    const result = await runInsertTemplate(db, owner, DEFAULT_OPTIONS, input());

    expect(result.elementIds.length).toBeGreaterThan(0);
    expect(result.board.sceneVersion).toBe(4);
    expect(stored(state).elements.length).toBe(result.elementIds.length);
    expect(result.message).toContain("Kanban Board");
  });

  it("inserts a template by name, case-insensitively", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runInsertTemplate(
      db,
      owner,
      DEFAULT_OPTIONS,
      input({ template: "kanban board" }),
    );

    expect(stored(state).elements.length).toBeGreaterThan(0);
  });

  it("inserts a diagram example", async () => {
    const { db } = fakeDb({ scene: null });

    const result = await runInsertTemplate(
      db,
      owner,
      DEFAULT_OPTIONS,
      input({ template: "erd-blog" }),
    );

    expect(result.elementIds.length).toBeGreaterThan(0);
    expect(result.message).toContain("Blog Entity Relationship Diagram");
  });

  it("refuses an unknown template with suggestions", async () => {
    const { db } = fakeDb({ scene: null });

    await expect(
      runInsertTemplate(
        db,
        owner,
        DEFAULT_OPTIONS,
        input({ template: "nope" }),
      ),
    ).rejects.toThrow(/No template with id or name "nope"/);
  });

  it("suggests templates whose name contains what was typed", async () => {
    const { db } = fakeDb({ scene: null });

    await expect(
      runInsertTemplate(
        db,
        owner,
        DEFAULT_OPTIONS,
        input({ template: "kanban" }),
      ),
    ).rejects.toThrow(/kanban-board/);
  });

  it("gives every element an id no element on the board has", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runInsertTemplate(db, owner, DEFAULT_OPTIONS, input());

    const ids = stored(state).elements.map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the references inside the template intact after renumbering", async () => {
    const { db, state } = fakeDb({ scene: null });

    // The kanban board has frames and bound labels; inserting it twice makes
    // the second insert collide with the first, which is what forces the
    // renumbering path.
    await runInsertTemplate(db, owner, DEFAULT_OPTIONS, input());
    await runInsertTemplate(
      db,
      owner,
      DEFAULT_OPTIONS,
      input({ expectedSceneVersion: 4 }),
    );

    const elements = stored(state).elements;
    const ids = new Set(elements.map((element) => element.id));

    expect(ids.size).toBe(elements.length);

    for (const element of elements) {
      if (element.frameId) {
        expect(ids.has(element.frameId)).toBe(true);
      }
      if (element.containerId) {
        expect(ids.has(element.containerId)).toBe(true);
      }
      for (const bound of element.boundElements ?? []) {
        expect(ids.has(bound.id)).toBe(true);
      }
      if (element.startBinding) {
        expect(ids.has(element.startBinding.elementId)).toBe(true);
      }
      if (element.endBinding) {
        expect(ids.has(element.endBinding.elementId)).toBe(true);
      }
    }
  });

  it("places a template to the right of existing work", async () => {
    const handDrawn = {
      id: "hand-1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };

    const { db, state } = fakeDb({
      scene: JSON.stringify({
        elements: [handDrawn],
        appState: {},
        files: {},
      }),
    });

    await runInsertTemplate(db, owner, DEFAULT_OPTIONS, input());

    const inserted = stored(state).elements.filter(
      (element) => element.id !== "hand-1",
    );
    const minX = Math.min(...inserted.map((element) => element.x));

    expect(minX).toBeGreaterThanOrEqual(180);
  });

  it("places a template at the requested corner", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runInsertTemplate(
      db,
      owner,
      DEFAULT_OPTIONS,
      input({ x: 1000, y: 2000 }),
    );

    const inserted = stored(state).elements;
    expect(Math.min(...inserted.map((element) => element.x))).toBe(1000);
    expect(Math.min(...inserted.map((element) => element.y))).toBe(2000);
  });

  it("leaves hand-drawn elements untouched", async () => {
    const handDrawn = {
      id: "hand-1",
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };

    const { db, state } = fakeDb({
      scene: JSON.stringify({
        elements: [handDrawn],
        appState: {},
        files: {},
      }),
    });

    await runInsertTemplate(db, owner, DEFAULT_OPTIONS, input());

    expect(
      stored(state).elements.find((element) => element.id === "hand-1"),
    ).toMatchObject({ x: 400, y: 400 });
  });

  it("refuses a stale scene_version", async () => {
    const { db } = fakeDb({ scene: null });

    await expect(
      runInsertTemplate(
        db,
        owner,
        DEFAULT_OPTIONS,
        input({ expectedSceneVersion: 2 }),
      ),
    ).rejects.toThrow(/scene_version 3, but this call expected 2/);
  });

  it("refuses a board the caller does not own", async () => {
    const { db, calls } = fakeDb({ scene: null, present: false });

    await expect(
      runInsertTemplate(db, owner, DEFAULT_OPTIONS, input()),
    ).rejects.toThrow(/No board with id/);

    expect(calls[0].text).toContain("user_id");
    expect(calls[0].params).toContain("user-123");
  });

  it("lists every template the repo ships", async () => {
    const templates = await listTemplates();

    expect(templates.length).toBe(32 + 61);
    expect(templates.filter((entry) => entry.kind === "board").length).toBe(32);
    expect(templates.filter((entry) => entry.kind === "diagram").length).toBe(
      61,
    );
    // every entry has a real name, not a locale key
    expect(templates.every((entry) => !entry.name.includes("."))).toBe(true);
  });
});
