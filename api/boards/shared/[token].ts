import { json, pathSegmentAfter, query, toBoard } from "../../_db.js";

import type { ApiRequest, ApiResponse, BoardRow } from "../../_db.js";

/**
 * `GET /api/boards/shared/[token]` — read a shared board, unauthenticated.
 *
 * **No auth, by design.** The token is the capability; a share link is meant to be
 * pasted into a chat and opened by someone with no Mosaic account. Adding a session
 * requirement would turn sharing into "sharing between people who have already
 * signed up", which is not what the feature is for.
 *
 * That makes this the most security-sensitive route in the codebase, so what it
 * deliberately does *not* do is as important as what it does:
 *
 * - No owner identity, no email, no `owner_uid` in the response. A share link should
 *   not tell you whose it is.
 * - No `scene_version`, no `scene_bytes`. Those are internal bookkeeping.
 * - Only live boards. A trashed board's link stops working, because trashing is how
 *   a user says "this should not be reachable".
 * - The thumbnail is included; it is the whole point of a read-only view, and it is
 *   data the owner chose to save.
 *
 * A miss answers 404 with the same body whether the token was never valid, was
 * revoked, or the board was trashed. Distinguishing them would let anyone probe
 * whether a token once existed.
 */
export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
  ctx?: { params?: { token?: string } },
): Promise<void> {
  try {
    if ((req.method ?? "GET") !== "GET") {
      res.setHeader("Allow", "GET");
      json(res, { error: "method not allowed" }, 405);
      return;
    }

    // From the URL, not from `ctx.params`: Vercel's Node runtime has been observed
    // calling these handlers with the context argument undefined. Without this the
    // token is always "" and every share link 404s — see `pathSegmentAfter`.
    const token = ctx?.params?.token ?? pathSegmentAfter(req, "shared");

    // Shape check before the database. A token we could not have issued is not worth
    // a round trip, and 64 lowercase hex characters is exactly what we mint.
    if (!/^[0-9a-f]{64}$/.test(token)) {
      json(res, { error: "not found" }, 404);
      return;
    }

    const rows = await query<BoardRow>(
      `SELECT id, name, folder_id, favorite, trashed_at, thumbnail, scene,
              scene_version, created_at, updated_at, last_opened_at, scene_bytes
       FROM boards
       WHERE share_token = $1
         AND share_mode = 'view'
         AND trashed_at IS NULL`,
      [token],
    );

    const row = rows[0];
    if (!row) {
      json(res, { error: "not found" }, 404);
      return;
    }

    const board = toBoard(row);

    // Strip everything a public reader has no business seeing. Done here rather than
    // at the mapper so the shared shape is obvious in one place and cannot drift as
    // the internal Board type grows.
    const view = {
      id: board.id,
      name: board.name,
      thumbnail: board.thumbnail,
      scene: board.scene,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      favorite: false,
      folderId: null,
      trashedAt: null,
      sceneVersion: 0,
      lastOpenedAt: null,
    };

    // Explicitly no-store: this response is per-token and per-revoke-state, and a
    // cached copy would survive a revoke.
    res.setHeader("Cache-Control", "no-store");
    json(res, { board: view });
  } catch (error) {
    console.error("[api/boards/shared/[token]]", error);
    json(res, { error: "internal error" }, 500);
  }
}
