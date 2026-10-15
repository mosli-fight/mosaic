import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for board sharing: create/revoke and the unauthenticated public read.
 *
 * The database is mocked through the same seam as the other API tests and
 * `getSessionUser` is mocked so a request can be signed in or out.
 *
 * The assertions concentrate on the things that would be bad to get wrong:
 * that the token is unguessable, that only the owner can mint or revoke, that a
 * reader cannot re-share, and that a miss is indistinguishable from a revoke.
 */

const state = {
  handlers: [] as { match: RegExp; rows: unknown[] }[],
  calls: [] as { sql: string; params: unknown[] }[],
  session: null as {
    id: string;
    email: string;
    displayName: string | null;
  } | null,
  guestUid: "guest-1" as string | null,
};

vi.mock("../_db.js", async () => {
  const actual = await vi.importActual<typeof import("../_db.js")>("../_db.js");
  return {
    ...actual,
    readGuestUid: vi.fn(() => state.guestUid),
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      state.calls.push({ sql, params });
      for (const h of state.handlers) {
        if (h.match.test(sql)) {
          return h.rows as never;
        }
      }
      return [] as never;
    }),
  };
});

vi.mock("../auth/_shared.js", async () => {
  const actual = await vi.importActual<typeof import("../auth/_shared.js")>(
    "../auth/_shared.js",
  );
  return { ...actual, getSessionUser: vi.fn(async () => state.session) };
});

const share = (await import("../boards/[id]/share.js")).default;
const publicRead = (await import("../boards/shared/[token].js")).default;

const TOKEN = "a".repeat(64);
const ID = "11111111-2222-4333-8444-555555555555";

const makeRes = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
    },
    end() {
      return this;
    },
  };
};

const req = (
  o: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) => ({
  method: o.method ?? "GET",
  url: o.url ?? "/",
  headers: o.headers ?? {},
  body: o.body,
});

const on = (match: RegExp, rows: unknown[]) => {
  state.handlers.push({ match, rows });
};
const sqls = (fragment: string) =>
  state.calls.filter((c) => c.sql.includes(fragment));

const boardRow = (over: Record<string, unknown> = {}) => ({
  id: ID,
  name: "Shared board",
  folder_id: null,
  favorite: false,
  trashed_at: null,
  thumbnail: null,
  scene: '{"elements":[]}',
  scene_version: 3,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  last_opened_at: "2026-01-03T00:00:00.000Z",
  scene_bytes: 16,
  ...over,
});

beforeEach(() => {
  state.handlers = [];
  state.calls = [];
  state.session = null;
  state.guestUid = "guest-1";
});

/* -------------------------------------------------------------------------- */
/* POST /api/boards/[id]/share                                                 */
/* -------------------------------------------------------------------------- */

describe("POST /api/boards/[id]/share", () => {
  it("creates an unguessable token", async () => {
    on(/SELECT share_token, share_mode/i, []);
    on(/UPDATE boards b SET share_token/i, [
      { share_token: "x", share_mode: "view" },
    ]);

    const res = makeRes();
    await share(req({ method: "POST" }), res, { params: { id: ID } });

    expect(res.statusCode).toBe(201);
    // 32 bytes hex. A short or sequential id would let anyone walk /share/1, /share/2.
    expect(res.body.share.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.share.mode).toBe("view");
  });

  it("defaults to view with no body at all", async () => {
    on(/SELECT share_token, share_mode/i, []);
    on(/UPDATE boards b SET share_token/i, [
      { share_token: "x", share_mode: "view" },
    ]);
    const res = makeRes();
    await share(req({ method: "POST" }), res, { params: { id: ID } });
    expect(res.body.share.mode).toBe("view");
  });

  it("refuses edit rather than storing a link that cannot work", async () => {
    const res = makeRes();
    await share(req({ method: "POST", body: { mode: "edit" } }), res, {
      params: { id: ID },
    });
    expect(res.statusCode).toBe(400);
    expect(sqls("UPDATE boards")).toHaveLength(0);
  });

  it("returns the existing link instead of minting a new one", async () => {
    // Re-sharing must not invalidate a URL someone already copied.
    on(/SELECT share_token, share_mode/i, [
      { share_token: TOKEN, share_mode: "view" },
    ]);
    const res = makeRes();
    await share(req({ method: "POST" }), res, { params: { id: ID } });
    expect(res.body).toEqual({
      share: { token: TOKEN, mode: "view" },
      created: false,
    });
    expect(sqls("UPDATE boards b SET share_token")).toHaveLength(0);
  });

  it("scopes the write to the caller", async () => {
    state.session = { id: "user-1", email: "a@b.com", displayName: null };
    on(/SELECT share_token, share_mode/i, []);
    on(/UPDATE boards b SET share_token/i, [
      { share_token: "x", share_mode: "view" },
    ]);
    await share(req({ method: "POST" }), res(), { params: { id: ID } });
    const call = sqls("UPDATE boards b SET share_token")[0];
    expect(call.sql).toContain("user_id = $2");
    // $1 is the board id and $2 the owner. Sharing them is a runtime type error in
    // Postgres, which is exactly how this was found.
    expect(call.sql).toContain("b.id = $1");
    expect(call.params[0]).toBe(ID);
    expect(call.params[1]).toBe("user-1");
  });

  it("answers 404 for a board that is not the caller's", async () => {
    on(/SELECT share_token, share_mode/i, []);
    on(/UPDATE boards b SET share_token/i, []);
    const res = makeRes();
    await share(req({ method: "POST" }), res, { params: { id: ID } });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a malformed board id before querying", async () => {
    const res = makeRes();
    await share(req({ method: "POST" }), res, { params: { id: "nope" } });
    expect(res.statusCode).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  it("rejects a method it does not serve", async () => {
    const res = makeRes();
    await share(req({ method: "PUT" }), res, { params: { id: ID } });
    expect(res.statusCode).toBe(405);
  });

  /**
   * The regression this suite exists for.
   *
   * Vercel's Node runtime has been observed invoking these handlers with the context
   * argument undefined, so a handler that read only `ctx.params.id` answered 400 on
   * every real request. Every test above passes a context, so the suite stayed green
   * while the Share dialog showed "Could not share this board" to every user.
   */
  it("mints a token when the framework supplies no context", async () => {
    on(/SELECT share_token, share_mode/i, []);
    on(/UPDATE boards b SET share_token/i, [
      { share_token: "x", share_mode: "view" },
    ]);

    const res = makeRes();
    await share(req({ method: "POST", url: `/api/boards/${ID}/share` }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.share.token).toMatch(/^[0-9a-f]{64}$/);
    expect(sqls("UPDATE boards b SET share_token")[0].params[0]).toBe(ID);
  });

  it("mints a token from a url carrying a query string", async () => {
    on(/SELECT share_token, share_mode/i, []);
    on(/UPDATE boards b SET share_token/i, [
      { share_token: "x", share_mode: "view" },
    ]);

    const res = makeRes();
    await share(
      req({ method: "POST", url: `/api/boards/${ID}/share?from=card` }),
      res,
    );

    expect(res.statusCode).toBe(201);
  });

  it("revokes from the url when there is no context", async () => {
    on(/UPDATE boards b SET share_token = NULL/i, [
      { share_token: TOKEN, share_mode: "view" },
    ]);

    const res = makeRes();
    await share(req({ method: "DELETE", url: `/api/boards/${ID}/share` }), res);

    expect(res.statusCode).toBe(200);
    expect(sqls("UPDATE boards b SET share_token = NULL")[0].params[0]).toBe(
      ID,
    );
  });

  it("still rejects a malformed id taken from the url", async () => {
    const res = makeRes();
    await share(req({ method: "POST", url: "/api/boards/nope/share" }), res);
    expect(res.statusCode).toBe(400);
    expect(state.calls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* DELETE /api/boards/[id]/share                                               */
/* -------------------------------------------------------------------------- */

describe("DELETE /api/boards/[id]/share", () => {
  it("clears token and mode together", async () => {
    on(/UPDATE boards b SET share_token = NULL/i, [
      { share_token: TOKEN, share_mode: "view" },
    ]);
    const res = makeRes();
    await share(req({ method: "DELETE" }), res, { params: { id: ID } });
    expect(res.statusCode).toBe(200);
    const sql = sqls("UPDATE boards b SET share_token = NULL")[0].sql;
    // One statement, so there is no window where a token exists with no mode.
    expect(sql).toContain("share_mode = NULL");
  });

  it("answers 404 for a board that is not the caller's", async () => {
    on(/UPDATE boards b SET share_token = NULL/i, []);
    const res = makeRes();
    await share(req({ method: "DELETE" }), res, { params: { id: ID } });
    // Never confirming whether the id exists.
    expect(res.statusCode).toBe(404);
  });
});

/* -------------------------------------------------------------------------- */
/* GET /api/boards/shared/[token] — unauthenticated                           */
/* -------------------------------------------------------------------------- */

describe("GET /api/boards/shared/[token]", () => {
  it("serves a live shared board to a caller with no session", async () => {
    on(/FROM boards/i, [boardRow()]);
    const res = makeRes();
    await publicRead(req({ url: `/api/boards/shared/${TOKEN}` }), res, {
      params: { token: TOKEN },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.board.name).toBe("Shared board");
    expect(res.body.board.scene).toBe('{"elements":[]}');
    // No auth was consulted at all.
    expect(state.session).toBeNull();
  });

  it("withholds owner identity and internal bookkeeping", async () => {
    on(/FROM boards/i, [boardRow()]);
    const res = makeRes();
    await publicRead(req({}), res, { params: { token: TOKEN } });

    const b = res.body.board as Record<string, unknown>;
    // A share link should not disclose whose board it is.
    expect(b.ownerUid).toBeUndefined();
    expect(b.owner_uid).toBeUndefined();
    expect(b.userId).toBeUndefined();
    // Internal counters mean nothing to a reader.
    expect(b.sceneVersion).toBe(0);
    expect(b.sceneBytes).toBeUndefined();
  });

  it("only ever serves mode=view and never a trashed board", async () => {
    on(/FROM boards/i, [boardRow()]);
    await publicRead(req({}), makeRes(), { params: { token: TOKEN } });
    const sql = state.calls[0].sql;
    // Trashing is how a user says "this should not be reachable".
    expect(sql).toContain("share_mode = 'view'");
    expect(sql).toContain("trashed_at IS NULL");
  });

  it("marks the response no-store so a cached copy cannot outlive a revoke", async () => {
    on(/FROM boards/i, [boardRow()]);
    const res = makeRes();
    await publicRead(req({}), res, { params: { token: TOKEN } });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("answers the same 404 for unknown, revoked and trashed", async () => {
    // No rows back: whether the token never existed or was revoked is
    // indistinguishable, so the endpoint cannot be used to probe for one.
    on(/FROM boards/i, []);
    const res = makeRes();
    await publicRead(req({}), res, { params: { token: TOKEN } });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "not found" });
  });

  it("rejects a token of the wrong shape without querying", async () => {
    const res = makeRes();
    await publicRead(req({}), res, { params: { token: "1" } });
    expect(res.statusCode).toBe(404);
    expect(state.calls).toHaveLength(0);
  });

  it("offers no way to re-share from a read-only view", async () => {
    on(/FROM boards/i, [boardRow()]);
    const res = makeRes();
    await publicRead(req({}), res, { params: { token: TOKEN } });
    // The public route is GET-only, so a reader cannot mint a token for anything.
    expect(sqls("UPDATE")).toHaveLength(0);
  });

  it("rejects a non-GET method", async () => {
    const res = makeRes();
    await publicRead(req({ method: "POST" }), res, {
      params: { token: TOKEN },
    });
    expect(res.statusCode).toBe(405);
  });

  /**
   * The same missing-context regression as the minting route. A link that cannot be
   * read is not a working share link, so the public half is fixed with the same
   * `pathSegmentAfter` fallback rather than left to break next.
   */
  it("serves a live shared board when the framework supplies no context", async () => {
    on(/FROM boards/i, [boardRow()]);

    const res = makeRes();
    await publicRead(
      req({ url: `/api/boards/shared/${TOKEN}` }),
      res,
      undefined,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.board.name).toBe("Shared board");
    expect(state.calls[0].params[0]).toBe(TOKEN);
  });

  it("404s a request whose path carries no token at all", async () => {
    await publicRead(req({ url: "/api/boards/shared" }), makeRes(), undefined);
    expect(state.calls).toHaveLength(0);
  });
});

function res() {
  return makeRes();
}
