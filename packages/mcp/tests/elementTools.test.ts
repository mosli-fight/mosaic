import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { ToolError } from "../src/tools.js";
import {
  runAddElement,
  runDeleteElement,
  runMoveElement,
  runUpdateElement,
} from "../src/writeTools.js";

import type { BoardRow, Database } from "../src/db.js";
import type { AddElementToolInput } from "../src/schemas.js";

/**
 * Tests for the element write tools.
 *
 * The scene is the interesting part here, so the fake database stores a real
 * scene string and answers a write by returning the row the tool asked for.
 * That lets a test assert on the *stored scene* — which is what a person
 * opening the board actually sees — rather than only on the SQL.
 */

type Call = { text: string; params: unknown[] };

const boardId = "11111111-1111-4111-8111-111111111111";

const sceneOf = (elements: unknown[]) =>
  JSON.stringify({
    elements,
    appState: { viewBackgroundColor: "#fff" },
    files: {},
  });

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

/**
 * A database holding one board.
 *
 * `scene` is mutated by the fake `UPDATE`, so a test can read back what was
 * written without re-parsing the parameters by hand.
 */
const fakeDb = (initial: {
  scene: string | null;
  sceneVersion?: number;
  present?: boolean;
}) => {
  const calls: Call[] = [];
  const state = {
    scene: initial.scene,
    sceneVersion: initial.sceneVersion ?? 3,
  };

  const db: Database = {
    query: async (text, params = []) => {
      calls.push({ text, params });

      if (text.startsWith("SELECT")) {
        if (initial.present === false) {
          return [];
        }
        return [
          row({
            scene: state.scene,
            scene_version: state.sceneVersion,
            scene_bytes: state.scene ? Buffer.byteLength(state.scene) : null,
          }),
        ];
      }

      if (text.startsWith("UPDATE boards")) {
        const [scene, sceneBytes, , expected] = params as [
          string,
          number,
          string,
          number,
        ];
        if (expected !== state.sceneVersion) {
          return [];
        }
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

const storedElements = (state: { scene: string | null }) =>
  JSON.parse(state.scene as string).elements as Record<string, unknown>[];

const addInput = (
  element: AddElementToolInput["element"],
  overrides: Partial<AddElementToolInput> = {},
): AddElementToolInput => ({
  boardId,
  expectedSceneVersion: 3,
  element,
  ...overrides,
});

describe("runAddElement", () => {
  it("adds a rectangle to an empty board and bumps the version", async () => {
    const { db, state } = fakeDb({ scene: null });

    const result = await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({ type: "rectangle", x: 10, y: 20, width: 100, height: 50 }),
    );

    expect(result.elementIds).toHaveLength(1);
    expect(result.board.sceneVersion).toBe(4);

    const elements = storedElements(state);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      isDeleted: false,
    });
    expect(elements[0].id).toBe(result.elementIds[0]);
  });

  it("keeps the elements already on the board", async () => {
    const existing = { id: "keep-me", type: "ellipse", x: 0, y: 0 };
    const { db, state } = fakeDb({ scene: sceneOf([existing]) });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({ type: "rectangle", x: 1, y: 1, width: 10, height: 10 }),
    );

    const elements = storedElements(state);
    expect(elements).toHaveLength(2);
    expect(elements[0]).toMatchObject(existing);
  });

  it("preserves document keys it does not understand", async () => {
    const { db, state } = fakeDb({
      scene: JSON.stringify({
        elements: [],
        appState: { viewBackgroundColor: "#fff", gridSize: 20 },
        files: { "file-1": { id: "file-1" } },
        somethingNewer: { keep: true },
      }),
    });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
    );

    const document = JSON.parse(state.scene as string);
    expect(document.somethingNewer).toEqual({ keep: true });
    expect(document.appState).toEqual({
      viewBackgroundColor: "#fff",
      gridSize: 20,
    });
    expect(document.files).toEqual({ "file-1": { id: "file-1" } });
  });

  it("drops appState.collaborators, which cannot survive JSON", async () => {
    const { db, state } = fakeDb({
      scene: JSON.stringify({
        elements: [],
        appState: { collaborators: {} },
        files: {},
      }),
    });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
    );

    expect(JSON.parse(state.scene as string).appState).not.toHaveProperty(
      "collaborators",
    );
  });

  it("adds a sticky note together with its bound label", async () => {
    const { db, state } = fakeDb({ scene: null });

    const result = await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({
        type: "stickynote",
        x: 0,
        y: 0,
        text: "Ship the thing",
      }),
    );

    const elements = storedElements(state);
    expect(elements).toHaveLength(2);
    expect(result.elementIds).toHaveLength(2);

    const note = elements.find((element) => element.type === "stickynote")!;
    const label = elements.find((element) => element.type === "text")!;

    expect(label.containerId).toBe(note.id);
    expect(note.boundElements).toEqual([{ type: "text", id: label.id }]);
    expect(label.originalText).toBe("Ship the thing");
  });

  it("shrinks the label before it grows the note", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({
        type: "stickynote",
        x: 0,
        y: 0,
        width: 250,
        text: "line one\nline two\nline three\nline four\nline five",
      }),
    );

    const elements = storedElements(state);
    const note = elements.find((element) => element.type === "stickynote")!;
    const label = elements.find((element) => element.type === "text")!;

    // `getStickyNoteLayout` fits the text to the note before it grows the
    // note, so a body this size stays inside the base height.
    expect(note.height).toBe(250);
    expect(label.height as number).toBeLessThan(250);
  });

  it("grows a sticky note when the body cannot fit at the minimum font", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({
        type: "stickynote",
        x: 0,
        y: 0,
        width: 250,
        // Long enough that even the minimum font size overflows the base
        // height, which is the only case that makes the note grow.
        text: Array.from(
          { length: 20 },
          (_, index) => `line ${index} of a fairly long body that wraps`,
        ).join("\n"),
      }),
    );

    const note = storedElements(state).find(
      (element) => element.type === "stickynote",
    )!;
    expect(note.height as number).toBeGreaterThan(250);
  });

  it("adds a frame with a name", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({
        type: "frame",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        name: "Overview",
      }),
    );

    expect(storedElements(state)[0]).toMatchObject({
      type: "frame",
      name: "Overview",
    });
  });

  it("adds an arrow whose size comes from its points", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({
        type: "arrow",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: [
          [0, 0],
          [100, 40],
        ],
      }),
    );

    const arrow = storedElements(state)[0];
    expect(arrow.type).toBe("arrow");
    expect(arrow.width).toBe(100);
    expect(arrow.height).toBe(40);
    expect(arrow.points).toEqual([
      [0, 0],
      [100, 40],
    ]);
  });

  it("measures a text element so its box matches its content", async () => {
    const { db, state } = fakeDb({ scene: null });

    await runAddElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      addInput({ type: "text", x: 0, y: 0, text: "Hello" }),
    );

    const text = storedElements(state)[0];
    expect(text.width as number).toBeGreaterThan(0);
    expect(text.height as number).toBeGreaterThan(0);
    expect(text.originalText).toBe("Hello");
  });

  it("refuses a board that is not the caller's", async () => {
    const { db, calls } = fakeDb({ scene: null, present: false });

    await expect(
      runAddElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
      ),
    ).rejects.toThrow(/No board with id/);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("scopes the read and the write to the owner", async () => {
    const { db, calls } = fakeDb({ scene: null });

    await runAddElement(
      db,
      { kind: "guest", ownerUid: "uid-456" },
      DEFAULT_OPTIONS,
      addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
    );

    const read = calls.find((call) => call.text.startsWith("SELECT"));
    const write = calls.find((call) => call.text.startsWith("UPDATE"));

    expect(read?.text).toContain("b.owner_uid = $2 AND b.user_id IS NULL");
    expect(write?.text).toContain("b.owner_uid = $5 AND b.user_id IS NULL");
  });

  it("refuses a stale scene_version and writes nothing", async () => {
    const { db, calls } = fakeDb({ scene: null, sceneVersion: 9 });

    await expect(
      runAddElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
      ),
    ).rejects.toThrow(/scene_version 9.*expected 3/s);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("reports a write that lost a race rather than claiming success", async () => {
    // The read sees version 3, the UPDATE matches nothing: another writer
    // landed in between.
    const db: Database = {
      query: async (text) =>
        text.startsWith("SELECT")
          ? [row({ scene: null, scene_version: 3 })]
          : [],
    };

    await expect(
      runAddElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
      ),
    ).rejects.toThrow(/changed while this call was being prepared/);
  });

  it("refuses a corrupt scene instead of replacing it", async () => {
    const { db, calls } = fakeDb({ scene: "{not json" });

    await expect(
      runAddElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        addInput({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
      ),
    ).rejects.toBeInstanceOf(ToolError);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("refuses a scene that would exceed the size cap", async () => {
    const { db, calls } = fakeDb({ scene: sceneOf([]) });
    const options = { ...DEFAULT_OPTIONS, maxSceneBytes: 100 };

    await expect(
      runAddElement(
        db,
        { kind: "user", userId: "user-123" },
        options,
        addInput({ type: "text", x: 0, y: 0, text: "x".repeat(500) }),
      ),
    ).rejects.toThrow(/above the 100-byte cap/);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });
});

describe("runUpdateElement", () => {
  const existing = {
    id: "rect-1",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
  };

  it("changes the fields it is given and leaves the rest", async () => {
    const { db, state } = fakeDb({ scene: sceneOf([existing]) });

    await runUpdateElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      {
        boardId,
        elementId: "rect-1",
        expectedSceneVersion: 3,
        changes: { x: 50, strokeColor: "#ff0000" },
      },
    );

    expect(storedElements(state)[0]).toMatchObject({
      x: 50,
      y: 0,
      width: 10,
      height: 10,
      strokeColor: "#ff0000",
    });
  });

  it("bumps the element's version so the editor sees a change", async () => {
    const { db, state } = fakeDb({ scene: sceneOf([existing]) });

    await runUpdateElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      {
        boardId,
        elementId: "rect-1",
        expectedSceneVersion: 3,
        changes: { x: 1 },
      },
    );

    expect(storedElements(state)[0].version as number).toBeGreaterThan(1);
  });

  it("refuses text on an element that has none", async () => {
    const { db, calls } = fakeDb({ scene: sceneOf([existing]) });

    await expect(
      runUpdateElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        {
          boardId,
          elementId: "rect-1",
          expectedSceneVersion: 3,
          changes: { text: "nope" },
        },
      ),
    ).rejects.toThrow(/has no text/);

    expect(calls.some((call) => call.text.startsWith("UPDATE"))).toBe(false);
  });

  it("refuses a name on an element that is not a frame", async () => {
    const { db } = fakeDb({ scene: sceneOf([existing]) });

    await expect(
      runUpdateElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        {
          boardId,
          elementId: "rect-1",
          expectedSceneVersion: 3,
          changes: { name: "nope" },
        },
      ),
    ).rejects.toThrow(/has no name/);
  });

  it("renames a frame", async () => {
    const frame = { ...existing, id: "frame-1", type: "frame", name: "Old" };
    const { db, state } = fakeDb({ scene: sceneOf([frame]) });

    await runUpdateElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      {
        boardId,
        elementId: "frame-1",
        expectedSceneVersion: 3,
        changes: { name: "New" },
      },
    );

    expect(storedElements(state)[0].name).toBe("New");
    // The editor decides an element changed by its version, so a rename that
    // left `version` alone would not repaint a board that is already open.
    expect(storedElements(state)[0].version as number).toBeGreaterThan(1);
  });

  it("re-fits a sticky note around its new text", async () => {
    const note = {
      id: "note-1",
      type: "stickynote",
      x: 0,
      y: 0,
      width: 250,
      height: 250,
      baseHeight: 250,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: [{ type: "text", id: "label-1" }],
      tags: [],
    };
    const label = {
      id: "label-1",
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: "short",
      originalText: "short",
      fontSize: 28,
      baseFontSize: 28,
      lineHeight: 1.25,
      fontFamily: 2,
      containerId: "note-1",
      textAlign: "center",
      verticalAlign: "middle",
      autoResize: true,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };
    const { db, state } = fakeDb({ scene: sceneOf([note, label]) });

    await runUpdateElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      {
        boardId,
        elementId: "note-1",
        expectedSceneVersion: 3,
        changes: { text: "a much longer body\nwith several lines\nin it" },
      },
    );

    const elements = storedElements(state);
    const storedLabel = elements.find((element) => element.id === "label-1")!;
    const storedNote = elements.find((element) => element.id === "note-1")!;

    expect(storedLabel.originalText).toContain("a much longer body");
    expect(storedNote.height as number).toBeGreaterThanOrEqual(250);
  });

  it("updates a free text element and re-measures it", async () => {
    const text = {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      text: "hi",
      originalText: "hi",
      fontSize: 20,
      lineHeight: 1.25,
      fontFamily: 2,
      textAlign: "left",
      verticalAlign: "top",
      autoResize: true,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };
    const { db, state } = fakeDb({ scene: sceneOf([text]) });

    await runUpdateElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      {
        boardId,
        elementId: "text-1",
        expectedSceneVersion: 3,
        changes: { text: "a considerably longer sentence" },
      },
    );

    const stored = storedElements(state)[0];
    expect(stored.originalText).toBe("a considerably longer sentence");
    expect(stored.width as number).toBeGreaterThan(50);
  });

  it("refuses an element id that is not on the board", async () => {
    const { db } = fakeDb({ scene: sceneOf([existing]) });

    await expect(
      runUpdateElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        {
          boardId,
          elementId: "ghost",
          expectedSceneVersion: 3,
          changes: { x: 1 },
        },
      ),
    ).rejects.toThrow(/No element with id ghost/);
  });

  it("refuses an element that is already deleted", async () => {
    const deleted = { ...existing, isDeleted: true };
    const { db } = fakeDb({ scene: sceneOf([deleted]) });

    await expect(
      runUpdateElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        {
          boardId,
          elementId: "rect-1",
          expectedSceneVersion: 3,
          changes: { x: 1 },
        },
      ),
    ).rejects.toThrow(/has been deleted/);
  });
});

describe("runMoveElement", () => {
  it("moves the element and leaves its size alone", async () => {
    const existing = {
      id: "rect-1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 20,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };
    const { db, state } = fakeDb({ scene: sceneOf([existing]) });

    await runMoveElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      { boardId, elementId: "rect-1", expectedSceneVersion: 3, x: 100, y: 200 },
    );

    expect(storedElements(state)[0]).toMatchObject({
      x: 100,
      y: 200,
      width: 10,
      height: 20,
    });
  });

  it("refuses a stale version", async () => {
    const { db } = fakeDb({ scene: sceneOf([]), sceneVersion: 7 });

    await expect(
      runMoveElement(
        db,
        { kind: "user", userId: "user-123" },
        DEFAULT_OPTIONS,
        { boardId, elementId: "rect-1", expectedSceneVersion: 3, x: 1, y: 1 },
      ),
    ).rejects.toThrow(/scene_version 7/);
  });
});

describe("runDeleteElement", () => {
  it("marks the element deleted rather than splicing it out", async () => {
    const existing = {
      id: "rect-1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };
    const { db, state } = fakeDb({ scene: sceneOf([existing]) });

    await runDeleteElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      { boardId, elementId: "rect-1", expectedSceneVersion: 3 },
    );

    const elements = storedElements(state);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ id: "rect-1", isDeleted: true });
  });

  it("leaves the other elements untouched", async () => {
    const keep = {
      id: "rect-2",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    };
    const remove = { ...keep, id: "rect-1" };
    const { db, state } = fakeDb({ scene: sceneOf([remove, keep]) });

    await runDeleteElement(
      db,
      { kind: "user", userId: "user-123" },
      DEFAULT_OPTIONS,
      { boardId, elementId: "rect-1", expectedSceneVersion: 3 },
    );

    const elements = storedElements(state);
    expect(elements.find((element) => element.id === "rect-2")).toMatchObject({
      isDeleted: false,
    });
  });
});
