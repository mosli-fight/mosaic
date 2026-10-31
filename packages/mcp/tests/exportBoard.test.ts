import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { runExportBoard } from "../src/exportBoard.js";

import type { OwnerIdentity } from "../src/config.js";
import type { BoardRow, Database } from "../src/db.js";

/**
 * Tests for `export_board`.
 *
 * The tool's promise is that it returns *the board's own picture* — the same
 * one the app's export dialog would produce — and not a re-drawing of it. So
 * the assertions are about the document that comes back: it is SVG, it has a
 * viewBox sized to the content, it carries the elements, and it is refused
 * when the board is not the caller's or is larger than the cap.
 *
 * PNG is asserted to be *refused with an explanation*, because that is the
 * documented behaviour: a silent fallback to SVG under a `format: "png"`
 * request would hand the caller a file their tooling cannot open.
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
  scene_bytes: 1024,
  scene: null,
  ...overrides,
});

/** A rectangle, as the editor stores one. */
const rectangle = (overrides: Record<string, unknown> = {}) => ({
  id: "rect-1",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
  ...overrides,
});

const sceneWith = (elements: unknown[], appState: unknown = {}) =>
  JSON.stringify({ elements, appState, files: {} });

/**
 * A database that answers the one `SELECT` this tool makes.
 *
 * `present: false` is how "the board is not the caller's" is modelled: the
 * owner scope is in the `WHERE`, so a foreign board is simply no row.
 */
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

describe("runExportBoard", () => {
  it("returns an SVG document sized to the board's content", async () => {
    const db = fakeDb({ scene: sceneWith([rectangle()]) });

    const result = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
    });

    expect(result.format).toBe("svg");
    expect(result.content.startsWith("<?xml")).toBe(true);
    expect(result.content).toContain("<svg");
    expect(result.content).toContain("</svg>");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.bytes).toBe(Buffer.byteLength(result.content, "utf8"));
    expect(result.message).toContain("SVG");
  });

  it("includes the board's elements in the picture", async () => {
    const db = fakeDb({
      scene: sceneWith([rectangle({ backgroundColor: "#a5d8ff" })]),
    });

    const result = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
    });

    // The fill is the element's, so the element was rendered rather than
    // merely counted.
    expect(result.content).toContain("#a5d8ff");
  });

  it("pads the picture by the requested amount", async () => {
    const db = fakeDb({ scene: sceneWith([rectangle()]) });

    const tight = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
      padding: 0,
    });
    const loose = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
      padding: 40,
    });

    expect(loose.width).toBe(tight.width + 80);
    expect(loose.height).toBe(tight.height + 80);
  });

  it("leaves the background out when asked to", async () => {
    const db = fakeDb({
      scene: sceneWith([rectangle()], { viewBackgroundColor: "#f8f9fa" }),
    });

    const withBackground = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
    });
    const without = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
      background: false,
    });

    expect(withBackground.content).toContain("#f8f9fa");
    expect(without.content).not.toContain("#f8f9fa");
  });

  it("exports an empty board rather than failing", async () => {
    const db = fakeDb({ scene: null });

    const result = await runExportBoard(db, owner, DEFAULT_OPTIONS, {
      boardId,
    });

    expect(result.content).toContain("<svg");
    expect(result.width).toBeGreaterThan(0);
  });

  it("refuses a board the caller does not own", async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const db = fakeDb({ scene: null, present: false, calls });

    await expect(
      runExportBoard(db, owner, DEFAULT_OPTIONS, { boardId }),
    ).rejects.toThrow(/No board with id/);

    // The scope is in the statement, not applied afterwards: a foreign board
    // must be invisible to the query, not filtered out of its result.
    expect(calls[0].text).toContain("user_id");
    expect(calls[0].params).toContain("user-123");
  });

  it("refuses PNG with an explanation rather than a schema error", async () => {
    const db = fakeDb({ scene: sceneWith([rectangle()]) });

    await expect(
      runExportBoard(db, owner, DEFAULT_OPTIONS, { boardId, format: "png" }),
    ).rejects.toThrow(/PNG export is not available/);
  });

  it("refuses a scene larger than it will parse", async () => {
    const db = fakeDb({ scene: sceneWith([rectangle()]) });

    await expect(
      runExportBoard(
        db,
        owner,
        { ...DEFAULT_OPTIONS, maxSceneBytes: 10 },
        {
          boardId,
        },
      ),
    ).rejects.toThrow(/MOSAIC_MCP_MAX_SCENE_BYTES/);
  });

  it("refuses an export larger than the export cap", async () => {
    const db = fakeDb({ scene: sceneWith([rectangle()]) });

    await expect(
      runExportBoard(
        db,
        owner,
        { ...DEFAULT_OPTIONS, maxExportBytes: 10 },
        {
          boardId,
        },
      ),
    ).rejects.toThrow(/MOSAIC_MCP_MAX_EXPORT_BYTES/);
  });

  it("refuses a scene it cannot parse, rather than exporting an empty board", async () => {
    // "This board is broken" must not be reported as "this board is blank".
    const db = fakeDb({ scene: "{ not json" });

    await expect(
      runExportBoard(db, owner, DEFAULT_OPTIONS, { boardId }),
    ).rejects.toThrow(/not valid JSON/);
  });
});
