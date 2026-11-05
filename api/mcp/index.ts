/**
 * `POST /api/mcp` — the hosted MCP endpoint.
 *
 * Serves the same fifteen tools the stdio server does, over the MCP
 * streamable HTTP transport. The tool handlers are not duplicated here:
 * `packages/mcp/src/server.ts` builds the server, `packages/mcp/src/http.ts`
 * runs it over HTTP, and this file only authenticates and adapts.
 *
 * ## Authentication
 *
 * Every request must carry `Authorization: Bearer <key>`. The key is
 * resolved to an owner by `packages/mcp/src/apiKeys.ts`, which verifies it
 * against the salted scrypt digest stored in `api_keys` — the plaintext is
 * never stored. A
 * missing, malformed, unknown or revoked key is answered 401 with a
 * `WWW-Authenticate: Bearer` header, and the response is the same for all
 * four so it cannot be used to probe which state a key is in.
 *
 * The resolved owner becomes the server's configured identity, so every
 * query is scoped by the existing `ownerScope` exactly as it is for stdio.
 * A key can only ever touch its own owner's boards.
 *
 * ## Serverless constraints
 *
 * The transport is stateless (see `packages/mcp/src/http.ts`): no session is
 * issued or kept, because a serverless instance may not be the one that
 * answers the next request from the same client. GET and DELETE are refused.
 *
 * ## Why the Web Standard transport and not the Node one
 *
 * Vercel's Node runtime hands the handler `ApiRequest`/`ApiResponse` objects,
 * not a raw socket. The SDK's Web Standard transport takes a `Request` and
 * returns a `Response`, which is the whole exchange in two values: build the
 * request from the incoming body, call it, copy the response back. The Node
 * transport would take the request stream and need a body that Vercel has
 * already consumed.
 *
 * The price is in `packages/mcp/src/http.ts`'s module comment: the
 * `import.meta.env` flags the editor sources read, and the font-registry
 * weight they carry, are handled by a dynamic import.
 */

import { DEFAULT_OPTIONS } from "../../packages/mcp/src/config.js";
import { createDatabase } from "../../packages/mcp/src/db.js";
import { handleHttpRequest } from "../../packages/mcp/src/http.js";
import {
  apiKeyDatabase,
  bearerToken,
  resolveApiKeyOwner,
} from "../../packages/mcp/src/apiKeys.js";

import { json } from "../_db.js";

import type { ApiRequest, ApiResponse } from "../_db.js";

/**
 * Largest request body, in bytes.
 *
 * `apply_dsl` and `insert_diagram` cap their code at 20,000 characters and
 * `expectedSceneVersion` is a number, so a legitimate request is well under
 * this. The cap exists so a caller cannot make the function read an unbounded
 * body into memory before anything validates it.
 */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Reads a request body that has already been parsed by Vercel.
 *
 * `readJson` in `api/_db.ts` is the existing helper for this, but it returns
 * `null` for anything that is not a JSON object; an MCP batch is an array,
 * which that helper refuses. So the parsing is done here, with the same
 * guards on the lazy body accessor and on malformed JSON.
 */
const mcpBody = (req: ApiRequest): unknown => {
  let body: unknown;
  try {
    body = (req as { body?: unknown }).body;
  } catch {
    return undefined;
  }

  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(body) as unknown;
      return parsed;
    } catch {
      return undefined;
    }
  }

  const serialised = JSON.stringify(body);
  if (Buffer.byteLength(serialised) > MAX_BODY_BYTES) {
    return undefined;
  }
  return body;
};

/** Answers 401 the way a Bearer endpoint should. */
const unauthorized = (res: ApiResponse): void => {
  res.setHeader("WWW-Authenticate", "Bearer");
  json(res, { error: "unauthorized" }, 401);
};

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  try {
    const token = bearerToken(
      Array.isArray(req.headers.authorization)
        ? req.headers.authorization.join(", ")
        : req.headers.authorization,
    );

    if (!token) {
      unauthorized(res);
      return;
    }

    const owner = await resolveApiKeyOwner(apiKeyDatabase, token);
    if (!owner) {
      unauthorized(res);
      return;
    }

    const body = mcpBody(req);
    if (body === undefined) {
      json(res, { error: "invalid JSON body" }, 400);
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("[api/mcp] DATABASE_URL is not set");
      json(res, { error: "internal error" }, 500);
      return;
    }

    const db = createDatabase(databaseUrl);
    const response = await handleHttpRequest(
      { databaseUrl, owner, options: DEFAULT_OPTIONS },
      db,
      { owner, method: req.method ?? "POST", body },
    );

    res.setHeader("Content-Type", "application/json");
    for (const [name, value] of response.headers.entries()) {
      if (name.toLowerCase() === "content-type") {
        continue;
      }
      res.setHeader(name, value);
    }
    res.status(response.status);
    // The SDK returns a JSON body in this mode; forward it verbatim.
    const text = await response.text();
    res.end(text);
  } catch (error) {
    // Log the real cause server-side; return an opaque 500. Driver errors can
    // contain the connection URL, which must never reach a client.
    console.error("[api/mcp]", error);
    json(res, { error: "internal error" }, 500);
  }
}
