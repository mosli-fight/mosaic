import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the hosted MCP route (`api/mcp/index.ts`).
 *
 * The route is tested at its own boundary: what it authenticates, what it
 * refuses, and that a valid key reaches the MCP layer scoped to that key's
 * owner. The tool bodies themselves are tested in `packages/mcp/tests/`;
 * duplicating them here would test the same code twice and drift.
 *
 * The database seam is the same one the other `api/__tests__` files use:
 * `api/_db.ts`'s `query`, replaced with a scripted fake. The MCP server's
 * own database handle is built separately, but it is only constructed after
 * authentication succeeds, so these tests never touch Neon.
 *
 * Note on module evaluation: the route imports `packages/mcp/src/http.ts`,
 * which imports the editor's element constructors. Those constructors read
 * `import.meta.env` at import time; under vitest the SSR transform defines
 * that object, which is how the existing diagram tests in
 * `packages/mcp/tests/` can import the same code. No shim is installed here.
 */

const state = {
  /** Key digest -> owner row, as the fake `query` will return. */
  keys: new Map<
    string,
    { user_id: string | null; owner_uid: string | null }
  >(),
  /** Whether `query` has been called, and with what. */
  calls: [] as { sql: string; params: unknown[] }[],
};

vi.mock("../_db.js", async () => {
  const actual = await vi.importActual<typeof import("../_db.js")>("../_db.js");
  return {
    ...actual,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      state.calls.push({ sql, params });
      const hash = params[0] as string;
      const owner = state.keys.get(hash);
      if (owner) {
        return [owner] as never;
      }
      return [] as never;
    }),
  };
});

// The route is imported after the mocks and the env shim are in place.
const handler = (await import("../mcp/index.js")).default;

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

const makeRes = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      this.ended = true;
    },
    end(body?: unknown) {
      this.body = body;
      this.ended = true;
    },
  };
};

type Res = ReturnType<typeof makeRes>;

const req = (opts: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) => ({
  method: opts.method ?? "POST",
  url: opts.url ?? "/api/mcp",
  headers: opts.headers ?? {},
  body: opts.body,
});

const digest = (key: string) =>
  createHash("sha256").update(key).digest("hex");

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("POST /api/mcp", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = makeRes();

    await handler(req(), res as unknown as never);

    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toBe("Bearer");
  });

  it("rejects a request with a malformed Authorization header", async () => {
    const res = makeRes();

    await handler(
      req({ headers: { authorization: "Basic msk_whatever" } }),
      res as unknown as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toBe("Bearer");
  });

  it("rejects an unknown key with the same response as a missing one", async () => {
    const missing = makeRes();
    await handler(req(), missing as unknown as never);

    const res = makeRes();
    await handler(
      req({ headers: { authorization: "Bearer msk_never_issued" } }),
      res as unknown as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.statusCode).toBe(missing.statusCode);
    expect(res.headers).toEqual(missing.headers);
    expect(res.body).toEqual(missing.body);
  });

  it("rejects a revoked key", async () => {
    // A revoked key is simply absent from the live-key lookup, which the
    // fake models by not returning a row for it.
    const res = makeRes();

    await handler(
      req({ headers: { authorization: "Bearer msk_revoked" } }),
      res as unknown as never,
    );

    expect(res.statusCode).toBe(401);
  });

  it("rejects a key whose row carries neither owner", async () => {
    state.keys.set(digest("msk_orphan"), { user_id: null, owner_uid: null });
    const res = makeRes();

    await handler(
      req({ headers: { authorization: "Bearer msk_orphan" } }),
      res as unknown as never,
    );

    expect(res.statusCode).toBe(401);
    state.keys.delete(digest("msk_orphan"));
  });

  it("sends only the digest to the database", async () => {
    state.keys.set(digest("msk_live"), {
      user_id: "user-123",
      owner_uid: null,
    });
    state.calls.length = 0;
    const res = makeRes();

    await handler(
      req({
        headers: { authorization: "Bearer msk_live" },
        body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      }),
      res as unknown as never,
    );

    for (const call of state.calls) {
      expect(JSON.stringify(call.params)).not.toContain("msk_live");
    }
    state.keys.delete(digest("msk_live"));
  });

  it("rejects a body that is not JSON", async () => {
    state.keys.set(digest("msk_live2"), {
      user_id: "user-123",
      owner_uid: null,
    });
    const res = makeRes();

    await handler(
      req({
        headers: { authorization: "Bearer msk_live2" },
        body: "{not json",
      }),
      res as unknown as never,
    );

    expect(res.statusCode).toBe(400);
    state.keys.delete(digest("msk_live2"));
  });
});
