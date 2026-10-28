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
