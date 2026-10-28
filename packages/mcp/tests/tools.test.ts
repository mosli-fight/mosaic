import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import {
  excerptAround,
  runGetBoard,
  runListBoards,
  runSearchBoards,
  ToolError,
} from "../src/tools.js";

import type { BoardListRow, BoardRow, Database } from "../src/db.js";

/**
 * Tests for the tool bodies.
 *
 * The database is faked at the query level so the tests can assert both the
 * result *and* the statement that produced it. That combination is what catches
 * the failure that matters most here: a tool that returns the right-looking
 * answer for the wrong owner.
 */

type Call = { text: string; params: unknown[] };

const respond = (answers: (call: Call) => unknown[]) => {
  const calls: Call[] = [];
  const db: Database = {
    query: async (text, params = []) => {
      const call = { text, params };
      calls.push(call);
      return answers(call);
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
  scene_version: 1,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
  last_opened_at: null,
  scene_bytes: 1024,
  ...overrides,
});

const scene = (elements: unknown[]) =>
  JSON.stringify({ elements, appState: {}, files: {} });

const user = { kind: "user", userId: "user-123" } as const;

describe("runListBoards", () => {
  it("defaults to 20 boards from the start", async () => {
    const { db, calls } = respond((call) =>
      call.text.startsWith("SELECT count(*)") ? [{ total: 0 }] : [],
    );

    const result = await runListBoards(db, user, {});

    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
    const page = calls.find((call) => call.text.includes("LIMIT"));
    expect(page?.params.slice(-2)).toEqual([20, 0]);
  });

  it("reports hasMore from the total, not the page length", async () => {
    const { db } = respond((call) =>
      call.text.startsWith("SELECT count(*)")
        ? [{ total: 45 }]
        : Array.from({ length: 20 }, (_, i) => row({ id: `b${i}` })),
    );

    const result = await runListBoards(db, user, { limit: 20, offset: 0 });

    expect(result.total).toBe(45);
    expect(result.hasMore).toBe(true);
  });

  it("reports hasMore false on the last page", async () => {
    const { db } = respond((call) =>
      call.text.startsWith("SELECT count(*)")
        ? [{ total: 25 }]
        : Array.from({ length: 5 }, (_, i) => row({ id: `b${i}` })),
    );

    const result = await runListBoards(db, user, { limit: 20, offset: 20 });

    expect(result.hasMore).toBe(false);
  });

  it("treats a full last page as the end when the total says so", async () => {
    // A page of exactly `limit` rows is indistinguishable from a full page
    // without the total; this is the case the total exists for.
    const { db } = respond((call) =>
      call.text.startsWith("SELECT count(*)")
        ? [{ total: 20 }]
        : Array.from({ length: 20 }, (_, i) => row({ id: `b${i}` })),
    );

    expect(
      (await runListBoards(db, user, { limit: 20, offset: 0 })).hasMore,
    ).toBe(false);
  });

  it("passes the trash flag through", async () => {
    const { db, calls } = respond((call) =>
      call.text.startsWith("SELECT count(*)") ? [{ total: 0 }] : [],
    );

    await runListBoards(db, user, { includeTrashed: true });

    for (const call of calls) {
      expect(call.text).not.toContain("b.trashed_at IS NULL");
    }
  });

  it("ignores unfiled when a folder is named", async () => {
    const { db, calls } = respond((call) =>
      call.text.startsWith("SELECT count(*)") ? [{ total: 0 }] : [],
    );

    await runListBoards(db, user, { folderId: "f1", unfiled: true });

    for (const call of calls) {
      expect(call.text).not.toContain("b.folder_id IS NULL");
    }
  });

  it("returns no scene data", async () => {
    const { db } = respond((call) =>
      call.text.startsWith("SELECT count(*)")
        ? [{ total: 1 }]
        : [{ ...row(), scene: "SHOULD NOT APPEAR" }],
    );

    const result = await runListBoards(db, user, {});

    expect(JSON.stringify(result)).not.toContain("SHOULD NOT APPEAR");
  });
});

describe("runGetBoard", () => {
  it("throws a ToolError when the board is not visible", async () => {
    const { db } = respond(() => []);

    await expect(
      runGetBoard(db, user, DEFAULT_OPTIONS, "board-1", false),
    ).rejects.toThrow(ToolError);
  });

  it("does not distinguish missing from forbidden", async () => {
    const { db } = respond(() => []);

    const message = await runGetBoard(
      db,
      user,
      DEFAULT_OPTIONS,
      "board-1",
      false,
    ).catch((error: Error) => error.message);

    expect(message).toContain("No board with id board-1");
    expect(message).toMatch(/may not exist, may belong to another owner/);
    expect(message).not.toMatch(/forbidden|permission|denied/i);
  });

  it("returns metadata and a summary, never the scene", async () => {
    // The element carries fields the summary must not reproduce: version
    // counters, seeds, the raw binding graph. `scrollX` stands in for the
    // viewport state that lives in `appState`.
    const raw = JSON.stringify({
      elements: [
        {
          id: "t1",
          type: "text",
          text: "Deploy pipeline",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          version: 4242,
          seed: 987654,
          isDeleted: false,
        },
      ],
      appState: { scrollX: 13579, selectedElementIds: { t1: true } },
      files: {},
    });
    const { db } = respond(() => [{ ...row(), scene: raw }]);

    const result = await runGetBoard(
      db,
      user,
      DEFAULT_OPTIONS,
      "board-1",
      false,
    );
    const serialized = JSON.stringify(result);

    expect(result.board.id).toBe("board-1");
    expect(result.summary.text.items[0].text).toBe("Deploy pipeline");
    expect(serialized).not.toContain("4242");
    expect(serialized).not.toContain("987654");
    expect(serialized).not.toContain("13579");
    expect(serialized).not.toContain("selectedElementIds");
    expect(serialized).not.toContain("isDeleted");
  });

  it("scopes the query to the owner", async () => {
    const { db, calls } = respond(() => []);

    await runGetBoard(db, user, DEFAULT_OPTIONS, "board-1", false).catch(
      () => undefined,
    );

    expect(calls[0].text).toContain("b.user_id = $2");
    expect(calls[0].params).toEqual(["board-1", "user-123"]);
  });

  it("omits the element list unless asked", async () => {
    const raw = scene([
      { id: "e1", type: "rectangle", x: 0, y: 0, width: 1, height: 1 },
    ]);
    const { db } = respond(() => [{ ...row(), scene: raw }]);

    const without = await runGetBoard(
      db,
      user,
      DEFAULT_OPTIONS,
      "board-1",
      false,
    );
    const withList = await runGetBoard(
      db,
      user,
      DEFAULT_OPTIONS,
      "board-1",
      true,
    );

    expect(without.summary.elements).toBeUndefined();
    expect(withList.summary.elements?.items).toHaveLength(1);
  });

  it("applies the configured caps", async () => {
    const raw = scene([
      {
        id: "t1",
        type: "text",
        text: "z".repeat(1000),
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    ]);
    const { db } = respond(() => [{ ...row(), scene: raw }]);

    const result = await runGetBoard(
      db,
      user,
      { ...DEFAULT_OPTIONS, maxTextLength: 12 },
      "board-1",
      false,
    );

    expect(result.summary.text.items[0].text).toHaveLength(12);
  });

  it("reports an unparseable scene without failing the call", async () => {
    const { db } = respond(() => [{ ...row(), scene: "{broken" }]);

    const result = await runGetBoard(
      db,
      user,
      DEFAULT_OPTIONS,
      "board-1",
      false,
    );

    expect(result.board.id).toBe("board-1");
    expect(result.summary.parseError).toMatch(/not valid JSON/);
    expect(result.summary.isEmpty).toBe(true);
  });
});

describe("runSearchBoards", () => {
  /**
   * A db whose name search and scene listing are answered separately.
   *
   * The trash filter is applied here by reading the SQL, exactly as Postgres
   * would. That is what makes the `includeTrashed` tests meaningful: if a pass
   * forgets the flag, the fake returns the trashed row and the test fails.
   */
  const searchDb = (nameMatches: BoardListRow[], sceneRows: BoardRow[]) =>
    respond((call) => {
      const liveOnly = call.text.includes("b.trashed_at IS NULL");
      const source: (BoardListRow | BoardRow)[] = call.text.includes(
        "b.name ILIKE",
      )
        ? nameMatches
        : sceneRows;
      return source.filter(
        (candidate) =>
          !liveOnly ||
          candidate.trashed_at === null ||
          candidate.trashed_at === undefined,
      );
    });

  it("finds a board by name", async () => {
    const { db } = searchDb([row({ id: "named" })], []);

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "arch",
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].board.id).toBe("named");
    expect(result.matches[0].matchedOn).toEqual(["name"]);
  });

  it("finds a board by text inside its scene", async () => {
    const { db } = searchDb(
      [],
      [
        {
          ...row({ id: "content" }),
          scene: scene([{ id: "t", type: "text", text: "deploy the worker" }]),
        },
      ],
    );

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "worker",
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedOn).toEqual(["content"]);
    expect(result.matches[0].excerpts[0]).toContain("deploy the worker");
  });

  it("marks a board that matches on both", async () => {
    const { db } = searchDb(
      [row({ id: "both", name: "worker plan" })],
      [
        {
          ...row({ id: "both", name: "worker plan" }),
          scene: scene([{ id: "t", type: "text", text: "worker notes" }]),
        },
      ],
    );

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "worker",
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedOn).toEqual(["name", "content"]);
  });

  it("sorts name matches before content matches", async () => {
    const { db } = searchDb(
      [
        row({
          id: "named",
          name: "roadmap",
          updated_at: new Date("2020-01-01"),
        }),
      ],
      [
        {
          ...row({ id: "content", updated_at: new Date("2026-01-01") }),
          scene: scene([{ id: "t", type: "text", text: "roadmap" }]),
        },
      ],
    );

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "roadmap",
    });

    expect(result.matches.map((match) => match.board.id)).toEqual([
      "named",
      "content",
    ]);
  });

  it("searches text of every kind, not just text elements", async () => {
    const { db } = searchDb(
      [],
      [
        {
          ...row({ id: "code" }),
          scene: scene([
            { id: "c", type: "codeblock", code: "await deploy()" },
          ]),
        },
        {
          ...row({ id: "frame" }),
          scene: scene([
            { id: "f", type: "frame", name: "Deploy", notes: "say deploy" },
          ]),
        },
        {
          ...row({ id: "link" }),
          scene: scene([
            { id: "l", type: "rectangle", link: "https://deploy.example" },
          ]),
        },
      ],
    );

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "deploy",
    });

    expect(result.matches.map((match) => match.board.id).sort()).toEqual([
      "code",
      "frame",
      "link",
    ]);
  });

  it("is case-insensitive", async () => {
    const { db } = searchDb(
      [],
      [
        {
          ...row({ id: "x" }),
          scene: scene([{ id: "t", type: "text", text: "DEPLOY" }]),
        },
      ],
    );

    expect(
      (await runSearchBoards(db, user, DEFAULT_OPTIONS, { query: "deploy" }))
        .matches,
    ).toHaveLength(1);
  });

  it("counts searched and skipped boards", async () => {
    const { db } = searchDb(
      [],
      [
        {
          ...row({ id: "ok" }),
          scene: scene([{ id: "t", type: "text", text: "x" }]),
        },
        { ...row({ id: "broken" }), scene: "{not json" },
      ],
    );

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "x",
    });

    expect(result.boardsSearched).toBe(1);
    expect(result.boardsSkipped).toBe(1);
  });

  it("does not report a skipped board as a non-match", async () => {
    const { db } = searchDb(
      [],
      [{ ...row({ id: "broken" }), scene: "{not json" }],
    );

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "x",
    });

    expect(result.matches).toHaveLength(0);
    expect(result.boardsSkipped).toBe(1);
  });

  it("skips trashed boards unless asked", async () => {
    const trashed = {
      ...row({ id: "trashed", trashed_at: new Date() }),
      scene: scene([{ id: "t", type: "text", text: "needle" }]),
    };
    const { db } = searchDb([], [trashed]);

    const excluded = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "needle",
    });
    const included = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "needle",
      includeTrashed: true,
    });

    expect(excluded.matches).toHaveLength(0);
    expect(included.matches).toHaveLength(1);
  });

  it("applies includeTrashed to name matches as well as content", async () => {
    // The regression this pins: the name pass used to hard-code
    // `trashed_at IS NULL` while the content pass honoured the flag, so a
    // trashed board was findable by its text but not by its name.
    const trashed = row({
      id: "trashed",
      name: "needle plan",
      trashed_at: new Date(),
    });
    const { db } = searchDb([trashed], []);

    const excluded = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "needle",
    });
    const included = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "needle",
      includeTrashed: true,
    });

    expect(excluded.matches).toHaveLength(0);
    expect(included.matches).toHaveLength(1);
    expect(included.matches[0].matchedOn).toEqual(["name"]);
  });

  it("passes includeTrashed to both queries", async () => {
    const { db, calls } = searchDb([], []);

    await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "x",
      includeTrashed: true,
    });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.text).not.toContain("b.trashed_at IS NULL");
    }
  });

  it("truncates to the limit and says so", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      ...row({ id: `b${i}` }),
      scene: scene([{ id: "t", type: "text", text: "needle" }]),
    }));
    const { db } = searchDb([], rows);

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "needle",
      limit: 2,
    });

    expect(result.matches).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("does not mark a complete result truncated", async () => {
    const { db } = searchDb([row({ id: "only" })], []);

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "only",
    });

    expect(result.truncated).toBe(false);
  });

  it("scopes both passes to the owner", async () => {
    const { db, calls } = searchDb([], []);

    await runSearchBoards(db, user, DEFAULT_OPTIONS, { query: "x" });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.text).toContain("b.user_id =");
      expect(call.params).toContain("user-123");
    }
  });

  it("returns the query as the caller sent it", async () => {
    const { db } = searchDb([], []);

    const result = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "RoadMap",
    });

    expect(result.query).toBe("RoadMap");
  });

  it("does not treat search input as a pattern", async () => {
    const { db } = searchDb(
      [],
      [
        {
          ...row({ id: "x" }),
          scene: scene([{ id: "t", type: "text", text: "cost is $5" }]),
        },
      ],
    );

    const literal = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: "$5",
    });
    const pattern = await runSearchBoards(db, user, DEFAULT_OPTIONS, {
      query: ".*",
    });

    expect(literal.matches).toHaveLength(1);
    expect(pattern.matches).toHaveLength(0);
  });
});

describe("excerptAround", () => {
  it("returns the whole string when it is short", () => {
    expect(excerptAround("deploy the worker", "worker")).toBe(
      "deploy the worker",
    );
  });

  it("marks both cuts with an ellipsis", () => {
    const haystack = `${"a".repeat(200)}needle${"b".repeat(200)}`;
    const excerpt = excerptAround(haystack, "needle", 10);

    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).toContain("needle");
  });

  it("does not add an ellipsis at the start when the match is at the start", () => {
    const excerpt = excerptAround(`needle${"b".repeat(200)}`, "needle", 10);
    expect(excerpt.startsWith("…")).toBe(false);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("is case-insensitive about locating the match", () => {
    const excerpt = excerptAround(
      `${"a".repeat(100)}NEEDLE${"b".repeat(100)}`,
      "needle",
      5,
    );
    expect(excerpt).toContain("NEEDLE");
  });

  it("collapses newlines so the excerpt stays one line", () => {
    const excerpt = excerptAround("line one\n\nline two needle", "needle");
    expect(excerpt).not.toContain("\n");
  });

  it("falls back to a prefix when the needle is absent", () => {
    // Only reachable through a caller mistake, but it must not throw.
    expect(excerptAround("abcdef", "zzz", 2)).toBe("abcd");
  });
});
