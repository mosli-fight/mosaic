/**
 * The streamable HTTP transport for the MCP server.
 *
 * This is the hosted half of Phase 4: the same server `index.ts` runs over
 * stdio, served over HTTP so a remote client can reach it. It is a function
 * rather than a route so it stays testable without Vercel — the route in
 * `api/mcp/index.ts` is a thin adapter that turns a Node request into the
 * inputs this function takes.
 *
 * The transport is the SDK's Web Standard one, driven with a hand-built
 * `Request` and answered with the `Response` it returns, rather than the
 * Node one. That is deliberate: the Web Standard pair is the whole surface
 * the SDK needs, so a test can drive a real request through it without a
 * socket, and the route can hand the same `Response` straight back to
 * Vercel's runtime.
 *
 * ## Stateless, on purpose
 *
 * The transport is constructed with `sessionIdGenerator: undefined`, so the
 * MCP SDK runs in its stateless mode: no session id is issued, no session is
 * validated, and no per-session state is kept. That is the only mode that
 * survives Vercel serverless, where each request may land on a fresh
 * instance and one instance may die between two requests from the same
 * client. A stateful transport would keep its session registry in memory and
 * answer 404 for every request after a cold start.
 *
 * The cost is real and is stated here rather than hidden: a stateless server
 * cannot send server-initiated notifications, cannot resume a dropped SSE
 * stream, and has no way to address one client out of many. None of the
 * fifteen tools need any of that — every tool is a request and a reply.
 *
 * ## JSON responses instead of SSE streams
 *
 * `enableJsonResponse: true` makes the transport answer with a single JSON
 * body rather than opening a Server-Sent Events stream. On serverless a held
 * connection is billed for its whole lifetime and ties up one instance, so
 * streaming is pure cost without a benefit here.
 *
 * ## GET is refused
 *
 * A `GET` on this endpoint would open a standalone SSE stream for
 * server-initiated messages. There are none, in stateless mode, so the
 * request is answered 405 rather than left to open a stream that never
 * carries anything. `DELETE`, which in stateful mode terminates a session,
 * is refused the same way.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createDatabase } from "./db.js";
import { createServer } from "./server.js";

import type { Config } from "./config.js";
import type { Database } from "./db.js";
import type { OwnerIdentity } from "./config.js";

/** What the HTTP layer needs to run one request. */
export type HttpRequestContext = {
  /** The authenticated owner, resolved from the API key by the caller. */
  owner: OwnerIdentity;
  /** The request method. */
  method: string;
  /** The raw request body, already read and parsed by the caller. */
  body: unknown;
  /** Where tool-failure detail goes. Defaults to stderr. */
  log?: (message: string) => void;
};

/**
 * Serves one MCP request over the streamable HTTP transport.
 *
 * `owner` is the identity the API key resolved to, and it is the only thing
 * that decides whose boards the tools can see: it becomes the `Config` the
 * server is built with, and from there it flows into the same `boardScope`
 * every query already uses.
 */
export const handleHttpRequest = async (
  config: Config,
  db: Database,
  context: HttpRequestContext,
): Promise<Response> => {
  const log =
    context.log ??
    ((message: string) => {
      process.stderr.write(`${message}\n`);
    });

  if (context.method === "GET" || context.method === "DELETE") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      }),
      {
        status: 405,
        headers: {
          Allow: "POST",
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (context.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: {
        Allow: "POST",
        "Content-Type": "application/json",
      },
    });
  }

  const ownerConfig: Config = {
    databaseUrl: config.databaseUrl,
    owner: context.owner,
    options: config.options,
  };

  const server = createServer(ownerConfig, db, log);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  const request = new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(context.body ?? null),
  });

  const response = await transport.handleRequest(request, {
    parsedBody: context.body,
  });

  await transport.close();
  return response;
};

/**
 * Builds the database handle for the hosted route.
 *
 * Split from {@link handleHttpRequest} so the route does not have to know
 * about `createDatabase`; the wire format stays in one place.
 */
export const hostedDatabase = (databaseUrl: string): Database =>
  createDatabase(databaseUrl);
