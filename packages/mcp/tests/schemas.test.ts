import { describe, expect, it } from "vitest";

import {
  MAX_LIST_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_TERM,
  boardIdSchema,
  containsTerm,
  getBoardInput,
  listBoardsInput,
  normalizeSearchTerm,
  searchBoardsInput,
} from "../src/schemas.js";

/**
 * Tests for tool input validation.
 *
 * The schema is the only contract a model sees, so these tests are about the
 * *edges*: what is rejected, and whether the rejection is specific enough for a
 * model to correct itself. A schema that accepts a string `limit` teaches the
 * model nothing; one that rejects it with "expected number" teaches it the type.
 */

const BOARD_ID = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

/** The first issue message, for asserting that a rejection is actionable. */
const firstIssue = (result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => (result.success ? "" : result.error?.issues[0]?.message ?? "");

describe("boardIdSchema", () => {
  it("accepts a UUID", () => {
    expect(boardIdSchema.parse(BOARD_ID)).toBe(BOARD_ID);
  });

  it("accepts an uppercase UUID", () => {
    expect(boardIdSchema.parse(BOARD_ID.toUpperCase())).toBe(
      BOARD_ID.toUpperCase(),
    );
  });

  it("trims surrounding whitespace", () => {
    expect(boardIdSchema.parse(`  ${BOARD_ID}\n`)).toBe(BOARD_ID);
  });

  it.each([
    ["an empty string", ""],
    ["a bare name", "my-board"],
    ["a truncated uuid", BOARD_ID.slice(0, 30)],
    [
      "a uuid with a bad variant nibble",
      "3f2a1b4c-5d6e-4f70-ca9b-0c1d2e3f4a5b",
    ],
    [
      "a uuid with a bad version nibble",
      "3f2a1b4c-5d6e-0f70-8a9b-0c1d2e3f4a5b",
    ],
    ["a uuid with junk appended", `${BOARD_ID}x`],
    ["an SQL fragment", "' OR 1=1 --"],
  ])("rejects %s", (_label, value) => {
    const result = boardIdSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(firstIssue(result)).toMatch(/board UUID/);
  });

  it("rejects a non-string", () => {
    expect(boardIdSchema.safeParse(42).success).toBe(false);
    expect(boardIdSchema.safeParse(null).success).toBe(false);
    expect(boardIdSchema.safeParse({ id: BOARD_ID }).success).toBe(false);
  });
});

describe("listBoardsInput", () => {
  it("accepts an empty object, so every field is optional", () => {
    expect(listBoardsInput.parse({})).toEqual({});
  });

  it("accepts every documented field", () => {
    const input = {
      limit: 10,
      offset: 20,
      includeTrashed: true,
      folderId: BOARD_ID,
      unfiled: false,
    };
    expect(listBoardsInput.parse(input)).toEqual(input);
  });

  it("rejects unknown keys rather than ignoring them", () => {
    const result = listBoardsInput.safeParse({ bogus: true });
    expect(result.success).toBe(false);
    expect(firstIssue(result)).toMatch(/Unrecognized key/);
  });

  it("rejects a limit above the documented maximum", () => {
    const result = listBoardsInput.safeParse({ limit: MAX_LIST_LIMIT + 1 });
    expect(result.success).toBe(false);
  });

  it("rejects a limit below one", () => {
    expect(listBoardsInput.safeParse({ limit: 0 }).success).toBe(false);
    expect(listBoardsInput.safeParse({ limit: -5 }).success).toBe(false);
  });

  it("rejects a non-integer limit", () => {
    expect(listBoardsInput.safeParse({ limit: 2.5 }).success).toBe(false);
  });

  it("rejects a numeric string limit instead of coercing it", () => {
    const result = listBoardsInput.safeParse({ limit: "10" });
    expect(result.success).toBe(false);
    expect(firstIssue(result)).toMatch(/expected number/i);
  });

  it("rejects a negative offset", () => {
    expect(listBoardsInput.safeParse({ offset: -1 }).success).toBe(false);
  });

  it("rejects a non-UUID folder id", () => {
    const result = listBoardsInput.safeParse({ folderId: "inbox" });
    expect(result.success).toBe(false);
  });

  it("rejects a truthy string for a boolean field", () => {
    expect(listBoardsInput.safeParse({ includeTrashed: "true" }).success).toBe(
      false,
    );
    expect(listBoardsInput.safeParse({ unfiled: 1 }).success).toBe(false);
  });
});

describe("getBoardInput", () => {
  it("requires a board id", () => {
    const result = getBoardInput.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a board id alone", () => {
    expect(getBoardInput.parse({ boardId: BOARD_ID })).toEqual({
      boardId: BOARD_ID,
    });
  });

  it("accepts includeElements", () => {
    expect(
      getBoardInput.parse({ boardId: BOARD_ID, includeElements: true }),
    ).toEqual({
      boardId: BOARD_ID,
      includeElements: true,
    });
  });

  it("rejects an unknown key", () => {
    const result = getBoardInput.safeParse({ boardId: BOARD_ID, raw: true });
    expect(result.success).toBe(false);
    expect(firstIssue(result)).toMatch(/Unrecognized key/);
  });

  it("rejects a non-boolean includeElements", () => {
    expect(
      getBoardInput.safeParse({ boardId: BOARD_ID, includeElements: "yes" })
        .success,
    ).toBe(false);
  });
});

describe("searchBoardsInput", () => {
  it("requires a non-empty query", () => {
    expect(searchBoardsInput.safeParse({}).success).toBe(false);
    expect(searchBoardsInput.safeParse({ query: "" }).success).toBe(false);
    expect(searchBoardsInput.safeParse({ query: "   " }).success).toBe(false);
  });

  it("trims the query", () => {
    expect(searchBoardsInput.parse({ query: "  roadmap  " }).query).toBe(
      "roadmap",
    );
  });

  it("rejects a query longer than the maximum", () => {
    const result = searchBoardsInput.safeParse({
      query: "a".repeat(MAX_SEARCH_TERM + 1),
    });
    expect(result.success).toBe(false);
    expect(firstIssue(result)).toMatch(new RegExp(String(MAX_SEARCH_TERM)));
  });

  it("accepts a query at exactly the maximum length", () => {
    expect(
      searchBoardsInput.safeParse({ query: "a".repeat(MAX_SEARCH_TERM) })
        .success,
    ).toBe(true);
  });

  it("rejects a limit above the search maximum", () => {
    expect(
      searchBoardsInput.safeParse({ query: "x", limit: MAX_SEARCH_LIMIT + 1 })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = searchBoardsInput.safeParse({ query: "x", regex: ".*" });
    expect(result.success).toBe(false);
    expect(firstIssue(result)).toMatch(/Unrecognized key/);
  });
});

describe("search helpers", () => {
  it("folds case", () => {
    expect(normalizeSearchTerm("RoadMap")).toBe("roadmap");
  });

  it("does not collapse whitespace", () => {
    // A caller who typed two spaces can see them; silently matching one space
    // would make the result impossible to explain.
    expect(normalizeSearchTerm("two  words")).toBe("two  words");
  });

  it("matches case-insensitively", () => {
    expect(containsTerm("The Roadmap for Q3", "roadmap")).toBe(true);
    expect(containsTerm("The Roadmap for Q3", "q4")).toBe(false);
  });

  it("treats the needle as literal text, not a pattern", () => {
    expect(containsTerm("value is $5", "$5")).toBe(true);
    expect(containsTerm("value is 5", "$5")).toBe(false);
    expect(containsTerm("a.c", "a.c")).toBe(true);
    expect(containsTerm("abc", "a.c")).toBe(false);
  });

  it("matches an empty needle, which is why the schema rejects empty queries", () => {
    expect(containsTerm("anything", "")).toBe(true);
  });
});
