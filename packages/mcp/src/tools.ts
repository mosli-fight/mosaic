/**
 * The three read-only tools, as plain functions over a database handle.
 *
 * They are written without any MCP types on purpose. The MCP layer in
 * `index.ts` is a thin adapter that validates input and serialises the result;
 * everything worth testing — paging, scoping, caps, matching — lives here and
 * can be exercised against a fake database with no transport involved.
 */

import {
  getBoard,
  listBoards,
  listBoardsWithScenes,
  searchBoardNames,
  toBoardMeta,
} from "./db.js";
import { normalizeSearchTerm, containsTerm } from "./schemas.js";
import { limitsFrom, summarizeScene } from "./scene.js";

import type { OwnerIdentity, ServerOptions } from "./config.js";
import type { BoardMeta, Database } from "./db.js";
import type { ListBoardsInput, SearchBoardsInput } from "./schemas.js";
import type { SceneSummary } from "./scene.js";

/** A tool failure that should be reported to the caller, not thrown as a bug. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export type ListBoardsResult = {
  boards: BoardMeta[];
  total: number;
  limit: number;
  offset: number;
  /** True when there are more rows past this page. */
  hasMore: boolean;
};

/**
 * Pages through the caller's boards.
 *
 * The response carries `total` and `hasMore` so a model can decide whether to
 * ask for another page instead of guessing from a short page — a page that
 * happens to be exactly `limit` long is indistinguishable from the last page
 * without the total.
 */
export const runListBoards = async (
  db: Database,
  owner: OwnerIdentity,
  input: ListBoardsInput,
): Promise<ListBoardsResult> => {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  const { boards, total } = await listBoards(db, owner, {
    limit,
    offset,
    includeTrashed: input.includeTrashed === true,
    // `unfiled` is ignored when a folder is named: the two filters contradict
    // each other, and the explicit folder is the more specific request.
    folderId: input.folderId,
    unfiledOnly: input.folderId === undefined && input.unfiled === true,
  });

  return {
    boards,
    total,
    limit,
    offset,
    hasMore: offset + boards.length < total,
  };
};

export type GetBoardResult = {
  board: BoardMeta;
  summary: SceneSummary;
};

/**
 * Loads one board and summarises its scene.
 *
 * A board that is not the caller's is reported as "not found", never as
 * "forbidden": the two are indistinguishable on the API for the same reason —
 * a different answer would confirm the id exists.
 */
export const runGetBoard = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  boardId: string,
  includeElements: boolean,
): Promise<GetBoardResult> => {
  const row = await getBoard(db, owner, boardId);
  if (!row) {
    throw new ToolError(
      `No board with id ${boardId} is visible to this server. ` +
        "It may not exist, may belong to another owner, or the configured " +
        "owner identity may not be the one that created it.",
    );
  }

  const summary = summarizeScene(row.scene, {
    sceneBytes: row.scene_bytes,
    includeElements,
    limits: limitsFrom(options),
  });

  // `toBoardMeta` is applied to the row rather than reusing a partial: the row
  // carries `scene`, and the meta shape is what keeps it out of the reply.
  return { board: toBoardMeta(row), summary };
};

/** Where a search matched, so the caller can tell a name hit from a content hit. */
export type SearchMatch = {
  board: BoardMeta;
  /** `name` when the board's name matched, `content` when its scene did. */
  matchedOn: ("name" | "content")[];
  /** Short excerpts around each content match, already capped. */
  excerpts: string[];
};

export type SearchBoardsResult = {
  query: string;
  matches: SearchMatch[];
  /** True when the result was cut off by `limit`. */
  truncated: boolean;
  /** Boards whose scene was searched (name-only matches are not counted). */
  boardsSearched: number;
  /** Boards skipped because their scene exceeded the summarisation limit. */
  boardsSkipped: number;
};

/** How much context to show around a content match. */
const EXCERPT_RADIUS = 80;

/**
 * Builds a short excerpt around the first occurrence of `needle` in `haystack`.
 *
 * Excerpts rather than whole matches: a search hit inside a 500-character note
 * should show the sentence that matched, not the note. The ellipses mark where
 * text was cut, so a model does not mistake an excerpt for the full value.
 */
export const excerptAround = (
  haystack: string,
  needle: string,
  radius = EXCERPT_RADIUS,
): string => {
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) {
    return haystack.slice(0, radius * 2);
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(haystack.length, index + needle.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < haystack.length ? "…" : "";
  // Newlines would break a one-line excerpt into a ragged block in a transcript.
  const body = haystack.slice(start, end).replace(/\s+/g, " ").trim();
  return `${prefix}${body}${suffix}`;
};

/**
 * Searches board names and scene text.
 *
 * Two passes, and the split is deliberate:
 *
 * 1. **Names** are matched in SQL. Cheap, and it finds a board whose scene is
 *    too large to parse.
 * 2. **Content** requires parsing every scene, because the stored value is the
 *    editor's serialised JSON — `ILIKE` on it would match JSON keys, escaped
 *    newlines and element ids as readily as the words a person typed.
 *
 * Pass 2 loads every live board's scene, and that is a real cost worth stating:
 * there is no SQL predicate that can stand in for it, so a search touches all of
 * one owner's boards. It is bounded by the owner's board count and by
 * `maxSceneBytes` per scene, not by `limit` — and `limit` deliberately does not
 * bound it, because stopping after `limit` boards would silently miss matches
 * further down the list. For a personal board collection that is a few dozen
 * scenes; for an owner with thousands of large boards it would be slow, and the
 * fix would be a text index maintained on write, which is a Phase 2 concern.
 */
export const runSearchBoards = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: SearchBoardsInput,
): Promise<SearchBoardsResult> => {
  const limit = input.limit ?? 20;
  const needle = normalizeSearchTerm(input.query);

  const includeTrashed = input.includeTrashed === true;

  // Both passes take the same flag. Filtering trashed rows here instead would
  // let a trashed board match on its text but not on its name, which is the
  // same search giving two answers about the same board.
  const nameMatches = await searchBoardNames(
    db,
    owner,
    input.query,
    limit,
    includeTrashed,
  );
  const byId = new Map<string, SearchMatch>();

  for (const board of nameMatches) {
    byId.set(board.id, { board, matchedOn: ["name"], excerpts: [] });
  }

  const rows = await listBoardsWithScenes(db, owner, includeTrashed);
  let boardsSearched = 0;
  let boardsSkipped = 0;

  // Matching runs over the *whole* text, not the capped summary.
  //
  // The caps exist to bound what is returned to a model; applying them to the
  // search itself would make a word at character 600 of a long note a false
  // negative, which is the one failure a search must not have. The cost is
  // bounded by `maxSceneBytes`, and the scene is already parsed and in memory
  // by this point, so this holds no more than the query already loaded.
  //
  // Only the excerpts are capped, and `excerptAround` is what does that.
  const searchLimits = {
    ...limitsFrom(options),
    maxTextLength: Number.POSITIVE_INFINITY,
    maxTextItems: Number.POSITIVE_INFINITY,
    maxTextChars: Number.POSITIVE_INFINITY,
  };

  for (const row of rows) {
    const summary = summarizeScene(row.scene, {
      sceneBytes: row.scene_bytes,
      limits: searchLimits,
    });

    if (summary.parseError !== null) {
      // A scene that cannot be parsed cannot be searched, and saying so is more
      // honest than reporting "no matches" for a board that was never read.
      boardsSkipped += 1;
      continue;
    }

    boardsSearched += 1;

    const excerpts: string[] = [];
    for (const item of summary.text.items) {
      if (containsTerm(item.text, needle)) {
        excerpts.push(excerptAround(item.text, needle));
      }
    }

    if (excerpts.length === 0) {
      continue;
    }

    const existing = byId.get(row.id);
    if (existing) {
      existing.matchedOn.push("content");
      existing.excerpts = excerpts;
    } else {
      byId.set(row.id, {
        board: toBoardMeta(row),
        matchedOn: ["content"],
        excerpts,
      });
    }
  }

  // Name matches first: a board whose *title* matches is a stronger signal than
  // one that merely mentions the word somewhere on the canvas.
  const all = [...byId.values()].sort((a, b) => {
    const aName = a.matchedOn.includes("name") ? 0 : 1;
    const bName = b.matchedOn.includes("name") ? 0 : 1;
    if (aName !== bName) {
      return aName - bName;
    }
    return (b.board.updatedAt ?? 0) - (a.board.updatedAt ?? 0);
  });

  return {
    query: input.query,
    matches: all.slice(0, limit),
    truncated: all.length > limit,
    boardsSearched,
    boardsSkipped,
  };
};
