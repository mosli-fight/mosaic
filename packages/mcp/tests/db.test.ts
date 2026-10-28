import { describe, expect, it } from "vitest";

import {
  escapeLike,
  getBoard,
  listBoards,
  listBoardsWithScenes,
  searchBoardNames,
  toBoardMeta,
} from "../src/db.js";

import type { BoardListRow, BoardRow, Database } from "../src/db.js";

/**
 * Tests for the query layer.
 *
 * There is no database here. Each test asserts the SQL text and parameters the
 * module would send, which is where the two properties that matter live:
 *
 * - **every** query is owner-scoped, and
 * - no listing ever selects `scene`.
 *
 * A behavioural test against a real database would prove those only for the
 * rows it happened to contain; reading the statement proves them for all rows.
 */

type Call = { text: string; params: unknown[] };

/** A database handle that records calls and answers with a supplied function. */
const recordingDb = (respond: (call: Call) => unknown[] = () => []) => {
  const calls: Call[] = [];
  const db: Database = {
    query: async (text, params = []) => {
      const call = { text, params };
      calls.push(call);
      return respond(call);
    },
  };
  return { db, calls };
};

const row = (overrides: Partial<BoardListRow> = {}): BoardListRow => ({
  id: "board-1",
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
  ...overrides,
});

const user = { kind: "user", userId: "user-123" } as const;
const guest = { kind: "guest", ownerUid: "uid-456" } as const;

const baseList = { limit: 20, offset: 0 };

describe("listBoards", () => {
  it("scopes the query to the owner", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, baseList);

    for (const call of calls) {
      expect(call.text).toContain("b.user_id = $1");
      expect(call.params[0]).toBe("user-123");
    }
  });

  it("scopes a guest with the anonymous predicate", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, guest, baseList);

    for (const call of calls) {
      expect(call.text).toContain("b.owner_uid = $1 AND b.user_id IS NULL");
      expect(call.params[0]).toBe("uid-456");
    }
  });

  it("never selects the scene or the thumbnail", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, baseList);

    for (const call of calls) {
      expect(call.text).not.toMatch(/\bb\.scene\b/);
      expect(call.text).not.toMatch(/thumbnail/i);
    }
  });

  it("excludes trashed boards by default", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, baseList);

    for (const call of calls) {
      expect(call.text).toContain("b.trashed_at IS NULL");
    }
  });

  it("includes trashed boards when asked", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, { ...baseList, includeTrashed: true });

    for (const call of calls) {
      expect(call.text).not.toContain("b.trashed_at IS NULL");
    }
  });

  it("orders by most recently used", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, baseList);

    const page = calls.find((call) => call.text.includes("LIMIT"));
    expect(page?.text).toContain(
      "ORDER BY COALESCE(b.last_opened_at, b.updated_at) DESC, b.id",
    );
  });

  it("numbers the page placeholders after the filters", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, {
      ...baseList,
      folderId: "folder-1",
      limit: 5,
      offset: 10,
    });

    const page = calls.find((call) => call.text.includes("LIMIT"));
    // owner ($1), folder ($2), then limit ($3) and offset ($4).
    expect(page?.text).toContain("b.folder_id = $2");
    expect(page?.text).toContain("LIMIT $3 OFFSET $4");
    expect(page?.params).toEqual(["user-123", "folder-1", 5, 10]);
  });

  it("filters to unfiled boards", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, { ...baseList, unfiledOnly: true });

    const page = calls.find((call) => call.text.includes("LIMIT"));
    expect(page?.text).toContain("b.folder_id IS NULL");
    expect(page?.params).toEqual(["user-123", 20, 0]);
  });

  it("prefers an explicit folder over unfiled", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoards(db, user, {
      ...baseList,
      folderId: "folder-1",
      unfiledOnly: true,
    });

    for (const call of calls) {
      expect(call.text).not.toContain("b.folder_id IS NULL");
    }
  });

  it("returns the total from the count query, not the page length", async () => {
    const { db } = recordingDb((call) =>
      call.text.startsWith("SELECT count(*)") ? [{ total: 137 }] : [row()],
    );

    const result = await listBoards(db, user, baseList);

    expect(result.total).toBe(137);
    expect(result.boards).toHaveLength(1);
  });

  it("maps rows to board metadata", async () => {
    const { db } = recordingDb((call) =>
      call.text.startsWith("SELECT count(*)") ? [{ total: 1 }] : [row()],
    );

    const result = await listBoards(db, user, baseList);

    expect(result.boards[0]).toEqual({
      id: "board-1",
      name: "Architecture",
      folderId: null,
      folderName: null,
      favorite: false,
      trashed: false,
      sceneVersion: 3,
      createdAt: Date.parse("2026-01-01T00:00:00Z"),
      updatedAt: Date.parse("2026-01-02T00:00:00Z"),
      lastOpenedAt: null,
      sceneBytes: 2048,
    });
  });
});

describe("getBoard", () => {
  it("scopes by id and owner", async () => {
    const { db, calls } = recordingDb(() => []);

    await getBoard(db, user, "board-1");

    expect(calls[0].text).toContain("WHERE b.id = $1 AND b.user_id = $2");
    expect(calls[0].params).toEqual(["board-1", "user-123"]);
  });

  it("scopes a guest by owner uid and excludes claimed boards", async () => {
    const { db, calls } = recordingDb(() => []);

    await getBoard(db, guest, "board-1");

    expect(calls[0].text).toContain(
      "WHERE b.id = $1 AND b.owner_uid = $2 AND b.user_id IS NULL",
    );
    expect(calls[0].params).toEqual(["board-1", "uid-456"]);
  });

  it("selects the scene, because it is the one call that needs it", async () => {
    const { db, calls } = recordingDb(() => []);

    await getBoard(db, user, "board-1");

    expect(calls[0].text).toContain("b.scene");
  });

  it("returns null when the board is not the caller's", async () => {
    const { db } = recordingDb(() => []);

    expect(await getBoard(db, user, "board-1")).toBeNull();
  });

  it("returns the row when it exists", async () => {
    const stored: BoardRow = { ...row(), scene: '{"elements":[]}' };
    const { db } = recordingDb(() => [stored]);

    expect(await getBoard(db, user, "board-1")).toBe(stored);
  });
});

describe("listBoardsWithScenes", () => {
  it("scopes by owner and excludes the trash", async () => {
    const { db, calls } = recordingDb(() => []);

    await listBoardsWithScenes(db, user);

    expect(calls[0].text).toContain("b.user_id = $1");
    expect(calls[0].text).toContain("b.trashed_at IS NULL");
    expect(calls[0].text).toContain("b.scene");
    expect(calls[0].params).toEqual(["user-123"]);
  });
});

describe("searchBoardNames", () => {
  it("scopes by owner and bounds the result", async () => {
    const { db, calls } = recordingDb(() => []);

    await searchBoardNames(db, user, "roadmap", 10);

    expect(calls[0].text).toContain("b.name ILIKE $1");
    expect(calls[0].text).toContain("b.user_id = $2");
    expect(calls[0].text).toContain("LIMIT $3");
    expect(calls[0].params).toEqual(["%roadmap%", "user-123", 10]);
  });

  it("escapes LIKE wildcards in the term", async () => {
    const { db, calls } = recordingDb(() => []);

    await searchBoardNames(db, user, "50%_off", 10);

    expect(calls[0].params[0]).toBe("%50\\%\\_off%");
  });

  it("never selects the scene", async () => {
    const { db, calls } = recordingDb(() => []);

    await searchBoardNames(db, user, "x", 10);

    expect(calls[0].text).not.toMatch(/\bb\.scene\b/);
  });
});

describe("escapeLike", () => {
  it("escapes percent, underscore and backslash", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("roadmap q3")).toBe("roadmap q3");
  });
});

describe("toBoardMeta", () => {
  it("marks a board trashed when trashed_at is set", () => {
    expect(toBoardMeta(row({ trashed_at: new Date() })).trashed).toBe(true);
  });

  it("treats a missing folder name as null", () => {
    const meta = toBoardMeta(
      row({ folder_id: "f1", folder_name: undefined as never }),
    );
    expect(meta.folderId).toBe("f1");
    expect(meta.folderName).toBeNull();
  });

  it("maps an unparseable timestamp to null rather than NaN", () => {
    const meta = toBoardMeta(row({ updated_at: "not a date" }));
    expect(meta.updatedAt).toBeNull();
  });

  it("passes through a numeric timestamp", () => {
    expect(toBoardMeta(row({ updated_at: 1_700_000_000_000 })).updatedAt).toBe(
      1_700_000_000_000,
    );
  });

  it("treats a null scene size as null", () => {
    expect(toBoardMeta(row({ scene_bytes: null })).sceneBytes).toBeNull();
  });
});
