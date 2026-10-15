import { randomBytes } from "node:crypto";

import { json, pathSegmentAfter, query } from "../../_db.js";

import { ownerScope, resolveActor } from "../../_owner.js";

import type { ApiRequest, ApiResponse } from "../../_db.js";

/**
 * `POST` and `DELETE /api/boards/[id]/share` — create or revoke a share link.
 *
 * One file for both because they are the same resource behind the same guard, and
 * splitting them would duplicate the ownership check that decides whether either may
 * happen at all.
 *
 * ## This is deliberate data exposure
 *
 * A share link lets anyone holding it read the board. That is the feature, and it is
 * also the one place in Mosaic where access comes from possession of a string rather
 * than from an account. Two consequences, both enforced here:
 *
 * - The token is 256 bits of entropy. A short or sequential id would let anyone walk
 *   `/share/1`, `/share/2`, … and read every board anyone ever shared.
 * - Only the owner may mint or revoke one. A share link grants read, never re-share.
 *
 * ## Modes
 *
 * `view` is the only mode that does anything today. `edit` is not accepted: creating
 * a link that cannot work would be worse than not offering the option, so the request
 * is refused up front rather than stored and ignored later.
 */

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 256 bits, hex — the same strength as a session token. */
const newShareToken = (): string => randomBytes(32).toString("hex");

/**
 * The mode a request asked for, or null if it is not one we serve.
 *
 * Defaults to `view` when absent, so the common case needs no body at all.
 */
const requestedMode = (body: Record<string, unknown>): "view" | null => {
  const mode = body.mode;
  if (mode === undefined || mode === "view") {
    return "view";
  }
  return null;
};

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
  ctx?: { params?: { id?: string } },
): Promise<void> {
  try {
    const method = req.method ?? "GET";

    if (method !== "POST" && method !== "DELETE") {
      res.setHeader("Allow", "POST, DELETE");
      json(res, { error: "method not allowed" }, 405);
      return;
    }

    const id = ctx?.params?.id ?? pathSegmentAfter(req, "boards");
    if (!uuidRe.test(id)) {
      json(res, { error: "invalid board id" }, 400);
      return;
    }

    const actor = await resolveActor(req, res);
    // $1 is the board id (uuid); the scope value is $2 (text or uuid). Sharing them
    // under one placeholder is a runtime type error in Postgres.
    const scope = ownerScope(actor, "b", 2);

    if (method === "DELETE") {
      // Clearing both columns together is what makes revoke atomic in meaning, not
      // just in SQL: the CHECK constraint makes a half-cleared row unrepresentable.
      const revoked = await query<{ share_token: string; share_mode: string }>(
        `UPDATE boards b SET share_token = NULL, share_mode = NULL
         WHERE b.id = $1 AND ${scope.sql}
         RETURNING share_token, share_mode`,
        [id, ...scope.params],
      );

      if (revoked.length === 0) {
        // Either not theirs, or not shared. Both answer 404, so this never confirms
        // that someone else's board id exists.
        json(res, { error: "not found" }, 404);
        return;
      }
      json(res, { ok: true, wasShared: true });
      return;
    }

    let body: Record<string, unknown> = {};
    if (req.body !== undefined && req.body !== null) {
      try {
        const parsed =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (parsed && typeof parsed === "object") {
          body = parsed as Record<string, unknown>;
        }
      } catch {
        json(res, { error: "invalid JSON body" }, 400);
        return;
      }
    }

    const mode = requestedMode(body);
    if (mode === null) {
      json(
        res,
        {
          error:
            "mode must be 'view'; collaborative editing is not available yet",
        },
        400,
      );
      return;
    }

    /**
     * Mint-or-reuse. Re-sharing a board that is already shared returns the existing
     * link, so a URL someone copied keeps working after the owner clicks Share again.
     *
     * This cannot be an upsert: the conflict target would have to be the row's own
     * id, which is not a unique-key conflict. So it is a read followed by a branch.
     */
    const existing = await query<{ share_token: string; share_mode: string }>(
      `SELECT share_token, share_mode FROM boards b
       WHERE b.id = $1 AND ${scope.sql} AND b.share_token IS NOT NULL`,
      [id, ...scope.params],
    );

    if (existing.length > 0 && existing[0].share_mode === mode) {
      json(res, {
        share: { token: existing[0].share_token, mode },
        created: false,
      });
      return;
    }

    const token = newShareToken();
    const updated = await query<{ share_token: string; share_mode: string }>(
      `UPDATE boards b SET share_token = $3, share_mode = $4
       WHERE b.id = $1 AND ${scope.sql}
       RETURNING share_token, share_mode`,
      [id, ...scope.params, token, mode],
    );

    if (updated.length === 0) {
      json(res, { error: "not found" }, 404);
      return;
    }

    json(res, { share: { token, mode }, created: true }, 201);
  } catch (error) {
    console.error("[api/boards/[id]/share]", error);
    json(res, { error: "internal error" }, 500);
  }
}
