/**
 * API-key authentication for the hosted MCP endpoint.
 *
 * ## Why keys, and why not the cookie
 *
 * The web API identifies a caller with a signed `mosaic_uid` cookie or a
 * `mosaic_session` cookie. A remote MCP client has neither and cannot hold
 * one: it is not a browser, it has no cookie jar, and handing it a cookie
 * would mean minting a credential on its behalf, which is forging an
 * identity. The hosted endpoint therefore takes a bearer token instead.
 *
 * ## What is stored, and what is not
 *
 * Only the SHA-256 hex digest of a key is stored, in `api_keys.key_hash`.
 * The plaintext is shown once, when the key is created, and never written
 * anywhere. A database leak then yields digests that cannot be replayed as
 * credentials — the lookup is `WHERE key_hash = $1`, so the raw value is
 * never needed server-side either. SHA-256 is enough here because the key
 * itself carries 256 bits of entropy from `randomBytes`; there is no
 * low-entropy secret to brute-force offline, which is the case a slow hash
 * like bcrypt exists for.
 *
 * ## The mapping is the whole security property
 *
 * Every row carries exactly one of `user_id` / `owner_uid`, mirroring the
 * `Actor` shape in `api/_owner.ts`. Resolving a key produces the
 * `OwnerIdentity` the MCP server already understands, and from there the
 * existing `boardScope` applies unchanged. A key can therefore only ever
 * reach its own owner's boards, and a key with neither column set is
 * rejected rather than treated as unscoped.
 *
 * ## Revocation is a timestamp, not a delete
 *
 * `revoked_at` is set and the row kept. Deleting the row would be
 * equivalent for the lookup, but keeping it preserves an audit trail of
 * which keys existed and when each one was cut off — the thing an operator
 * wants after a leak. `last_used_at` is updated on every successful
 * authentication so a key that has gone quiet can be retired by eye.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";

import { createHash } from "node:crypto";

import { query } from "../../../api/_db.js";

import type { OwnerIdentity } from "./config.js";

/** Prefix every issued key carries, so a key is recognisable in a log. */
export const API_KEY_PREFIX = "msk_";

/** The database handle used here. Kept structural so tests can fake it. */
export type KeyDatabase = {
  query: (text: string, params?: unknown[]) => Promise<unknown[]>;
};

/**
 * Hashes a key for storage.
 *
 * SHA-256 hex, `createHash` from `node:crypto`. The digest is what the
 * database holds and what the lookup compares against.
 */
export const hashApiKey = (key: string): string =>
  createHash("sha256").update(key).digest("hex");

/**
 * Generates a new key.
 *
 * `msk_` plus 32 random bytes, base64url-encoded. The prefix is not secret;
 * it is what lets a human scanning a config, or a log line, tell a Mosaic
 * key from any other token. The base64url alphabet carries about 43
 * characters for 256 bits of entropy.
 */
export const generateApiKey = (): string =>
  `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;

/**
 * Compares two digests in constant time.
 *
 * `timingSafeEqual` needs equal-length buffers, so a malformed value returns
 * false before the comparison rather than throwing. Exported separately so
 * the constant-time property is testable.
 */
export const digestsEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
};

/**
 * Extracts the bearer token from an `Authorization` header.
 *
 * Accepts exactly `Bearer <token>`, case-insensitively on the scheme, and
 * nothing else. A malformed header yields `null` rather than a best-effort
 * token, because guessing at a credential's shape is how a request ends up
 * authenticated as the wrong identity.
 */
export const bearerToken = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
};

/** Which owner a live key belongs to. */
export type ApiKeyOwner = {
  user_id: string | null;
  owner_uid: string | null;
};

/**
 * Resolves a presented key to its owner, or `null` when it is not usable.
 *
 * The query is an exact match on the digest, filtered to live keys only
 * (`revoked_at IS NULL`). A revoked key, an unknown key and a key whose row
 * carries neither owner column all yield `null`; the caller answers the same
 * 401 to all three so the response cannot be used to probe which state a
 * key is in.
 *
 * On a hit, `last_used_at` is touched. That write is best-effort: a failure
 * to record usage must not turn a valid key into a 401.
 */
export const resolveApiKeyOwner = async (
  db: KeyDatabase,
  key: string,
): Promise<OwnerIdentity | null> => {
  const rows = (await db.query(
    `SELECT user_id, owner_uid FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hashApiKey(key)],
  )) as ApiKeyOwner[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  const owner: OwnerIdentity | null = row.user_id
    ? { kind: "user", userId: row.user_id }
    : row.owner_uid
    ? { kind: "guest", ownerUid: row.owner_uid }
    : null;

  if (!owner) {
    return null;
  }

  try {
    await db.query(
      `UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1`,
      [hashApiKey(key)],
    );
  } catch {
    // Usage tracking is observability, not authentication. Swallowing the
    // failure keeps a valid key valid.
  }

  return owner;
};

/**
 * The `query` from `api/_db.ts`, adapted to the structural database handle.
 *
 * The hosted route runs in the `api/` tree, where `query` is the established
 * database seam, so it resolves keys through that rather than through a
 * second Neon client.
 */
export const apiKeyDatabase: KeyDatabase = {
  query: async (text, params = []) => query(text, params),
};

/**
 * Creates a key for one owner and returns the plaintext.
 *
 * The plaintext is returned once and never stored. The caller is responsible
 * for showing it to the operator and then letting it go.
 */
export const createApiKey = async (
  db: KeyDatabase,
  owner: OwnerIdentity,
): Promise<string> => {
  const key = generateApiKey();
  const hash = hashApiKey(key);

  if (owner.kind === "user") {
    await db.query(`INSERT INTO api_keys (key_hash, user_id) VALUES ($1, $2)`, [
      hash,
      owner.userId,
    ]);
  } else {
    await db.query(
      `INSERT INTO api_keys (key_hash, owner_uid) VALUES ($1, $2)`,
      [hash, owner.ownerUid],
    );
  }

  return key;
};

/**
 * Revokes a key by its id.
 *
 * Sets `revoked_at` rather than deleting, so the row survives as an audit
 * record. Returns true when a live key was revoked.
 */
export const revokeApiKey = async (
  db: KeyDatabase,
  keyId: string,
): Promise<boolean> => {
  const rows = (await db.query(
    `UPDATE api_keys SET revoked_at = now()
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [keyId],
  )) as { id: string }[];
  return rows.length > 0;
};

/**
 * Lists an owner's keys, without their digests.
 *
 * The hash is deliberately not selectable here: a listing is what an
 * operator reads on a screen, and there is no reason for it to carry
 * credential material.
 */
export const listApiKeys = async (
  db: KeyDatabase,
  owner: OwnerIdentity,
): Promise<
  {
    id: string;
    label: string | null;
    createdAt: unknown;
    lastUsedAt: unknown;
    revokedAt: unknown;
  }[]
> => {
  const rows = (await db.query(
    owner.kind === "user"
      ? `SELECT id, label, created_at, last_used_at, revoked_at
         FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`
      : `SELECT id, label, created_at, last_used_at, revoked_at
         FROM api_keys WHERE owner_uid = $1 ORDER BY created_at DESC`,
    [owner.kind === "user" ? owner.userId : owner.ownerUid],
  )) as {
    id: string;
    label: string | null;
    created_at: unknown;
    last_used_at: unknown;
    revoked_at: unknown;
  }[];

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }));
};
