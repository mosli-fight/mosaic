/**
 * The write queries.
 *
 * Kept apart from `db.ts` for one reason: `db.ts` is the read path, and its
 * module comment makes a structural promise — that the read-only server has no
 * `INSERT`, `UPDATE` or `DELETE` anywhere in it. Phase 2 adds writes, so the
 * promise is narrowed rather than deleted: `db.ts` still has none, and every
 * statement that changes a row lives here.
 *
 * ## The three rules every statement in this file follows
 *
 * 1. **Owner scoping is part of the `WHERE`.** Never a read-then-check: a
 *    check-then-write has a window, and an id that belongs to someone else must
 *    be indistinguishable from one that does not exist. The scope fragment comes
 *    from {@link boardScope}, the same function the HTTP API uses.
 * 2. **A scene write is conditional on `scene_version`.** The caller says which
 *    version it edited; the update only lands if that is still the stored one.
 *    A stale writer gets zero rows, and {@link updateScene} then reads back the
 *    current version so the error can say what it actually is.
 * 3. **Placeholders never share a type slot.** Postgres infers one type per
 *    placeholder, so reusing `$1` for both a uuid and a text owner is a runtime
 *    error, not a style issue. Value parameters are numbered first and the scope
 *    parameters follow them, which is the same arrangement `api/boards/[id].ts`
 *    arrived at after trashing broke while renaming worked.
 */

import { boardScope, folderScope } from "./owner.js";

import type { OwnerIdentity } from "./config.js";
import type { BoardListRow, BoardRow, Database } from "./db.js";

/**
 * The `boards` columns a write returns.
 *
 * Deliberately the same list as `db.ts`'s listing columns, plus `scene` only
 * where a caller needs it. A write reply is metadata — echoing a multi-megabyte
 * scene back to a model would undo everything the read path does to keep replies
 * small.
 */
const RETURNING_COLUMNS = `b.id, b.name, b.folder_id, NULL::text AS folder_name,
  b.favorite, b.trashed_at, b.scene_version, b.created_at, b.updated_at,
  b.last_opened_at, b.scene_bytes`;

/**
 * The two owner columns, as one value object.
 *
 * `owner_uid` is `NOT NULL` in the schema and has no default, while a signed-in
 * board is scoped by `user_id`. The HTTP API inserts only the scoped column and
 * relies on that being enough; this server sets both, because it cannot assume
 * the deployed schema has grown a default for the column the API omits. The
 * value used for a signed-in owner is the empty string, which is exactly what
 * `api/boards/index.ts` writes into `activity.owner_uid` for the same actor —
 * and it is unreachable by any guest, because a guest's scope also requires
 * `user_id IS NULL`.
 */
const ownerColumns = (
  owner: OwnerIdentity,
): { userId: string | null; ownerUid: string } =>
  owner.kind === "user"
    ? { userId: owner.userId, ownerUid: "" }
    : { userId: null, ownerUid: owner.ownerUid };

/** Whether a folder exists and belongs to the caller. */
export const folderOwned = async (
  db: Database,
  owner: OwnerIdentity,
  folderId: string,
): Promise<boolean> => {
  const scope = folderScope(owner, 2);
  const rows = await db.query(
    `SELECT 1 FROM folders f WHERE f.id = $1 AND ${scope.sql}`,
    [folderId, ...scope.params],
  );
  return rows.length > 0;
};

/** Inserts a board and returns its row. */
export const insertBoard = async (
  db: Database,
  owner: OwnerIdentity,
  input: {
    name: string;
    folderId: string | null;
    scene?: string | null;
    sceneBytes?: number | null;
    thumbnail?: string | null;
  },
): Promise<BoardRow> => {
  const columns = ownerColumns(owner);
  const scene = input.scene ?? null;
  const sceneBytes = input.sceneBytes ?? null;
  const thumbnail = input.thumbnail ?? null;

  const rows = (await db.query(
    `INSERT INTO boards (user_id, owner_uid, name, folder_id, thumbnail, scene, scene_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${RETURNING_COLUMNS}`,
    [
      columns.userId,
      columns.ownerUid,
      input.name,
      input.folderId,
      thumbnail,
      scene,
      sceneBytes,
    ],
  )) as BoardRow[];

  // `RETURNING` on a successful single-row INSERT always yields a row; the
  // fallback exists so the type is `BoardRow` rather than `BoardRow | undefined`
  // and a driver surprise cannot masquerade as a successful create.
  const row = rows[0];
  if (!row) {
    throw new Error("the board insert returned no row");
  }
  return row;
};

/** Appends an activity row, mirroring what the HTTP API logs for the same action. */
export const logActivity = async (
  db: Database,
  owner: OwnerIdentity,
  boardId: string,
  type: "create" | "rename",
  detail?: string,
): Promise<void> => {
  await db.query(
    `INSERT INTO activity (owner_uid, board_id, type, detail)
     VALUES ($1, $2, $3, $4)`,
    [ownerColumns(owner).ownerUid, boardId, type, detail ?? null],
  );
};

/**
 * Renames a board, optionally guarded by the scene version the caller saw.
 *
 * The version guard is optional here and required for scene writes, which is a
 * deliberate asymmetry: a rename does not touch the scene, so it cannot clobber
 * one. Requiring a version would make a rename fail for a reason unrelated to
 * what it changes — and the HTTP API is explicit that `scene_version` advances
 * only when the scene changes, so a rename must not invalidate an in-flight
 * scene save either.
 *
 * When a caller *does* pass `expectedSceneVersion`, it is honoured: a rename
 * against a board that moved on is refused rather than applied, which is what
 * someone editing a stale listing should see.
 */
export const renameBoardRow = async (
  db: Database,
  owner: OwnerIdentity,
  input: {
    boardId: string;
    name: string;
    expectedSceneVersion?: number;
  },
): Promise<{ row: BoardRow | null; conflict: BoardRow | null }> => {
  const params: unknown[] = [input.name, input.boardId];
  let versionFilter = "";

  if (input.expectedSceneVersion !== undefined) {
    params.push(input.expectedSceneVersion);
    versionFilter = ` AND b.scene_version = $${params.length}`;
  }

  const scope = boardScope(owner, params.length + 1);

  const rows = (await db.query(
    `UPDATE boards b SET name = $1, updated_at = now()
     WHERE b.id = $2${versionFilter} AND ${scope.sql}
     RETURNING ${RETURNING_COLUMNS}`,
    [...params, ...scope.params],
  )) as BoardRow[];

  if (rows[0]) {
    return { row: rows[0], conflict: null };
  }

  // Zero rows means either "not yours" or "the version moved". The caller needs
  // to tell those apart to give a useful error, so the board is re-read under
  // the same scope. This read is not a check-then-write: the write already
  // failed, and the answer only shapes the message.
  const current = await loadBoardMeta(db, owner, input.boardId);
  return { row: null, conflict: current };
};

/** Reads one board's metadata (no scene), scoped to the caller. */
export const loadBoardMeta = async (
  db: Database,
  owner: OwnerIdentity,
  boardId: string,
): Promise<BoardRow | null> => {
  const scope = boardScope(owner, 2);
  const rows = (await db.query(
    `SELECT ${RETURNING_COLUMNS} FROM boards b
     WHERE b.id = $1 AND ${scope.sql}`,
    [boardId, ...scope.params],
  )) as BoardRow[];
  return rows[0] ?? null;
};

/** Reads one board including its scene and thumbnail, scoped to the caller. */
export const loadBoardForWrite = async (
  db: Database,
  owner: OwnerIdentity,
  boardId: string,
): Promise<(BoardRow & { thumbnail: string | null }) | null> => {
  const scope = boardScope(owner, 2);
  const rows = (await db.query(
    `SELECT ${RETURNING_COLUMNS}, b.scene, b.thumbnail FROM boards b
     WHERE b.id = $1 AND ${scope.sql}`,
    [boardId, ...scope.params],
  )) as (BoardRow & { thumbnail: string | null })[];
  return rows[0] ?? null;
};

/**
 * Writes a scene, but only if the stored version is still the one the caller
 * edited.
 *
 * The version is bumped in the same statement (`scene_version + 1`), so there is
 * no window between checking and writing — a concurrent writer either gets its
 * own row first, in which case this one matches nothing, or finds this one
 * already applied.
 *
 * `updated_at` moves on every successful write: it is what the default "recent"
 * ordering and the card timestamp render.
 *
 * @returns the updated row, or `null` when nothing matched
 */
export const updateScene = async (
  db: Database,
  owner: OwnerIdentity,
  input: {
    boardId: string;
    scene: string;
    sceneBytes: number;
    expectedSceneVersion: number;
  },
): Promise<BoardRow | null> => {
  const scope = boardScope(owner, 5);
  const rows = (await db.query(
    `UPDATE boards b
     SET scene = $1, scene_bytes = $2, scene_version = b.scene_version + 1,
         updated_at = now()
     WHERE b.id = $3 AND b.scene_version = $4 AND ${scope.sql}
     RETURNING ${RETURNING_COLUMNS}`,
    [
      input.scene,
      input.sceneBytes,
      input.boardId,
      input.expectedSceneVersion,
      ...scope.params,
    ],
  )) as BoardRow[];
  return rows[0] ?? null;
};

/**
 * Copies a board's scene and metadata into a new row.
 *
 * The copy is unfiled and unfavourited, matching `duplicateBoard` in both
 * storage adapters (`mosaic-dashboard/src/lib/storage/*`): duplicating should
 * not silently clone someone's organisational decisions. What *is* copied is
 * everything that makes the duplicate usable — the scene, its byte count and
 * the thumbnail — plus a name that says where it came from.
 *
 * The source is read and the copy inserted as two statements rather than one
 * `INSERT ... SELECT`, so the read is owner-scoped by the same fragment every
 * other query uses. An `INSERT ... SELECT` would need the scope in a subquery
 * and would report a missing source as "0 rows inserted", which is a worse
 * error than "no board with that id".
 */
export const duplicateBoardRow = async (
  db: Database,
  owner: OwnerIdentity,
  input: {
    source: BoardRow & { thumbnail?: string | null };
    name: string;
  },
): Promise<BoardRow> =>
  insertBoard(db, owner, {
    name: input.name,
    folderId: null,
    scene: input.source.scene ?? null,
    sceneBytes: input.source.scene_bytes ?? null,
    thumbnail: input.source.thumbnail ?? null,
  });

/** A listing row, re-exported so callers of this module need only one import. */
export type { BoardListRow };
