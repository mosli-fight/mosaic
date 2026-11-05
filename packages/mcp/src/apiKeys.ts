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
 * Only a scrypt-derived digest of a key is stored, in `api_keys.key_hash`.
 * The plaintext is shown once, when the key is created, and never written
 * anywhere. A database leak then yields digests that cannot be replayed as
 * credentials, because the lookup recomputes from the salt stored in each
 * candidate row and compares — the raw value is never needed server-side
 * either.
 *
 * A plain fast hash such as SHA-256 is not sufficient for a stored credential
 * digest: a leaked `key_hash` column can be attacked offline at GPU speed,
 * and any fast digest is only as strong as the pepper / key-management story
 * around it. The digest below therefore uses `crypto.scryptSync` (Node's
 * built-in memory-hard KDF, no new dependency) with a per-key random salt
 * and deliberately expensive parameters, and the KDF input is bound to a
 * server-side pepper (`API_KEY_PEPPER`): without the pepper, a stolen
 * database does not disclose the pepper and the digests alone do not
 * authenticate. The salt lives inside the stored value so verification can
 * recompute and constant-time-compare without a separate column, and the
 * 256-bit `msk_` key entropy is unchanged.
 *
 * Pepper rotation invalidates all existing keys: stored digests can only be
 * recomputed from the plaintext, which no longer exists, so rotating
 * `API_KEY_PEPPER` requires re-issuing keys. That is intentional — a pepper
 * change is a credential invalidation event, not a silent recomputation.
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

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { query } from "../../../api/_db.js";

import type { OwnerIdentity } from "./config.js";

/** Prefix every issued key carries, so a key is recognisable in a log. */
export const API_KEY_PREFIX = "msk_";

/**
 * The `scrypt` parameters for stored digests.
 *
 * `N = 2^15, r = 8, p = 1` (RFC 7914 interactive parameters): each derivation
 * costs ~64 MiB of memory and tens of milliseconds, fast enough for one
 * request-scoped verification but not for offline brute force. `maxmem` is
 * set explicitly (128 MiB) because Node's default limit rejects these
 * parameters on some builds.
 */
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;
const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_BYTES = 16;

/** Version prefix on stored digests, so the scheme can be rotated later. */
const DIGEST_PREFIX = "scrypt$";

/**
 * Development / test fallback pepper. Mirrors the `COOKIE_SECRET` fallback in
 * `api/_db.ts`: fine for local work with no setup, refused in production (see
 * {@link pepper}). Never written to the database — only sent as part of the
 * input to the KDF, which is itself the secret.
 */
const DEV_FALLBACK_API_KEY_PEPPER = "mosaic-dev-insecure-api-key-pepper";

/**
 * The server-side pepper (`API_KEY_PEPPER`).
 *
 * Required in production, mirroring `COOKIE_SECRET` in `api/_db.ts`: a
 * well-known fallback there would let anyone with the database recompute
 * digests. In development / test the fallback keeps `vercel dev` working
 * with no setup, but it is never used in production. Rotating this value
 * invalidates every stored digest — re-issue keys when it changes.
 */
const pepper = (): string => {
  const fromEnv = process.env.API_KEY_PEPPER;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_KEY_PEPPER must be set in production; refusing to hash API keys " +
        "with a well-known fallback.",
    );
  }
  return DEV_FALLBACK_API_KEY_PEPPER;
};

/** The database handle used here. Kept structural so tests can fake it. */
export type KeyDatabase = {
  query: (text: string, params?: unknown[]) => Promise<unknown[]>;
};

/**
 * Derives the stored digest for a key given an explicit salt.
 *
 * `scryptSync(key, pepper, salt)` with a per-key random salt. The pepper is
 * the KDF password input: it is the server-side secret a database leak does
 * not disclose. The salt is random per key (and stored inside the digest
 * value), so rainbow tables across keys do not apply. The digest format is:
 *
 *   scrypt$<base64url(salt)>$<base64url(derived key)>
 *
 * All of `hashApiKey`, `verifyApiKey` and the `resolveApiKeyOwner` lookup
 * share this scheme; `pepper()` is read inside the derivation so a pepper
 * change takes effect without a restart.
 */
const deriveDigest = (key: string, salt: Buffer, keylen: number): Buffer =>
  scryptSync(key, Buffer.concat([Buffer.from(pepper()), salt]), keylen, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

/**
 * Hashes a key for storage.
 *
 * Each call produces a fresh salt, so two calls on the same key give
 * different stored values. The database holds the wrapper described on
 * {@link deriveDigest}; the lookup recomputes from the salt stored in each
 * candidate row and constant-time-compares via {@link verifyApiKey} /
 * {@link digestsEqual}. There is no single-value equality the database can
 * index on — the digest is not a lookup key anymore (see
 * `resolveApiKeyOwner` for why that shape is acceptable).
 */
export const hashApiKey = (key: string): string => {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = deriveDigest(key, salt, SCRYPT_KEYLEN);
  return `${DIGEST_PREFIX}${salt.toString("base64url")}$${derived.toString(
    "base64url",
  )}`;
};

/**
 * Verifies a presented key against a stored digest.
 *
 * Parses the salt and expected derivation out of `stored`, re-derives with
 * the current pepper and compares the derived keys in constant time.
 * Malformed stored values return `false` rather than throwing, so a
 * corrupted row behaves like a wrong key.
 */
export const verifyApiKey = (key: string, stored: string): boolean => {
  if (typeof stored !== "string" || !stored.startsWith(DIGEST_PREFIX)) {
    return false;
  }
  const parts = stored.split("$");
  // "scrypt" + salt + derived
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const actual = deriveDigest(key, salt, expected.length);
  return digestsEqual(
    actual.toString("base64url"),
    expected.toString("base64url"),
  );
};

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

/** Which owner a live key belongs to, plus the stored digest. */
export type ApiKeyOwner = {
  key_hash: string;
  user_id: string | null;
  owner_uid: string | null;
};

/**
 * Resolves a presented key to its owner, or `null` when it is not usable.
 *
 * A scrypt digest is salted per key, so the database cannot index on it: a
 * lookup by digest value would need the same salt the row was created with,
 * which only the row itself carries. The lookup therefore selects the live
 * digests (`revoked_at IS NULL`) and verifies the key against each one with
 * {@link verifyApiKey} in constant time. A revoked key, an unknown key and
 * a key whose row carries neither owner column all yield `null`; the caller
 * answers the same 401 to all three so the response cannot be used to probe
 * which state a key is in.
 *
 * The candidate count is bounded by the deployment's key count (operator-
 * issued keys, not user registrations); `last_used_at` and revocation keep
 * the live set small. The per-request CPU cost is one scrypt derivation
 * (~tens of ms) per live row until a match is found.
 *
 * On a hit, `last_used_at` is touched. That write is best-effort: a failure
 * to record usage must not turn a valid key into a 401.
 */
export const resolveApiKeyOwner = async (
  db: KeyDatabase,
  key: string,
): Promise<OwnerIdentity | null> => {
  const rows = (await db.query(
    `SELECT key_hash, user_id, owner_uid FROM api_keys
     WHERE revoked_at IS NULL`,
  )) as ApiKeyOwner[];

  let matched: ApiKeyOwner | null = null;
  for (const row of rows) {
    if (verifyApiKey(key, row.key_hash)) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    return null;
  }

  const owner: OwnerIdentity | null = matched.user_id
    ? { kind: "user", userId: matched.user_id }
    : matched.owner_uid
    ? { kind: "guest", ownerUid: matched.owner_uid }
    : null;

  if (!owner) {
    return null;
  }

  try {
    await db.query(
      `UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1`,
      [matched.key_hash],
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
