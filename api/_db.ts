import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { neon } from "@neondatabase/serverless";

/**
 * Shared serverless plumbing.
 *
 * The leading underscore is load-bearing: Vercel does not route any file whose
 * name starts with `_` to a serverless function, so this stays a module that
 * `health.ts` and `boards/*` import rather than becoming its own endpoint.
 *
 * Part 3A identity model
 * ----------------------
 * `mosaic_uid` is an **anonymous** identifier, not a login. A visitor gets one on
 * their first request and it is what `owner_uid` scopes every row to. There is no
 * password, no email and no recovery, by design — Part 3B adds real auth on top
 * of this without changing the column type.
 *
 * The cookie is *signed*, not encrypted, and that is the correct amount of
 * security here: signing makes a client-supplied uid unforgeable, which is the
 * property that matters for owner scoping. It deliberately does not hide the
 * value — there is nothing secret in a random UUID we minted ourselves.
 *
 * No CORS headers are set anywhere. These are same-origin endpoints; a
 * credentialed cross-origin API would be a needless CSRF surface, and the cookie
 * is SameSite=Lax so a cross-site POST would not carry it anyway.
 */

/** Cookie name holding the anonymous owner uid. */
export const UID_COOKIE = "mosaic_uid";

/** One year, in seconds. */
const COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

/**
 * Secret used to sign the uid cookie.
 *
 * `COOKIE_SECRET` is required in production. In development we fall back to a
 * fixed string so `vercel dev` works with no setup, but we never use that
 * fallback in production — a publicly-known signing key would let anyone mint a
 * uid for someone else's account.
 */
const DEV_FALLBACK_SECRET = "mosaic-dev-insecure-cookie-secret";

const secret = (): string => {
  const fromEnv = process.env.COOKIE_SECRET;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "COOKIE_SECRET must be set in production; refusing to sign uid cookies " +
        "with a well-known fallback.",
    );
  }
  return DEV_FALLBACK_SECRET;
};

const sign = (uid: string) =>
  createHmac("sha256", secret()).update(uid).digest("hex");

/** Cookie value format is `<uid>.<hmac>`. */
const pack = (uid: string) => `${uid}.${sign(uid)}`;

/**
 * Verifies a cookie value in constant time.
 *
 * `timingSafeEqual` needs equal-length buffers, so a malformed value (wrong shape
 * or truncated signature) returns false before the comparison rather than
 * throwing.
 */
const unpack = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const dot = value.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const uid = value.slice(0, dot);
  const provided = value.slice(dot + 1);
  const expected = sign(uid);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  return uid;
};

/**
 * Minimal structural subsets of Vercel's Node request and response.
 *
 * Declared structurally rather than importing `@vercel/node` so the functions
 * compile with no extra dependency, and so it is obvious exactly how much of
 * those objects we actually rely on.
 *
 * This signature � not the Web `Request`/`Response` pair � is what Vercel's
 * **Node.js** runtime invokes. The Web style belongs to the Edge runtime, and a
 * `Response` returned from a default export here is silently ignored by Vercel:
 * the request then hangs and every log line says
 * "default export returned a `Response`".
 */
export type ApiRequest = {
  method?: string;
  /** Path plus query string, e.g. `/api/boards?trashed=1`. */
  url?: string;
  /** Node lowercases header names, so the cookie arrives as `headers.cookie`. */
  headers: Record<string, string | string[] | undefined>;
  /**
   * Parsed by Vercel when the request is `application/json`. Deliberately
   * `unknown`: the handlers narrow it, because a client can send anything.
   */
  body?: unknown;
};

export type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
};

/**
 * Reads one cookie out of the `cookie` request header.
 *
 * A Node request carries `headers.cookie` as a plain string rather than a
 * `Headers` object, so one `split(";")` is all that is needed.
 */
const readCookie = (req: ApiRequest, name: string): string | undefined => {
  const header = req.headers.cookie;
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw) {
    return undefined;
  }
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
};

/**
 * Resolves the caller's owner uid, minting and setting a cookie if absent.
 *
 * The cookie is written with `setHeader` before the handler knows its status or
 * body, which is what makes this workable with the Node signature: unlike a Web
 * `Response`, `res` stays mutable for the whole request.
 *
 * The returned uid is valid for reads and writes whether it already existed or
 * was just minted, so callers never need to distinguish the two cases.
 */
export const getOwnerUid = (req: ApiRequest, res: ApiResponse): string => {
  const existing = unpack(readCookie(req, UID_COOKIE));
  if (existing) {
    return existing;
  }

  const uid = randomUUID();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    // SameSite=Lax: the API is same-origin, and Lax means a cross-site POST will
    // not carry this cookie even if someone manages a cross-origin form.
    `${UID_COOKIE}=${encodeURIComponent(
      pack(uid),
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_S}${secure}`,
  );
  return uid;
};

/**
 * The guest uid carried by this request, or null.
 *
 * Reads only — never mints. The claim flow needs to know whether a *pre-existing*
 * anonymous identity is present, and a function that invented one on demand would
 * make that question unanswerable: it would always look like a new guest had data.
 */
export const readGuestUid = (req: ApiRequest): string | null =>
  unpack(readCookie(req, UID_COOKIE));

/* -------------------------------------------------------------------------- */
/* Database                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Neon tagged-SQL client.
 *
 * Built lazily and memoised so importing this module from a handler that never
 * touches the database (one that returns 429 before doing any work, say) does
 * not throw at import time when DATABASE_URL is unset. A missing env var should
 * produce a useful 500 from the handler, not an unhandled module-evaluation crash
 * that Vercel reports as a 500 with no explanation.
 */
let client: ReturnType<typeof neon> | null = null;

export const sql = () => {
  if (client) {
    return client;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  client = neon(url);
  return client;
};

/**
 * Parameterised query with the result pinned to a row array.
 *
 * The driver's own `query()` return type is a union that includes
 * `FullQueryResults<boolean>` — the shape it uses for statements with no result
 * set — so `rows[0]` and `rows.length` do not typecheck even though every call
 * site here is a SELECT or a RETURNING query that really does yield rows. This
 * wrapper keeps the cast in one place; the default `arrayMode` is what actually
 * returns the row array at runtime.
 */
export const query = async <T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> =>
  (await sql().query(text, params as never[])) as unknown as T[];

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                               */
/* -------------------------------------------------------------------------- */

const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

/** uid -> timestamps of recent requests, pruned lazily on read. */
const hits = new Map<string, number[]>();

/**
 * Fixed-window rate limiter, 100 requests/minute per uid.
 *
 * In-memory on purpose: serverless instances are ephemeral and Part 3A adds no
 * shared store, so this is per-instance and best-effort. It stops a runaway
 * client on a warm instance; it is not a security control and does not survive a
 * cold start. Anything that must hold across instances needs a real store —
 * called out in STEP 7's docs rather than silently pretended here.
 */
export const rateLimitOk = (uid: string): boolean => {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (hits.get(uid) ?? []).filter((t) => t > cutoff);

  if (recent.length >= RATE_LIMIT) {
    hits.set(uid, recent);
    return false;
  }

  recent.push(now);
  hits.set(uid, recent);

  // Bound memory: drop buckets nobody is using.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => t <= cutoff)) {
        hits.delete(key);
      }
    }
  }
  return true;
};

/**
 * Standard JSON response helper so every handler shapes errors the same way.
 *
 * `extra` exists so a handler can pass through a mutable `Headers` it already
 * appended `Set-Cookie` to. `getOwnerUid` has to append to a response that
 * already exists, but a `Response` body is immutable once constructed — so the
 * cookie lands on a placeholder response and its headers are copied onto the real
 * one here.
 */
export const json = (res: ApiResponse, body: unknown, status = 200): void => {
  res.status(status).json(body);
};

/**
 * Parses a JSON request body.
 *
 * Two things can go wrong here and both must become a 400 rather than a 500:
 *
 * - Accessing `req.body` on Vercel's Node runtime is a lazy parse that **throws**
 *   ("Invalid JSON") when the payload does not match the declared content type.
 *   Reading the property can therefore fail, so the access is guarded.
 * - Vercel pre-parses `application/json`, but a body can still arrive as a string
 *   when the content type is wrong or absent, so both shapes are accepted.
 *
 * Anything unusable yields `null` and the caller answers 400.
 */
export const readJson = (req: ApiRequest): Record<string, unknown> | null => {
  let body: unknown;
  try {
    body = req.body;
  } catch {
    // The lazy body parser rejected the payload. Nothing to salvage.
    return null;
  }

  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return null;
};

/**
 * Query parameters, parsed from `req.url`.
 *
 * Vercel also exposes a `req.query` object, but it is string-typed and collapses
 * repeated parameters; parsing the URL is both simpler and unambiguous.
 */
export const searchParams = (req: ApiRequest): URLSearchParams => {
  // `req.url` is a path, not absolute, so a base has to be supplied.
  return new URL(req.url ?? "/", "http://localhost").searchParams;
};

/**
 * The dynamic segment that follows `marker` in the request path.
 *
 * ## Why the URL is the source of truth
 *
 * Vercel's Node runtime has been observed invoking these handlers with the context
 * argument `undefined`, so `ctx.params.x` is a crash ("Cannot read properties of
 * undefined"), not a feature. Every route here therefore derives its parameter from
 * the URL and treats the framework context as an optimisation when it happens to be
 * supplied. A handler that reads `ctx?.params?.x ?? ""` and nothing else answers
 * `400`/`404` on every real request while still passing every test, because the
 * tests pass a context: that is exactly how sharing ended up permanently broken.
 *
 * ## Why a marker rather than an index
 *
 * `/api/boards/<id>` and `/api/boards/<id>/share` share a prefix but not a shape, so
 * neither can use "the last segment". Anchoring on the literal that precedes the
 * parameter (`boards`, `shared`) makes both correct, and keeps a route from having to
 * know which other routes hang off it.
 *
 * Returns `""` when the marker is absent, which callers already treat as malformed.
 */
export const pathSegmentAfter = (req: ApiRequest, marker: string): string => {
  const path = (req.url ?? "").split("?")[0];
  const segments = path.split("/").filter(Boolean);
  const index = segments.lastIndexOf(marker);
  return index === -1 ? "" : (segments[index + 1] ?? "");
};

/* -------------------------------------------------------------------------- */
/* Row mapping                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Postgres timestamptz -> epoch milliseconds.
 *
 * The dashboard's data model (`db/schema.ts`) stores every timestamp as epoch ms
 * and formats it in JS (`relativeTime(board.lastOpenedAt ?? board.updatedAt)`), so
 * the API's job is to hand back exactly the number the client would have stored.
 *
 * Accepts Date, ISO string or number because the Neon HTTP driver decodes
 * timestamptz differently depending on the `types` option, and the API should not
 * care which. Anything unparseable becomes null rather than NaN, so a bad row
 * cannot poison a sort.
 */
export const toEpochMs = (value: unknown): number | null => {
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

/** Epoch milliseconds -> ISO string, for timestamptz parameters. */
export const toIso = (ms: number | null | undefined): string | null =>
  typeof ms === "number" && Number.isFinite(ms)
    ? new Date(ms).toISOString()
    : null;

/** The `boards` row as selected by the queries below. */
export type BoardRow = Record<string, unknown> & {
  id: string;
  name: string;
  folder_id: string | null;
  favorite: boolean;
  trashed_at: unknown;
  thumbnail: string | null;
  scene: string | null;
  scene_version: number;
  created_at: unknown;
  updated_at: unknown;
  last_opened_at: unknown;
  scene_bytes: number | null;
};

/**
 * `boards` row -> the `Board` shape the dashboard already speaks.
 *
 * This is the single place snake_case/timestamptz meets camelCase/epoch-ms. The
 * `scene`/`sceneBytes` fields are only present when selected, matching the app's
 * own optional typing: `listBoards` strips `scene` because scenes can be
 * megabytes and the grid never renders them, while `getBoardWithScene` includes
 * it.
 */
export const toBoard = (row: BoardRow): Record<string, unknown> => {
  const board: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    folderId: row.folder_id ?? null,
    favorite: row.favorite,
    trashedAt: toEpochMs(row.trashed_at),
    thumbnail: row.thumbnail ?? null,
    sceneVersion: row.scene_version ?? 0,
    createdAt: toEpochMs(row.created_at),
    updatedAt: toEpochMs(row.updated_at),
    lastOpenedAt: toEpochMs(row.last_opened_at),
  };
  if (row.scene !== undefined) {
    board.scene = row.scene ?? undefined;
  }
  if (row.scene_bytes !== undefined && row.scene_bytes !== null) {
    board.sceneBytes = row.scene_bytes;
  }
  return board;
};
