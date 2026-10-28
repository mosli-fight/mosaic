import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { ToolError } from "../src/tools.js";
import {
  assertSceneFits,
  copyName,
  DEFAULT_BOARD_NAME,
  runCreateBoard,
  runDuplicateBoard,
  runRenameBoard,
} from "../src/writeTools.js";

import type { BoardRow, Database } from "../src/db.js";

/**
 * Tests for the board-level write tools.
 *
 * The database is faked at the query level, as in `tools.test.ts`, so each test
 * can assert both the answer *and* the statement that produced it. That pairing
 * is what catches the failure that matters most for a write: an `UPDATE` that
 * looks right but is not scoped to the owner.
 */

type Call = { text: string; params: unknown[] };

const recording = (answer: (call: Call) => unknown[] = () => []) => {
  const calls: Call[] = [];
  const db: Database = {
    query: async (text, params = []) => {
      const call = { text, params };
      calls.push(call);
      return answer(call);
    },
  };
  return { db, calls };
};

const row = (
  overrides: Partial<BoardRow & { thumbnail: string | null }> = {},
): BoardRow & { thumbnail: string | null } => ({
  id: "11111111-1111-4111-8111-111111111111",
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
  thumbnail: null,
  ...overrides,
});

const user = { kind: "user", userId: "user-123" } as const;
const guest = { kind: "guest", ownerUid: "uid-456" } as const;

const boardId = "11111111-1111-4111-8111-111111111111";
const folderId = "22222222-2222-4222-8222-222222222222";

describe("runCreateBoard", () => {
  it("inserts a board scoped to the signed-in owner", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("INSERT INTO boards")
        ? [row({ name: "New board" })]
        : [],
    );

    const result = await runCreateBoard(db, user, { name: "New board" });

    expect(result.board.name).toBe("New board");
    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    expect(insert?.text).toContain("user_id");
    // user id first, then the empty owner uid the API also writes for an account
    expect(insert?.params.slice(0, 2)).toEqual(["user-123", ""]);
    expect(insert?.params[2]).toBe("New board");
  });

  it("inserts a board scoped to a guest with no user id", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("INSERT INTO boards") ? [row()] : [],
    );

    await runCreateBoard(db, guest, {});

    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    expect(insert?.params.slice(0, 2)).toEqual([null, "uid-456"]);
  });

  it("defaults the name when none is given", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("INSERT INTO boards")
        ? [row({ name: DEFAULT_BOARD_NAME })]
        : [],
    );

    const result = await runCreateBoard(db, user, {});

    expect(result.board.name).toBe(DEFAULT_BOARD_NAME);
    expect(DEFAULT_BOARD_NAME).toBe("Untitled board");
    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    expect(insert?.params[2]).toBe("Untitled board");
  });

  it("refuses a folder the caller does not own, and inserts nothing", async () => {
    const { db, calls } = recording(() => []);

    await expect(
      runCreateBoard(db, user, { name: "x", folderId }),
    ).rejects.toBeInstanceOf(ToolError);

    expect(
      calls.some((call) => call.text.startsWith("INSERT INTO boards")),
    ).toBe(false);
  });

  it("checks the folder under the caller's own scope", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("SELECT 1 FROM folders")
        ? [{ "?column?": 1 }]
        : [row()],
    );

    await runCreateBoard(db, user, { name: "x", folderId });

    const check = calls.find((call) =>
      call.text.startsWith("SELECT 1 FROM folders"),
    );
    expect(check?.text).toContain("f.user_id = $2");
    expect(check?.params).toEqual([folderId, "user-123"]);
  });

  it("logs a create activity row after the insert", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("INSERT INTO boards") ? [row()] : [],
    );

    await runCreateBoard(db, user, {});

    const activity = calls.find((call) =>
      call.text.includes("INSERT INTO activity"),
    );
    expect(activity?.params).toContain("create");
  });

  it("does not log activity when the insert fails", async () => {
    const { db, calls } = recording(() => []);

    await expect(runCreateBoard(db, user, {})).rejects.toThrow(/no row/);

    expect(
      calls.some((call) => call.text.includes("INSERT INTO activity")),
    ).toBe(false);
  });
});

describe("runRenameBoard", () => {
  it("scopes the update to the owner", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("UPDATE boards") ? [row({ name: "Renamed" })] : [],
    );

    const result = await runRenameBoard(db, user, { boardId, name: "Renamed" });

    expect(result.board.name).toBe("Renamed");
    const update = calls.find((call) => call.text.startsWith("UPDATE boards"));
    expect(update?.text).toContain("b.user_id = $3");
    expect(update?.params).toContain("user-123");
  });

  it("scopes a guest rename with the anonymous predicate", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("UPDATE boards") ? [row()] : [],
    );

    await runRenameBoard(db, guest, { boardId, name: "x" });

    const update = calls.find((call) => call.text.startsWith("UPDATE boards"));
    expect(update?.text).toContain("b.owner_uid = $3 AND b.user_id IS NULL");
  });

  it("bumps updated_at", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("UPDATE boards") ? [row()] : [],
    );

    await runRenameBoard(db, user, { boardId, name: "x" });

    const update = calls.find((call) => call.text.startsWith("UPDATE boards"));
    expect(update?.text).toContain("updated_at = now()");
  });

  it("reports a missing board as not found, not as forbidden", async () => {
    const { db } = recording(() => []);

    await expect(
      runRenameBoard(db, user, { boardId, name: "x" }),
    ).rejects.toThrow(/No board with id/);
  });

  it("refuses a stale expectedSceneVersion and says what the current one is", async () => {
    const { db } = recording((call) => {
      if (call.text.startsWith("UPDATE boards")) {
        return [];
      }
      // the follow-up read that shapes the error
      return [row({ scene_version: 9 })];
    });

    await expect(
      runRenameBoard(db, user, { boardId, name: "x", expectedSceneVersion: 3 }),
    ).rejects.toThrow(/scene_version 9.*expected 3/s);
  });

  it("applies the version guard to the statement when one is given", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("UPDATE boards") ? [row()] : [],
    );

    await runRenameBoard(db, user, {
      boardId,
      name: "x",
      expectedSceneVersion: 4,
    });

    const update = calls.find((call) => call.text.startsWith("UPDATE boards"));
    expect(update?.text).toContain("b.scene_version = $3");
    expect(update?.params).toEqual(["x", boardId, 4, "user-123"]);
  });

  it("omits the version guard when none is given", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("UPDATE boards") ? [row()] : [],
    );

    await runRenameBoard(db, user, { boardId, name: "x" });

    const update = calls.find((call) => call.text.startsWith("UPDATE boards"));
    // Only the WHERE matters: `scene_version` also appears in RETURNING, where
    // it is a column being reported rather than a condition being applied.
    const where = update?.text.split("WHERE")[1]?.split("RETURNING")[0] ?? "";
    expect(where).not.toContain("scene_version");
  });

  it("logs the rename with the new name", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("UPDATE boards") ? [row({ name: "Renamed" })] : [],
    );

    await runRenameBoard(db, user, { boardId, name: "Renamed" });

    const activity = calls.find((call) =>
      call.text.includes("INSERT INTO activity"),
    );
    expect(activity?.params).toContain("rename");
    expect(activity?.params).toContain("Renamed");
  });
});

describe("runDuplicateBoard", () => {
  it("copies the scene and its byte count under a new name", async () => {
    const source = row({
      name: "Architecture",
      scene: '{"elements":[]}',
      scene_bytes: 15,
    });

    const { db, calls } = recording((call) => {
      if (call.text.startsWith("SELECT")) {
        return [source];
      }
      return [row({ id: "new-id", name: "Architecture (copy)" })];
    });

    const result = await runDuplicateBoard(db, user, { boardId });

    expect(result.board.id).toBe("new-id");
    expect(result.message).toContain("Architecture (copy)");

    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    expect(insert?.params).toContain('{"elements":[]}');
    expect(insert?.params).toContain(15);
  });

  it("accepts an explicit name", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("SELECT") ? [row()] : [row({ name: "Mine" })],
    );

    await runDuplicateBoard(db, user, { boardId, name: "Mine" });

    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    expect(insert?.params[2]).toBe("Mine");
  });

  it("leaves the copy unfiled and unfavourited", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("SELECT")
        ? [row({ folder_id: folderId, favorite: true })]
        : [row()],
    );

    await runDuplicateBoard(db, user, { boardId });

    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    // folder id is the 4th parameter; the copy is unfiled
    expect(insert?.params[3]).toBeNull();
    // `favorite` appears in RETURNING (it is reported), never in the column
    // list being written — the copy takes the column default, false.
    const columns = insert?.text.slice(
      insert.text.indexOf("(") + 1,
      insert.text.indexOf(")"),
    );
    expect(columns).not.toContain("favorite");
  });

  it("copies the thumbnail so the duplicate's card is not blank", async () => {
    const thumbnail = "data:image/png;base64,AAAA";

    const { db, calls } = recording((call) =>
      call.text.startsWith("SELECT")
        ? [row({ thumbnail })]
        : [row({ id: "new-id" })],
    );

    await runDuplicateBoard(db, user, { boardId });

    const insert = calls.find((call) =>
      call.text.startsWith("INSERT INTO boards"),
    );
    expect(insert?.text).toContain("thumbnail");
    expect(insert?.params).toContain(thumbnail);
  });

  it("reads the source under the caller's scope", async () => {
    const { db, calls } = recording((call) =>
      call.text.startsWith("SELECT") ? [row()] : [row()],
    );

    await runDuplicateBoard(db, guest, { boardId });

    const read = calls.find((call) => call.text.startsWith("SELECT"));
    expect(read?.text).toContain("b.owner_uid = $2 AND b.user_id IS NULL");
    expect(read?.params).toEqual([boardId, "uid-456"]);
  });

  it("refuses to copy a board that is not the caller's", async () => {
    const { db, calls } = recording(() => []);

    await expect(
      runDuplicateBoard(db, user, { boardId }),
    ).rejects.toBeInstanceOf(ToolError);

    expect(
      calls.some((call) => call.text.startsWith("INSERT INTO boards")),
    ).toBe(false);
  });
});

describe("copyName", () => {
  it("matches the dashboard's copy naming", () => {
    expect(copyName("Architecture")).toBe("Architecture (copy)");
  });
});

describe("assertSceneFits", () => {
  it("returns the byte length of a scene that fits", () => {
    expect(assertSceneFits("abc", DEFAULT_OPTIONS, "write")).toBe(3);
  });

  it("measures bytes, not characters", () => {
    // "é" is two bytes in UTF-8; a character count would say 1
    expect(assertSceneFits("é", DEFAULT_OPTIONS, "write")).toBe(2);
  });

  it("refuses a scene above the cap and names the variable to raise", () => {
    const options = { ...DEFAULT_OPTIONS, maxSceneBytes: 10 };

    expect(() =>
      assertSceneFits("x".repeat(11), options, "add an element"),
    ).toThrow(/11 bytes.*10-byte cap.*MOSAIC_MCP_MAX_SCENE_BYTES/s);
  });

  it("says nothing was written, so a caller does not retry blindly", () => {
    const options = { ...DEFAULT_OPTIONS, maxSceneBytes: 10 };

    expect(() => assertSceneFits("x".repeat(11), options, "add")).toThrow(
      /Nothing was written/,
    );
  });
});
