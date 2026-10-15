import { describe, expect, it } from "vitest";

import type { Board, Folder } from "@/db/schema";

import {
  UNKNOWN_TIME_LABEL,
  boardActivityLabel,
  boardActivityTimestamp,
  countBoardsInFolder,
  daysUntilPurge,
  exactTimestamp,
  formatBytes,
  matchesQuery,
  pluralize,
  relativeTime,
  selectBoards,
  sortBoards,
  unfiledBoards,
} from "@/lib/selectors";

/**
 * `selectBoards` is the single gate every grid view goes through, so these tests
 * cover the filter semantics that are easy to get subtly wrong — in particular
 * the three-way `folderId` (undefined / null / string) meaning.
 */

const HOUR = 60 * 60 * 1000;

const board = (over: Partial<Board> = {}): Board => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: over.name ?? "Board",
  folderId: over.folderId ?? null,
  favorite: over.favorite ?? false,
  trashedAt: over.trashedAt ?? null,
  thumbnail: over.thumbnail ?? null,
  sceneVersion: over.sceneVersion ?? 0,
  createdAt: over.createdAt ?? 0,
  updatedAt: over.updatedAt ?? 0,
  lastOpenedAt: over.lastOpenedAt ?? null,
  ...(over.sceneBytes !== undefined ? { sceneBytes: over.sceneBytes } : {}),
});

describe("matchesQuery", () => {
  it("is case-insensitive and matches on substring", () => {
    expect(matchesQuery(board({ name: "Product Roadmap" }), "road")).toBe(true);
    expect(matchesQuery(board({ name: "Product Roadmap" }), "ROADMAP")).toBe(
      true,
    );
    expect(matchesQuery(board({ name: "Product Roadmap" }), "missing")).toBe(
      false,
    );
  });

  it("treats an empty or whitespace query as match-all", () => {
    expect(matchesQuery(board({ name: "Anything" }), "")).toBe(true);
    expect(matchesQuery(board({ name: "Anything" }), "   ")).toBe(true);
  });
});

describe("selectBoards filtering", () => {
  const live = board({ name: "Live", folderId: "f1", favorite: true });
  const unfiled = board({ name: "Unfiled" });
  const trashed = board({ name: "Trashed", trashedAt: Date.now() });
  const all = [live, unfiled, trashed];

  it("hides trashed boards by default", () => {
    expect(selectBoards(all).map((b) => b.name)).toEqual(["Live", "Unfiled"]);
  });

  it("includeTrashed shows trashed boards and hides live ones", () => {
    expect(
      selectBoards(all, { includeTrashed: true }).map((b) => b.name),
    ).toEqual(["Trashed"]);
  });

  it("favoritesOnly narrows to starred boards", () => {
    expect(
      selectBoards(all, { favoritesOnly: true }).map((b) => b.name),
    ).toEqual(["Live"]);
  });

  it("folderId: string scopes to that folder", () => {
    expect(selectBoards(all, { folderId: "f1" }).map((b) => b.name)).toEqual([
      "Live",
    ]);
    expect(selectBoards(all, { folderId: "nope" })).toHaveLength(0);
  });

  it("folderId: null scopes to unfiled boards only", () => {
    expect(selectBoards(all, { folderId: null }).map((b) => b.name)).toEqual([
      "Unfiled",
    ]);
  });

  it("folderId: undefined applies no folder filter", () => {
    expect(selectBoards(all)).toHaveLength(2);
  });

  it("combines folder + query", () => {
    expect(
      selectBoards(all, { folderId: "f1", query: "liv" }).map((b) => b.name),
    ).toEqual(["Live"]);
    expect(selectBoards(all, { folderId: "f1", query: "unfil" })).toHaveLength(
      0,
    );
  });
});

describe("sortBoards", () => {
  it("recent prefers lastOpenedAt, falling back to updatedAt", () => {
    const neverOpened = board({ name: "Never", updatedAt: 900 });
    const old = board({ name: "Old", updatedAt: 100, lastOpenedAt: 200 });
    const fresh = board({ name: "Fresh", updatedAt: 100, lastOpenedAt: 999 });

    expect(
      sortBoards([neverOpened, old, fresh], "recent").map((b) => b.name),
    ).toEqual(["Fresh", "Never", "Old"]);
  });

  it("name sorts alphabetically, case-insensitive", () => {
    const rows = [board({ name: "beta" }), board({ name: "Alpha" })];
    expect(sortBoards(rows, "name").map((b) => b.name)).toEqual([
      "Alpha",
      "beta",
    ]);
  });

  it("created sorts newest first", () => {
    const rows = [
      board({ name: "old", createdAt: 1 }),
      board({ name: "new", createdAt: 999 }),
    ];
    expect(sortBoards(rows, "created").map((b) => b.name)).toEqual([
      "new",
      "old",
    ]);
  });

  it("size sorts largest first and puts unknown sizes last", () => {
    const rows = [
      board({ name: "unknown" }),
      board({ name: "small", sceneBytes: 10 }),
      board({ name: "big", sceneBytes: 5000 }),
    ];
    expect(sortBoards(rows, "size").map((b) => b.name)).toEqual([
      "big",
      "small",
      "unknown",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [board({ name: "b" }), board({ name: "a" })];
    const before = rows.map((r) => r.name);
    sortBoards(rows, "name");
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});

describe("folder helpers", () => {
  it("countBoardsInFolder ignores trashed boards", () => {
    const rows = [
      board({ folderId: "f1" }),
      board({ folderId: "f1", trashedAt: 5 }),
      board({ folderId: "f2" }),
    ];
    expect(countBoardsInFolder(rows, "f1")).toBe(1);
  });

  it("unfiledBoards excludes trashed and foldered boards", () => {
    const rows = [
      board({ folderId: null }),
      board({ folderId: "f1" }),
      board({ folderId: null, trashedAt: 3 }),
    ];
    expect(unfiledBoards(rows)).toHaveLength(1);
  });
});

describe("formatting helpers", () => {
  it("pluralize handles singular and plural", () => {
    expect(pluralize(1, "board")).toBe("1 board");
    expect(pluralize(3, "board")).toBe("3 boards");
    expect(pluralize(0, "board")).toBe("0 boards");
  });

  it("formatBytes renders a dash for unknown size", () => {
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("relativeTime produces human phrasing", () => {
    const now = Date.now();
    expect(relativeTime(now - 2 * HOUR, now)).toMatch(/hour/);
    expect(relativeTime(now - 3 * 24 * HOUR, now)).toMatch(/day/);
  });

  /**
   * The board-card cases QA reported as a wrong relative time.
   *
   * A board created minutes ago rendering a 7-day-scale number is what a missing or
   * zeroed timestamp looks like: `reference - null` is the epoch and
   * `reference - 0` is the epoch, so both produced "57 years ago", and
   * `?? board.updatedAt` cannot rescue `lastOpenedAt: 0` because nullish
   * coalescing does not treat zero as nullish.
   */
  it("refuses to invent an age from a timestamp it cannot use", () => {
    const now = Date.now();
    expect(relativeTime(Number.NaN, now)).toBe(UNKNOWN_TIME_LABEL);
    expect(relativeTime(Number.POSITIVE_INFINITY, now)).toBe(
      UNKNOWN_TIME_LABEL,
    );
    // Zero is the null sentinel on a never-opened row, not 1 January 1970.
    expect(relativeTime(0, now)).toBe(UNKNOWN_TIME_LABEL);
    expect(relativeTime(-1, now)).toBe(UNKNOWN_TIME_LABEL);
  });

  it("does not render a future timestamp as future work", () => {
    const now = Date.now();
    // Clock skew between the writer and the reader is milliseconds, not a promise.
    expect(relativeTime(now + 10 * 60 * 1000, now)).toBe("now");
  });

  it("still labels a board that was opened minutes ago in minutes", () => {
    const now = Date.now();
    const fresh = board({ updatedAt: now - 5 * 60 * 1000, lastOpenedAt: null });
    expect(boardActivityLabel(fresh, now)).toMatch(/minute/);
    expect(boardActivityTimestamp(fresh)).toBe(fresh.updatedAt);
  });

  it("prefers the last-opened time and falls back to the last edit", () => {
    const now = Date.now();
    const opened = board({
      lastOpenedAt: now - 2 * HOUR,
      updatedAt: now - 30 * 24 * HOUR,
    });
    expect(boardActivityLabel(opened, now)).toMatch(/hour/);

    const neverOpened = board({
      lastOpenedAt: null,
      updatedAt: now - 2 * HOUR,
    });
    expect(boardActivityLabel(neverOpened, now)).toMatch(/hour/);
  });

  it("treats a zeroed lastOpenedAt as never opened, not as the epoch", () => {
    const now = Date.now();
    const row = board({ lastOpenedAt: 0, updatedAt: now - 2 * HOUR });
    // `??` does not fall through on zero, so this is the case that used to slip
    // past the fallback and render a 57-year-old board.
    expect(boardActivityTimestamp(row)).toBe(row.updatedAt);
    expect(boardActivityLabel(row, now)).toMatch(/hour/);
  });

  it("answers the unknown label when no timestamp survives", () => {
    const row = board({ lastOpenedAt: null, updatedAt: null as never });
    expect(boardActivityTimestamp(row)).toBeNull();
    expect(boardActivityLabel(row)).toBe(UNKNOWN_TIME_LABEL);
    // The tooltip must be absent rather than saying "Invalid Date".
    expect(exactTimestamp(null)).toBe("");
    expect(exactTimestamp(Date.now())).not.toBe("");
  });

  it("daysUntilPurge counts down and floors at zero", () => {
    const now = Date.now();
    const trashedYesterday = board({ trashedAt: now - 24 * HOUR });
    expect(daysUntilPurge(trashedYesterday, 30, now)).toBe(29);

    // Trashed long ago: already past the window.
    const ancient = board({ trashedAt: now - 60 * 24 * HOUR });
    expect(daysUntilPurge(ancient, 30, now)).toBe(0);

    expect(daysUntilPurge(board(), 30, now)).toBeNull();
  });
});

describe("folder type compatibility", () => {
  it("Folder carries a nested parentId for one level of nesting", () => {
    const parent: Folder = {
      id: "p",
      name: "Parent",
      color: "blue",
      parentId: null,
      createdAt: 0,
    };
    const child: Folder = { ...parent, id: "c", parentId: "p" };
    expect(child.parentId).toBe("p");
  });
});
