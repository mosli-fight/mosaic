import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  API_KEY_PREFIX,
  bearerToken,
  createApiKey,
  digestsEqual,
  generateApiKey,
  hashApiKey,
  listApiKeys,
  resolveApiKeyOwner,
  revokeApiKey,
} from "../src/apiKeys.js";

import type { KeyDatabase } from "../src/apiKeys.js";

/**
 * Tests for API-key authentication.
 *
 * The database is faked at the query level so the tests can assert both the
 * resolution and the statement that produced it. The properties pinned here:
 *
 * - only the digest is ever sent to the database,
 * - a revoked or unknown key resolves to nothing,
 * - a key maps to exactly the owner it was created for, and no other,
 * - a malformed `Authorization` header is not a credential.
 */

type Call = { text: string; params: unknown[] };

/** An in-memory `api_keys` table, keyed by digest. */
const fakeDatabase = () => {
  const calls: Call[] = [];
  const rows: {
    id: string;
    key_hash: string;
    user_id: string | null;
    owner_uid: string | null;
    label: string | null;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }[] = [];
  let nextId = 0;

  const db: KeyDatabase = {
    query: async (text, params = []) => {
      calls.push({ text, params });
      if (text.startsWith("SELECT user_id, owner_uid FROM api_keys")) {
        const hash = params[0] as string;
        return rows
          .filter((row) => row.key_hash === hash && row.revoked_at === null)
          .map((row) => ({
            user_id: row.user_id,
            owner_uid: row.owner_uid,
          }));
      }
      if (text.startsWith("UPDATE api_keys SET last_used_at")) {
        const hash = params[0] as string;
        const row = rows.find((r) => r.key_hash === hash);
        if (row) {
          row.last_used_at = new Date().toISOString();
        }
        return [];
      }
      if (text.startsWith("INSERT INTO api_keys")) {
        const hash = params[0] as string;
        const isUser = text.includes("user_id");
        rows.push({
          id: `key-${++nextId}`,
          key_hash: hash,
          user_id: isUser ? (params[1] as string) : null,
          owner_uid: isUser ? null : (params[1] as string),
          label: null,
          created_at: new Date().toISOString(),
          last_used_at: null,
          revoked_at: null,
        });
        return [];
      }
      if (text.startsWith("UPDATE api_keys SET revoked_at")) {
        const id = params[0] as string;
        const row = rows.find((r) => r.id === id && r.revoked_at === null);
        if (row) {
          row.revoked_at = new Date().toISOString();
          return [{ id: row.id }];
        }
        return [];
      }
      if (text.startsWith("SELECT id, label")) {
        const value = params[0] as string;
        return rows
          .filter(
            (row) =>
              (text.includes("user_id = $1") && row.user_id === value) ||
              (text.includes("owner_uid = $1") && row.owner_uid === value),
          )
          .map((row) => ({
            id: row.id,
            label: row.label,
            created_at: row.created_at,
            last_used_at: row.last_used_at,
            revoked_at: row.revoked_at,
          }));
      }
      return [];
    },
  };

  return { db, calls, rows };
};

describe("hashApiKey", () => {
  it("is the SHA-256 hex digest of the key", () => {
    const key = "msk_example";
    expect(hashApiKey(key)).toBe(
      createHash("sha256").update(key).digest("hex"),
    );
  });

  it("never contains the plaintext", () => {
    expect(hashApiKey("msk_secret")).not.toContain("secret");
  });
});

describe("generateApiKey", () => {
  it("carries the prefix", () => {
    expect(generateApiKey().startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("is unique across calls", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe("digestsEqual", () => {
  it("is true for equal digests", () => {
    expect(digestsEqual("abc", "abc")).toBe(true);
  });

  it("is false for different digests", () => {
    expect(digestsEqual("abc", "abd")).toBe(false);
  });

  it("is false for different lengths without throwing", () => {
    expect(digestsEqual("abc", "abcd")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token", () => {
    expect(bearerToken("Bearer msk_abc")).toBe("msk_abc");
  });

  it("is case-insensitive on the scheme", () => {
    expect(bearerToken("bearer msk_abc")).toBe("msk_abc");
  });

  it("rejects a missing header", () => {
    expect(bearerToken(undefined)).toBeNull();
  });

  it("rejects a header with no token", () => {
    expect(bearerToken("Bearer")).toBeNull();
  });

  it("rejects a header with a token and trailing junk", () => {
    expect(bearerToken("Bearer msk_abc extra")).toBeNull();
  });

  it("rejects a non-Bearer scheme", () => {
    expect(bearerToken("Basic msk_abc")).toBeNull();
  });
});

describe("resolveApiKeyOwner", () => {
  it("resolves a user key to its user", async () => {
    const { db } = fakeDatabase();
    const key = await createApiKey(db, { kind: "user", userId: "user-123" });

    expect(await resolveApiKeyOwner(db, key)).toEqual({
      kind: "user",
      userId: "user-123",
    });
  });

  it("resolves a guest key to its guest", async () => {
    const { db } = fakeDatabase();
    const key = await createApiKey(db, { kind: "guest", ownerUid: "uid-456" });

    expect(await resolveApiKeyOwner(db, key)).toEqual({
      kind: "guest",
      ownerUid: "uid-456",
    });
  });

  it("returns null for an unknown key", async () => {
    const { db } = fakeDatabase();

    expect(await resolveApiKeyOwner(db, "msk_never_issued")).toBeNull();
  });

  it("returns null for a revoked key", async () => {
    const { db, rows } = fakeDatabase();
    const key = await createApiKey(db, { kind: "user", userId: "user-123" });
    await revokeApiKey(db, rows[0].id);

    expect(await resolveApiKeyOwner(db, key)).toBeNull();
  });

  it("sends only the digest to the database", async () => {
    const { db, calls } = fakeDatabase();
    const key = await createApiKey(db, { kind: "user", userId: "user-123" });
    calls.length = 0;

    await resolveApiKeyOwner(db, key);

    for (const call of calls) {
      expect(JSON.stringify(call.params)).not.toContain(key);
      expect(JSON.stringify(call.text)).not.toContain(key);
    }
  });

  it("never resolves a key to an owner it was not created for", async () => {
    const { db } = fakeDatabase();
    const key = await createApiKey(db, { kind: "user", userId: "user-123" });

    // A different key, created for a different owner, resolves elsewhere.
    const other = await createApiKey(db, {
      kind: "user",
      userId: "user-999",
    });

    expect(await resolveApiKeyOwner(db, key)).toEqual({
      kind: "user",
      userId: "user-123",
    });
    expect(await resolveApiKeyOwner(db, other)).toEqual({
      kind: "user",
      userId: "user-999",
    });
  });

  it("touches last_used_at on a successful resolution", async () => {
    const { db, rows } = fakeDatabase();
    const key = await createApiKey(db, { kind: "user", userId: "user-123" });

    await resolveApiKeyOwner(db, key);

    expect(rows[0].last_used_at).not.toBeNull();
  });
});

describe("createApiKey", () => {
  it("stores only the digest", async () => {
    const { db, rows } = fakeDatabase();
    const key = await createApiKey(db, { kind: "user", userId: "user-123" });

    expect(rows[0].key_hash).toBe(hashApiKey(key));
    expect(rows[0].key_hash).not.toBe(key);
    expect(JSON.stringify(rows)).not.toContain(key);
  });
});

describe("revokeApiKey", () => {
  it("revokes a live key", async () => {
    const { db, rows } = fakeDatabase();
    await createApiKey(db, { kind: "user", userId: "user-123" });

    expect(await revokeApiKey(db, rows[0].id)).toBe(true);
    expect(rows[0].revoked_at).not.toBeNull();
  });

  it("reports false for an already-revoked key", async () => {
    const { db, rows } = fakeDatabase();
    await createApiKey(db, { kind: "user", userId: "user-123" });
    await revokeApiKey(db, rows[0].id);

    expect(await revokeApiKey(db, rows[0].id)).toBe(false);
  });
});

describe("listApiKeys", () => {
  it("lists an owner's keys without their digests", async () => {
    const { db, rows } = fakeDatabase();
    await createApiKey(db, { kind: "user", userId: "user-123" });

    const listed = await listApiKeys(db, {
      kind: "user",
      userId: "user-123",
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty("keyHash");
    expect(JSON.stringify(listed)).not.toContain(rows[0].key_hash);
  });
});
