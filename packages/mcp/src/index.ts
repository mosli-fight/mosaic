/**
 * The stdio MCP server.
 *
 * This module is the adapter: it validates tool input, calls the plain
 * functions in `tools.ts`, and serialises the result. Anything worth testing
 * lives behind those functions, so this file stays small enough to read in one
 * sitting — which matters, because it is the only place that decides what a
 * model is allowed to ask for.
 *
 * ## Read-only, and enforced structurally
 *
 * There is no write tool, and no code path here issues an `INSERT`, `UPDATE` or
 * `DELETE`. `db.ts` exposes only the three read queries. That is stronger than
 * a flag or a permission check: an absent code path cannot be reached by a
 * prompt that asks nicely.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { describeOwner } from "./owner.js";
import {
  getBoardInput,
  listBoardsInput,
  searchBoardsInput,
} from "./schemas.js";
import {
  runGetBoard,
  runListBoards,
  runSearchBoards,
  ToolError,
} from "./tools.js";

import type { Config } from "./config.js";
import type { Database } from "./db.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wraps a successful result in the MCP envelope. */
const ok = (result: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
});

/**
 * Wraps a failure.
 *
 * `isError: true` rather than a thrown exception: an MCP tool error is shown to
 * the model as the result of the call, which is what lets it correct itself —
 * "no board with that id" is actionable, while a protocol-level failure is not.
 * The message is the whole payload, so it must never contain a connection
 * string or a stack trace; `main` is where unexpected errors are logged.
 */
const fail = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

/**
 * Runs a tool body, converting a {@link ToolError} into a tool error result.
 *
 * Anything that is *not* a `ToolError` is a bug or an infrastructure failure.
 * It is reported to the caller as a generic message and logged in full to
 * stderr, rather than rethrown: the Neon driver's errors can embed the
 * connection string, and a stack trace is not something a model can act on.
 * The detail stays in the client's log, where an operator can read it.
 */
const guard = async (body: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    return ok(await body());
  } catch (error) {
    if (error instanceof ToolError) {
      return fail(error.message);
    }
    process.stderr.write(
      `[mosaic-mcp] tool failed: ${
        error instanceof Error ? error.stack ?? error.message : String(error)
      }\n`,
    );
    return fail(
      "The Mosaic database could not be read. Check that DATABASE_URL is " +
        "correct and reachable; the server's stderr log has the detail.",
    );
  }
};

/** Builds the server with its tools registered. Exported so tests can drive it. */
export const createServer = (config: Config, db: Database): McpServer => {
  const server = new McpServer({
    name: "mosaic",
    version: "0.1.0",
  });

  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description:
        "List Mosaic whiteboards, most recently used first. Returns metadata " +
        "only (id, name, folder, favorite, timestamps, size in bytes) — never " +
        "the scene itself. Use get_board to see what is on a board.",
      inputSchema: listBoardsInput,
      annotations: {
        // Hints for the client's UI. They are advisory by the spec, which is
        // fine: the guarantee that this tool cannot write comes from there
        // being no write path, not from this annotation.
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() => runListBoards(db, config.owner, listBoardsInput.parse(args))),
  );

  server.registerTool(
    "get_board",
    {
      title: "Get board",
      description:
        "Read one Mosaic board: its metadata plus a compact summary of the " +
        "scene — element counts by type, all text content (capped), the " +
        "bounding box, and optionally a capped element list. The raw scene is " +
        "never returned.",
      inputSchema: getBoardInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const input = getBoardInput.parse(args);
      return guard(() =>
        runGetBoard(
          db,
          config.owner,
          config.options,
          input.boardId,
          input.includeElements === true,
        ),
      );
    },
  );

  server.registerTool(
    "search_boards",
    {
      title: "Search boards",
      description:
        "Search Mosaic boards by name and by the text inside them (labels, " +
        "notes, code blocks, frame names, links). Returns matching boards with " +
        "short excerpts around each content match.",
      inputSchema: searchBoardsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runSearchBoards(
          db,
          config.owner,
          config.options,
          searchBoardsInput.parse(args),
        ),
      ),
  );

  return server;
};

/**
 * Starts the server on stdio.
 *
 * Nothing is ever written to stdout except protocol messages: stdout *is* the
 * transport, so a stray `console.log` corrupts the session. Diagnostics go to
 * stderr, which the client surfaces in its own log.
 */
export const main = async (): Promise<void> => {
  let config: Config;
  try {
    config = loadConfig();
  } catch (error) {
    // A configuration failure is fatal and is the most likely first-run
    // experience, so it gets a clean message rather than a stack trace.
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
    return;
  }

  const db = createDatabase(config.databaseUrl);
  const server = createServer(config, db);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[mosaic-mcp] ready — reading boards for ${describeOwner(config.owner)} ` +
      `(read-only)\n`,
  );
};

// Only start when executed directly, so importing this module from a test does
// not open stdin and hang the test run.
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  main().catch((error: unknown) => {
    process.stderr.write(`[mosaic-mcp] fatal: ${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
