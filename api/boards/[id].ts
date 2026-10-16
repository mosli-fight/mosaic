import {
  json,
  pathSegmentAfter,
  query,
  rateLimitOk,
  readJson,
  toBoard,
  toIso,
} from "../_db.js";

import { ownerScope, resolveActor } from "../_owner.js";

import type { ApiRequest, ApiResponse, BoardRow } from "../_db.js";

import type { Actor } from "../_owner.js";

/**
 * Single-board endpoint: read, update, delete.
 */

/** Full row including `scene`, for when a board is actually opened. */
const FULL_COLUMNS = `id, name, folder_id, favorite, trashed_at, thumbnail, scene,
  scene_version, created_at, updated_at, last_opened_at, scene_bytes`;

/**
 * Loads a board only if it belongs to the caller.
 *
 * Ownership is part of the query rather than a separate check, so there is no
 * read-then-check window and no 403/404 mix-up: an id that exists but is not
 * yours is indistinguishable from one that does not exist. Returning 404 for both
 * is deliberate — a 403 would confirm the id is real, which leaks a little about
 * other users' data.
 */
const loadOwned = (id: string, actor: Actor) => {
  const scope = ownerScope(actor);
  return query<BoardRow>(
    `SELECT ${FULL_COLUMNS} FROM boards b
     WHERE b.id = $2 AND ${scope.sql}`,
    [...scope.params, id],
  );
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

/**
 * `GET /api/boards/[id]`
 *
 * Returns the board *with* its scene — the `getBoardWithScene` path, the one call
 * that loads what the editor needs. Also bumps `last_opened_at`, which is what
 * makes the "recent" sort reflect actual usage rather than last edit
 * (`selectors.ts:47`), mirroring `touchOpened` in `db/operations.ts:265`.
 */
const handleGet = async (
  id: string,
  res: ApiResponse,
  actor: Actor,
): Promise<void> => {
  const row = (await loadOwned(id, actor))[0];
  if (!row) {
    json(res, { error: "not found" }, 404);
    return;
  }

  const scope = ownerScope(actor);
  await query(
    `UPDATE boards b SET last_opened_at = now()
     WHERE b.id = $2 AND ${scope.sql}`,
    [...scope.params, id],
  );

  json(res, { board: toBoard({ ...row, last_opened_at: new Date() }) });
};

/**
 * `PATCH /api/boards/[id]`
 *
 * Applies a partial update: only keys present in the body are touched, so a
 * rename cannot clobber `thumbnail` and a scene save cannot reset `favorite`.
 *
 * `scene_version` advances only when the scene changes, never otherwise. It is
 * the app's optimistic-concurrency token (`schema.ts:35`), so an unrelated rename
 * must not invalidate an in-flight scene save.
 *
 * `trashedAt` is written as an absolute timestamptz from epoch ms, and `null`
 * restores the board. That is how trash and restore are expressed, mirroring
 * `trashBoard` / `restoreBoard`.
 */
const handlePatch = async (
  req: ApiRequest,
  res: ApiResponse,
  id: string,
  actor: Actor,
): Promise<void> => {
  const body = readJson(req);
  if (body === null) {
    json(res, { error: "invalid JSON body" }, 400);
    return;
  }

  const owned = await loadOwned(id, actor);
  if (!owned[0]) {
    json(res, { error: "not found" }, 404);
    return;
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  /**
   * Appends one `column = $n` assignment.
   *
   * `cast` exists because the Neon driver sends parameters as text and Postgres will
   * not implicitly coerce a text parameter into `timestamptz`:
   * `column "trashed_at" is of type timestamp with time zone but expression is of
   * type text`. Relying on the driver's type inference is what made trash fail, so
   * anything non-text says so in the SQL.
   */
  const push = (column: string, value: unknown, cast?: string) => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast ? `::${cast}` : ""}`);
  };

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      // `renameBoard` refuses a blank name; keeping that here means the UI gets a
      // 400 instead of silently storing an unnamed board.
      json(res, { error: "name cannot be empty" }, 400);
      return;
    }
    push("name", trimmed);
  }
  if (typeof body.favorite === "boolean") {
    push("favorite", body.favorite);
  }
  if ("folderId" in body) {
    const folderId =
      typeof body.folderId === "string" && body.folderId ? body.folderId : null;
    if (folderId !== null) {
      const fscope = ownerScope(actor, "f");
      const owns = await query(
        `SELECT 1 FROM folders f WHERE f.id = $2 AND ${fscope.sql}`,
        [...fscope.params, folderId],
      );
      if (owns.length === 0) {
        json(res, { error: "folder not found" }, 404);
        return;
      }
    }
    push("folder_id", folderId);
  }
  if ("trashedAt" in body) {
    const trashedAt = body.trashedAt;
    // Guard the type: `toIso` maps anything non-numeric to null, which would turn
    // a malformed payload into a silent restore.
    if (trashedAt !== null && typeof trashedAt !== "number") {
      json(res, { error: "trashedAt must be a timestamp or null" }, 400);
      return;
    }
    push("trashed_at", toIso(trashedAt as number | null), "timestamptz");
  }
  if (typeof body.thumbnail === "string") {
    push("thumbnail", body.thumbnail);
  }
  if (typeof body.scene === "string") {
    push("scene", body.scene);
    push("scene_bytes", body.scene.length);
    // Bump the concurrency token only for a scene write.
    push("scene_version", owned[0].scene_version + 1);
  }

  if (sets.length === 0) {
    json(res, { error: "no updatable fields supplied" }, 400);
    return;
  }

  // updated_at always moves on a successful write, which is what the default
  // "recent" ordering and the card timestamp render.
  sets.push("updated_at = now()");

  /**
   * The ownership scope gets its own placeholder, after every SET parameter.
   *
   * This looks like a detail and is not. `sets` starts numbering at `$1`, so a
   * default `ownerScope()` would reuse `$1` for the owner column and collide with
   * whatever the first assignment was. Postgres infers one type per parameter, so
   * the collision is invisible for text-to-text updates (a rename, a scene save) and
   * only surfaces on the first non-text one — trashing — as
   * `column "trashed_at" is of type timestamp with time zone but expression is of
   * type text`. Renaming worked and trashing did not, from the same statement.
   */
  params.push(actor.userId ?? actor.ownerUid, id);
  const scope = ownerScope(actor, "b", params.length - 1);
  const updated = await query<BoardRow>(
    `UPDATE boards b SET ${sets.join(", ")}
     WHERE b.id = $${params.length} AND ${scope.sql}
     RETURNING ${FULL_COLUMNS}`,
    params,
  );

  if (!updated[0]) {
    json(res, { error: "not found" }, 404);
    return;
  }

  const board = toBoard(updated[0]);

  // Audit trail, mirroring `logActivity` in `db/operations.ts`. Written after the
  // update so a failed update cannot leave a phantom event.
  //
  // `activity.owner_uid` records the anonymous origin and stays as it is; the
  // activity rows are found by `board_id`, so they follow the board across a claim
  // without being touched.
  if (typeof body.name === "string") {
    await query(
      "INSERT INTO activity (owner_uid, board_id, type, detail) VALUES ($1, $2, 'rename', $3)",
      [actor.ownerUid, id, (body.name as string).trim()],
    );
  } else if (typeof body.favorite === "boolean") {
    await query(
      "INSERT INTO activity (owner_uid, board_id, type, detail) VALUES ($1, $2, 'favorite', $3)",
      [actor.ownerUid, id, body.favorite ? "on" : "off"],
    );
  } else if ("trashedAt" in body && body.trashedAt !== null) {
    // Only trashing is audited. `ActivityType` (schema.ts:78) has no "restore"
    // member, and inventing one here would widen the client's union from the
    // server side.
    await query(
      "INSERT INTO activity (owner_uid, board_id, type) VALUES ($1, $2, 'delete')",
      [actor.ownerUid, id],
    );
  }

  json(res, { board });
};

/**
 * `DELETE /api/boards/[id]`
 *
 * Hard delete. Soft delete (trash) is `PATCH {trashedAt: <epoch ms>}`, matching
 * the app's "delete forever" action; this route is the one behind that action and
 * behind the 30-day purge.
 *
 * `activity` rows go too: the per-board stats chip reads them, so leaving them
 * would show edit counts for a board that no longer exists.
 */
const handleDelete = async (
  id: string,
  res: ApiResponse,
  actor: Actor,
): Promise<void> => {
  const scope = ownerScope(actor);
  const removed = await query(
    `DELETE FROM boards b WHERE b.id = $2 AND ${scope.sql} RETURNING id`,
    [...scope.params, id],
  );
  if (removed.length === 0) {
    json(res, { error: "not found" }, 404);
    return;
  }
  await query("DELETE FROM activity WHERE board_id = $1 AND owner_uid = $2", [
    id,
    actor.ownerUid,
  ]);
  json(res, { ok: true });
};

/**
 * Extracts the board id from the request.
 *
 * Prefers the framework-provided `ctx.params.id`, but does not depend on it:
 * Vercel's Node runtime has been observed invoking this handler with the context
 * argument `undefined`, so `ctx.params.id` is a crash ("Cannot read properties of
 * undefined"), not a feature. `ctx?.params?.id` guards that, and the id is then
 * taken from the path with the same helper the share and shared-token routes use.
 *
 * Deriving it from the URL is safe here because this file only ever serves one
 * route shape — there is no wildcard to disambiguate against.
 */
const boardIdFromRequest = (
  req: ApiRequest,
  ctx?: { params?: { id?: string } },
): string => ctx?.params?.id ?? pathSegmentAfter(req, "boards");

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
  ctx?: { params?: { id?: string } },
): Promise<void> {
  try {
    const actor = await resolveActor(req, res);

    if (!rateLimitOk(actor.userId ?? actor.ownerUid)) {
      json(res, { error: "rate limit exceeded" }, 429);
      return;
    }

    const method = req.method ?? "GET";
    const id = boardIdFromRequest(req, ctx);

    // Reject a malformed id before it reaches Postgres. An invalid uuid would
    // otherwise raise a 22P02 driver error and surface as a 500, when the client
    // simply sent a bad request.
    if (!isUuid(id)) {
      json(res, { error: "invalid board id" }, 400);
      return;
    }

    if (method === "GET") {
      await handleGet(id, res, actor);
      return;
    }
    if (method === "PATCH") {
      await handlePatch(req, res, id, actor);
      return;
    }
    if (method === "DELETE") {
      await handleDelete(id, res, actor);
      return;
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    json(res, { error: "method not allowed" }, 405);
  } catch (error) {
    // Log the real cause server-side; return an opaque 500 so driver errors —
    // which can embed the connection URL — never reach a client.
    console.error("[api/boards/[id]]", error);
    json(res, { error: "internal error" }, 500);
  }
}
