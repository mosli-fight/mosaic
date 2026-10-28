/**
 * Database access for the MCP server.
 *
 * ## The data-path decision, in one place
 *
 * The web API (`api/boards/*`) is same-origin and cookie-authenticated: a
 * caller is identified by a signed `mosaic_uid` cookie, or by a
 * `mosaic_session` cookie that resolves to `users.id`. There is no API-key
 * path, and adding one would mean a new auth surface on a public endpoint —
 * explicitly out of scope for this phase.
 *
 * A local stdio server has neither cookie. Its options are:
 *
 * 1. **Read the database directly** with `DATABASE_URL` and a configured owner
 *    identity. Chosen.
 * 2. Mint a `mosaic_uid` cookie and call the HTTP API. Rejected: minting an
 *    identity requires `COOKIE_SECRET`, and doing so is forging a credential —
 *    the server would be impersonating a browser rather than acting as itself.
 *    It would also tie a local tool to a deployed host being reachable.
 * 3. Add API-key auth to the web API. Rejected for this phase by the brief, and
 *    it is the change with the largest blast radius.
 *
 * The cost of (1), stated plainly: the server holds a database credential, so
 * it can read every row the credential can reach. Owner scoping is therefore
 * enforced *in this process* rather than by the database, which is why every
 * query here takes its `WHERE` fragment from {@link boardScope} and none builds
 * one by hand. The README repeats this trade-off for operators.
 *
 * ## What this module deliberately does not do
 *
 * It never selects `scene` for a listing. Scenes are megabytes, and a listing
 * that loaded them would be slow and would risk returning them by accident.
 * Only {@link getBoard} asks for one, and only to summarise it.
 */

import { neon } from "@neondatabase/serverless";

import { boardScope } from "./owner.js";

import type { OwnerIdentity } from "./config.js";

/** A `boards` row as selected by {@link listBoards}. Never includes `scene`. */
export type BoardListRow = {
  id: string;
  name: string;
  folder_id: string | null;
  folder_name: string | null;
  favorite: boolean;
  trashed_at: unknown;
  scene_version: number;
  created_at: unknown;
  updated_at: unknown;
  last_opened_at: unknown;
  scene_bytes: number | null;
};

/** A `boards` row including its scene, for {@link getBoard}. */
export type BoardRow = BoardListRow & {
  scene: string | null;
};

/**
 * Columns safe to send for a listing.
 *
 * Mirrors `LIST_COLUMNS` in `api/boards/index.ts` minus the thumbnail: a
 * thumbnail is a base64 PNG data URL, which is exactly the kind of payload a
 * listing must not carry into a model's context. `scene_bytes` is included
 * because it is the cheap way to say how big a board is without loading it.
 */
const LIST_COLUMNS = `b.id, b.name, b.folder_id, f.name AS folder_name,
  b.favorite, b.trashed_at, b.scene_version, b.created_at, b.updated_at,
  b.last_opened_at, b.scene_bytes`;

/** Full row including `scene`, for the one call that needs to summarise it. */
const FULL_COLUMNS = `${LIST_COLUMNS}, b.scene`;

/** A board as the tools return it. Timestamps are epoch ms, like the app's. */
export type BoardMeta = {
  id: string;
  name: string;
  folderId: string | null;
  folderName: string | null;
  favorite: boolean;
  trashed: boolean;
  sceneVersion: number;
  createdAt: number | null;
  updatedAt: number | null;
  lastOpenedAt: number | null;
  sceneBytes: number | null;
};

/**
 * Postgres timestamptz -> epoch milliseconds.
 *
 * Same contract as `toEpochMs` in `api/_db.ts`, and duplicated rather than
 * imported because that module also builds a Neon client from `DATABASE_URL` at
 * import time. Importing it here would create a second client with its own
 * connection settings and make this server's configuration ambiguous.
 *
 * Anything unparseable becomes `null` rather than `NaN`, so one bad row cannot
 * poison a sort or a comparison.
 */
const toEpochMs = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/** The `Board` shape the dashboard speaks, minus the fields a listing omits. */
export const toBoardMeta = (row: BoardListRow): BoardMeta => ({
  id: row.id,
  name: row.name,
  folderId: row.folder_id ?? null,
  folderName: row.folder_name ?? null,
  favorite: row.favorite === true,
  trashed: row.trashed_at !== null && row.trashed_at !== undefined,
  sceneVersion: row.scene_version ?? 0,
  createdAt: toEpochMs(row.created_at),
  updatedAt: toEpochMs(row.updated_at),
  lastOpenedAt: toEpochMs(row.last_opened_at),
  sceneBytes: row.scene_bytes ?? null,
});

/**
 * The database handle.
 *
 * Built lazily and memoised, like `api/_db.ts`, so importing this module does
 * not throw when `DATABASE_URL` is unset. The server reports a configuration
 * error from `main` instead, which produces a message a person can act on
 * rather than a stack trace at module evaluation.
 */
type QueryFn = (text: string, params?: unknown[]) => Promise<unknown[]>;

export type Database = {
  query: QueryFn;
};

export const createDatabase = (databaseUrl: string): Database => {
  const sql = neon(databaseUrl);
  return {
    /**
     * Parameterised query, pinned to a row array.
     *
     * The driver's return type is a union that includes the no-result-set
     * shape, so `rows[0]` does not typecheck even though every call here is a
     * SELECT that really does yield rows. The cast lives here, once.
     */
    query: async (text, params = []) =>
      (await sql.query(text, params as never[])) as unknown as unknown[],
  };
};

/** How a listing is filtered and ordered. */
export type ListOptions = {
  /** Include soft-deleted boards. Off by default: the trash is not "my boards". */
  includeTrashed?: boolean;
  /** Only boards in this folder. */
  folderId?: string;
  /** Only boards not in any folder. Ignored when `folderId` is set. */
  unfiledOnly?: boolean;
  limit: number;
  offset: number;
};

export type ListResult = {
  boards: BoardMeta[];
  /** Total matching rows, ignoring limit/offset, so a caller can page. */
  total: number;
};

/**
 * Lists a caller's boards, newest-used first.
 *
 * Ordering is `COALESCE(last_opened_at, updated_at) DESC`, matching the app's
 * real "recent" sort (`selectors.ts:47`) rather than plain `updated_at`: a board
 * that was opened but not edited should still sort as recently used.
 *
 * The count is a second query rather than a window function because the two
 * want different shapes — a window function would repeat the total on every row
 * and make the page size look like the total to anything that reads `rows[0]`.
 * Both queries are scoped by the same fragment, so they cannot disagree about
 * which rows are visible.
 */
export const listBoards = async (
  db: Database,
  owner: OwnerIdentity,
  options: ListOptions,
): Promise<ListResult> => {
  const scope = boardScope(owner);
  const filters: string[] = [scope.sql];
  const params: unknown[] = [...scope.params];

  if (!options.includeTrashed) {
    filters.push("b.trashed_at IS NULL");
  }

  if (options.folderId !== undefined) {
    params.push(options.folderId);
    filters.push(`b.folder_id = $${params.length}`);
  } else if (options.unfiledOnly) {
    filters.push("b.folder_id IS NULL");
  }

  const where = filters.join(" AND ");

  const countRows = (await db.query(
    `SELECT count(*)::int AS total FROM boards b WHERE ${where}`,
    params,
  )) as { total: number }[];

  // The page parameters follow the filter parameters, so the placeholders are
  // numbered from whatever the filters used rather than assumed to be $2/$3.
  const limitPlaceholder = `$${params.length + 1}`;
  const offsetPlaceholder = `$${params.length + 2}`;

  const rows = (await db.query(
    `SELECT ${LIST_COLUMNS} FROM boards b
     LEFT JOIN folders f ON f.id = b.folder_id
     WHERE ${where}
     ORDER BY COALESCE(b.last_opened_at, b.updated_at) DESC, b.id
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    [...params, options.limit, options.offset],
  )) as BoardListRow[];

  return {
    boards: rows.map(toBoardMeta),
    total: countRows[0]?.total ?? rows.length,
  };
};

/**
 * Loads one board with its scene, or null when it is not the caller's.
 *
 * Ownership is part of the `WHERE`, exactly as `loadOwned` in
 * `api/boards/[id].ts` does it: an id that exists but belongs to someone else is
 * indistinguishable from one that does not exist. That is deliberate — a
 * distinct answer would confirm the id is real.
 */
export const getBoard = async (
  db: Database,
  owner: OwnerIdentity,
  id: string,
): Promise<BoardRow | null> => {
  const scope = boardScope(owner, 2);
  const rows = (await db.query(
    `SELECT ${FULL_COLUMNS} FROM boards b
     LEFT JOIN folders f ON f.id = b.folder_id
     WHERE b.id = $1 AND ${scope.sql}`,
    [id, ...scope.params],
  )) as BoardRow[];
  return rows[0] ?? null;
};

/**
 * Every live board of one owner, with its scene.
 *
 * Only `search_boards` uses this, and only because searching scene *content*
 * cannot be pushed into SQL: `scene` is a `TEXT` column holding the editor's
 * serialised JSON, so `ILIKE` on it would match JSON keys and escaped markup as
 * readily as the words a person typed. Parsing is the only way to search what
 * the board actually says.
 *
 * `trashed_at IS NULL` is not an optimisation: a search that surfaced trashed
 * boards would be confusing, and the trash is reachable by listing with
 * `includeTrashed`.
 */
export const listBoardsWithScenes = async (
  db: Database,
  owner: OwnerIdentity,
): Promise<BoardRow[]> => {
  const scope = boardScope(owner);
  return (await db.query(
    `SELECT ${FULL_COLUMNS} FROM boards b
     LEFT JOIN folders f ON f.id = b.folder_id
     WHERE ${scope.sql} AND b.trashed_at IS NULL
     ORDER BY COALESCE(b.last_opened_at, b.updated_at) DESC, b.id`,
    scope.params,
  )) as BoardRow[];
};

/**
 * Boards whose *name* matches, scoped to the caller.
 *
 * Used by `search_boards` so a name match is found without loading every scene.
 * `ILIKE` with a leading wildcard cannot use the name index, which is fine here:
 * the owner scope already narrows the scan to one person's boards.
 */
export const searchBoardNames = async (
  db: Database,
  owner: OwnerIdentity,
  term: string,
  limit: number,
): Promise<BoardMeta[]> => {
  const scope = boardScope(owner, 2);
  const rows = (await db.query(
    `SELECT ${LIST_COLUMNS} FROM boards b
     LEFT JOIN folders f ON f.id = b.folder_id
     WHERE b.name ILIKE $1 AND ${scope.sql} AND b.trashed_at IS NULL
     ORDER BY COALESCE(b.last_opened_at, b.updated_at) DESC, b.id
     LIMIT $3`,
    [`%${escapeLike(term)}%`, ...scope.params, limit],
  )) as BoardListRow[];
  return rows.map(toBoardMeta);
};

/**
 * Escapes the wildcards `LIKE`/`ILIKE` treat specially.
 *
 * Without this, searching for `50%` would match every board whose name starts
 * with "50", and a search for `_` would match everything. The backslash is
 * Postgres's default escape character; no `ESCAPE` clause is needed.
 */
export const escapeLike = (term: string): string =>
  term.replace(/[\\%_]/g, (character) => `\\${character}`);
