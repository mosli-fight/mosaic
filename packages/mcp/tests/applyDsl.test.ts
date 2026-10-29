import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { renderDiagram } from "../src/diagram.js";
import { runApplyDsl } from "../src/writeTools.js";

import type { OwnerIdentity } from "../src/config.js";
import type { BoardRow, Database } from "../src/db.js";

/**
 * Tests for `apply_dsl`.
 *
 * The property that separates this tool from `insert_diagram` is *in-place*
 * updating, and it is not observable from the result alone — the result says
 * "applied", which `insert_diagram` also says. So these tests look at the
 * stored scene: the node element's id before and after, the diagram's
 * position, and whether the hand-drawn rectangle is still there.
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

/** A database that keeps the scene it is given, so a test can read it back. */
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
  originalText?: string;
  customData?: { diagramNode?: string };
  startBinding?: { elementId: string };
  endBinding?: { elementId: string };
};

const stored = (state: { scene: string | null }) =>
  JSON.parse(state.scene as string) as {
    elements: StoredElement[];
    files: Record<string, unknown>;
  };

/** The scene an earlier `insert_diagram` would have left behind. */
const sceneWithDiagram = (code: string, type: "architecture" | "flowchart") => {
  const rendered = renderDiagram([], code, type);
  return JSON.stringify({
    elements: rendered.elements,
    appState: {},
    files: rendered.files,
  });
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

/** The node element for a label, from a stored scene. */
const nodeFor = (state: { scene: string | null }, node: string) =>
  stored(state).elements.find(
    (element) =>
      element.type !== "text" &&
      element.customData?.diagramNode === node &&
      !element.originalText,
  );

describe("runApplyDsl", () => {
  it("updates a node in place, keeping its element id", async () => {
    const { db, state } = fakeDb({
      scene: sceneWithDiagram("API\nDatabase\nAPI > Database", "architecture"),
    });

    const before = nodeFor(state, "api")!;
    expect(before).toBeDefined();

    const result = await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 3,
      type: "architecture",
      code: "API\nDatabase\nCache\nAPI > Database",
    });

    const after = nodeFor(state, "api")!;

    expect(after.id).toBe(before.id);
    expect(result.board.sceneVersion).toBe(4);
    expect(nodeFor(state, "cache")).toBeDefined();
  });

  it("leaves the diagram where it was", async () => {
    const { db, state } = fakeDb({
      scene: sceneWithDiagram("API\nDatabase\nAPI > Database", "architecture"),
    });

    const xBefore = nodeFor(state, "api")!.type
      ? (JSON.parse(state.scene as string).elements as {
          id: string;
          x: number;
        }[])
      : [];

    const beforeX = xBefore.find(
      (element) => element.id === nodeFor(state, "api")!.id,
    )!.x;

    await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 3,
      type: "architecture",
      code: "API\nDatabase\nCache\nAPI > Database",
    });

    const afterX = (
      JSON.parse(state.scene as string).elements as { id: string; x: number }[]
    ).find((element) => element.id === nodeFor(state, "api")!.id)!.x;

    expect(afterX).toBe(beforeX);
  });

  it("is idempotent: applying the same code twice changes nothing", async () => {
    const code = "API\nDatabase\nAPI > Database";
    const { db, state } = fakeDb({
      scene: sceneWithDiagram(code, "architecture"),
    });

    await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 3,
      type: "architecture",
      code,
    });

    const once = JSON.stringify(
      stored(state).elements.map((element) => ({
        id: element.id,
        type: element.type,
      })),
    );
    const xOnce = (stored(state).elements as unknown as { x: number }[]).map(
      (element) => element.x,
    );

    await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 4,
      type: "architecture",
      code,
    });

    const twice = JSON.stringify(
      stored(state).elements.map((element) => ({
        id: element.id,
        type: element.type,
      })),
    );
    const xTwice = (stored(state).elements as unknown as { x: number }[]).map(
      (element) => element.x,
    );

    expect(twice).toBe(once);
    expect(xTwice).toEqual(xOnce);
  });

  it("leaves hand-drawn elements untouched", async () => {
    const scene = JSON.parse(
      sceneWithDiagram("API\nDatabase\nAPI > Database", "architecture"),
    ) as { elements: unknown[]; appState: unknown; files: unknown };

    const { db, state } = fakeDb({
      scene: JSON.stringify({
        ...scene,
        elements: [...scene.elements, handDrawn],
      }),
    });

    await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 3,
      type: "architecture",
      code: "API\nCache\nAPI > Cache",
    });

    expect(
      stored(state).elements.some((element) => element.id === "hand-1"),
    ).toBe(true);
  });

  it("refuses a stale scene_version", async () => {
    const { db } = fakeDb({ scene: null });

    await expect(
      runApplyDsl(db, owner, DEFAULT_OPTIONS, {
        boardId,
        expectedSceneVersion: 2,
        type: "architecture",
        code: "API",
      }),
    ).rejects.toThrow(/scene_version 3, but this call expected 2/);
  });

  it("refuses a board the caller does not own", async () => {
    const { db, calls } = fakeDb({ scene: null, present: false });

    await expect(
      runApplyDsl(db, owner, DEFAULT_OPTIONS, {
        boardId,
        expectedSceneVersion: 3,
        type: "architecture",
        code: "API",
      }),
    ).rejects.toThrow(/No board with id/);

    expect(calls[0].text).toContain("user_id");
    expect(calls[0].params).toContain("user-123");
  });

  it("refuses code that does not parse", async () => {
    const { db } = fakeDb({ scene: null });

    await expect(
      runApplyDsl(db, owner, DEFAULT_OPTIONS, {
        boardId,
        expectedSceneVersion: 3,
        type: "architecture",
        code: "API >",
      }),
    ).rejects.toThrow(/could not be parsed/);
  });

  it("places a first diagram to the right of existing work", async () => {
    const { db, state } = fakeDb({
      scene: JSON.stringify({
        elements: [handDrawn],
        appState: {},
        files: {},
      }),
    });

    await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 3,
      type: "architecture",
      code: "API",
    });

    const node = nodeFor(state, "api")!;
    const x = (node as unknown as { x: number }).x;

    // the hand-drawn rectangle ends at 5100, so the diagram starts past it
    expect(x).toBeGreaterThan(5100);
  });

  it("round-trips with insert_diagram: the same code describes the same diagram", async () => {
    const code = "API\nDatabase\nAPI > Database";
    const { db, state } = fakeDb({
      scene: sceneWithDiagram(code, "architecture"),
    });

    await runApplyDsl(db, owner, DEFAULT_OPTIONS, {
      boardId,
      expectedSceneVersion: 3,
      type: "architecture",
      code,
    });

    const inserted = renderDiagram([], code, "architecture");

    const shape = (element: StoredElement) =>
      `${element.type}|${element.customData?.diagramNode ?? ""}|${
        element.startBinding ? "from" : ""
      }${element.endBinding ? "to" : ""}`;

    expect(stored(state).elements.map(shape).sort()).toEqual(
      inserted.elements.map((element) => shape(element as never)).sort(),
    );
  });
});
