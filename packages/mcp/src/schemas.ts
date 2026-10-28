/**
 * Input schemas and the validation helpers the tools share.
 *
 * ## Why the schemas are strict
 *
 * A tool's input schema is the only contract a model sees. Two failure modes
 * matter more here than in a normal API:
 *
 * - **Silently coerced input.** A model that sends `"limit": "10"` and gets ten
 *   results has learned nothing about what the schema accepts, and will keep
 *   sending strings. Rejecting it produces an error the model can act on.
 * - **Unbounded input.** An unbounded `limit` is how a tool call becomes a
 *   multi-megabyte reply. Every list here is capped, and the cap is part of the
 *   schema so it is visible before the call, not after.
 *
 * `.strict()` is used throughout so an unknown key is an error rather than
 * noise. A model that invents `includeDeleted` should be told the field does not
 * exist, not have it ignored while the call appears to succeed.
 */

import { z } from "zod";

/** Largest page a caller may request from `list_boards`. */
export const MAX_LIST_LIMIT = 100;

/** Largest page a caller may request from `search_boards`. */
export const MAX_SEARCH_LIMIT = 50;

/** Longest search term accepted. */
export const MAX_SEARCH_TERM = 200;

/**
 * A board id.
 *
 * Validated as a UUID before it reaches Postgres. An invalid id would otherwise
 * raise `22P02` in the driver and surface as an internal error, when the caller
 * simply sent something that is not an id. The pattern matches the one in
 * `api/boards/[id].ts` so both surfaces reject the same values.
 */
export const boardIdSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "must be a board UUID",
  );

export const listBoardsInput = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIST_LIMIT)
      .optional()
      .describe(
        `How many boards to return (1-${MAX_LIST_LIMIT}, default 20). ` +
          "Metadata only — scenes are never included in a listing.",
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("How many boards to skip, for paging (default 0)."),
    includeTrashed: z
      .boolean()
      .optional()
      .describe(
        "Include boards in the trash (default false). Trashed boards are " +
          "soft-deleted and still recoverable in the app.",
      ),
    folderId: z
      .string()
      .uuid()
      .optional()
      .describe("Only boards in this folder."),
    unfiled: z
      .boolean()
      .optional()
      .describe(
        "Only boards that are in no folder (default false). Ignored when " +
          "folderId is given.",
      ),
  })
  .strict();

export type ListBoardsInput = z.infer<typeof listBoardsInput>;

export const getBoardInput = z
  .object({
    boardId: boardIdSchema.describe(
      "The board's id, as returned by list_boards.",
    ),
    includeElements: z
      .boolean()
      .optional()
      .describe(
        "Also return a capped list of individual elements (default false). " +
          "Each entry has id, type, position, size and its primary text.",
      ),
  })
  .strict();

export type GetBoardInput = z.infer<typeof getBoardInput>;

export const searchBoardsInput = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, "search query cannot be empty")
      .max(
        MAX_SEARCH_TERM,
        `search query cannot exceed ${MAX_SEARCH_TERM} characters`,
      )
      .describe(
        "Text to look for. Matches board names and the text inside board " +
          "scenes (labels, notes, code blocks, frame names, links).",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_SEARCH_LIMIT)
      .optional()
      .describe(
        `Maximum matches to return (1-${MAX_SEARCH_LIMIT}, default 20).`,
      ),
    includeTrashed: z
      .boolean()
      .optional()
      .describe("Also search boards in the trash (default false)."),
  })
  .strict();

export type SearchBoardsInput = z.infer<typeof searchBoardsInput>;

// ---------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------

/** Longest board name accepted, in characters. */
export const MAX_BOARD_NAME = 200;

/**
 * A board name.
 *
 * Trimmed and non-empty, because `renameBoard` in the app refuses a blank name
 * and the HTTP API answers 400 for one — a server that accepted `"   "` would
 * store a board the dashboard renders as an empty card.
 *
 * The upper bound is not arbitrary: a name is rendered in a card, a tab and a
 * breadcrumb, and a model that pastes a paragraph into it has misunderstood the
 * field. Rejecting it teaches the shape of the input, which is the same reason
 * the read schemas cap their limits.
 */
export const boardNameSchema = z
  .string()
  .trim()
  .min(1, "board name cannot be empty")
  .max(MAX_BOARD_NAME, `board name cannot exceed ${MAX_BOARD_NAME} characters`);

/**
 * The scene version a write expects to find.
 *
 * This is the optimistic-concurrency token the editor already uses
 * (`scene_version` in the schema, `baseVersion` in `saveBoardScene`). A write
 * that passes a stale value must fail rather than overwrite: the person who
 * edited the board in the app has newer work, and silently replacing it is the
 * one outcome a tool must never produce.
 *
 * Non-negative because the column starts at 0 and only ever increments.
 */
export const sceneVersionSchema = z
  .number()
  .int()
  .min(0)
  .describe(
    "The scene_version the edit was based on, as returned by get_board or " +
      "list_boards. The write is refused if the board has moved on since, " +
      "rather than overwriting newer work.",
  );

export const createBoardInput = z
  .object({
    name: boardNameSchema
      .optional()
      .describe('Board name. Defaults to "Untitled board".'),
    folderId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Folder to file the board in. Must be one of your own folders; an " +
          "unknown or someone else's folder is refused.",
      ),
  })
  .strict();

export type CreateBoardInput = z.infer<typeof createBoardInput>;

export const renameBoardInput = z
  .object({
    boardId: boardIdSchema.describe("The board to rename."),
    name: boardNameSchema.describe("The new name."),
    expectedSceneVersion: sceneVersionSchema.optional(),
  })
  .strict();

export type RenameBoardInput = z.infer<typeof renameBoardInput>;

export const duplicateBoardInput = z
  .object({
    boardId: boardIdSchema.describe("The board to copy."),
    name: boardNameSchema
      .optional()
      .describe('Name for the copy. Defaults to "<original> (copy)".'),
  })
  .strict();

export type DuplicateBoardInput = z.infer<typeof duplicateBoardInput>;

/**
 * Normalises a search term for comparison.
 *
 * Case-folding only. Whitespace is *not* collapsed: a search for "two  words"
 * should not silently match "two words", because the caller can see the term
 * they sent and would have no way to explain the mismatch.
 */
export const normalizeSearchTerm = (term: string): string => term.toLowerCase();

/** Whether `haystack` contains `needle`, both already lower-cased. */
export const containsTerm = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle);
