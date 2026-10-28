/**
 * The stdio MCP server.
 *
 * This module is the adapter: it validates tool input, calls the plain
 * functions in `tools.ts` / `writeTools.ts`, and serialises the result.
 * Anything worth testing lives behind those functions, so this file stays
 * small enough to read in one sitting — which matters, because it is the only
 * place that decides what a model is allowed to ask for.
 *
 * ## Read and write are separated by module, not by a flag
 *
 * The read tools issue only `SELECT`s; every `INSERT`/`UPDATE` lives in
 * `writes.ts`, which only `writeTools.ts` imports. That is a weaker guarantee
 * than Phase 1's "there is no write path at all", and it is the strongest one
 * available once writes exist: a read tool cannot reach a write by accident,
 * and the whole write surface is one file to review.
 *
 * The safety properties that replace the old structural guarantee are:
 *
 * - **Owner scoping on every statement.** The scope fragment comes from
 *   `boardScope`, the same function the HTTP API uses.
 * - **A version guard on every scene write.** The caller passes the
 *   `scene_version` it edited; a stale value fails the call rather than
 *   overwriting newer work.
 * - **A size cap before the write.** A scene above `maxSceneBytes` is refused,
 *   so the server cannot write a board it would then refuse to read.
 * - **Honest annotations.** Write tools are `readOnlyHint: false`; the ones
 *   that can destroy existing content are `destructiveHint: true`.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { describeOwner } from "./owner.js";
import {
  addElementToolInput,
  createBoardInput,
  deleteElementInput,
  duplicateBoardInput,
  getBoardInput,
  listBoardsInput,
  moveElementInput,
  renameBoardInput,
  searchBoardsInput,
  updateElementInput,
} from "./schemas.js";
import {
  runGetBoard,
  runListBoards,
  runSearchBoards,
  ToolError,
} from "./tools.js";
import {
  runAddElement,
  runCreateBoard,
  runDeleteElement,
  runDuplicateBoard,
  runMoveElement,
  runRenameBoard,
  runUpdateElement,
} from "./writeTools.js";

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

  // Registered here rather than in `main` so a test that drives `createServer`
  // sees the same tool set a client does. `registerWriteTools` is defined below
  // and is initialised by the time this function is called.
  registerWriteTools(server, config, db);

  return server;
};

/**
 * Registers the write tools.
 *
 * Split from {@link createServer} so the read and write surfaces are two
 * readable blocks rather than one long list, and so a reviewer can see the
 * whole write surface at once. Every one of these is `readOnlyHint: false`;
 * the annotations say what each can destroy, because a client's confirmation UI
 * is driven by them.
 */
export const registerWriteTools = (
  server: McpServer,
  config: Config,
  db: Database,
) => {
  server.registerTool(
    "create_board",
    {
      title: "Create board",
      description:
        "Create a new, empty Mosaic board for the configured owner. Returns " +
        "the new board's id, which the element tools need.",
      inputSchema: createBoardInput,
      annotations: {
        // A create adds a row and touches nothing that already exists, so it is
        // not destructive — but it is emphatically not read-only, and saying so
        // is what makes a client ask before running it.
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runCreateBoard(db, config.owner, createBoardInput.parse(args)),
      ),
  );

  server.registerTool(
    "rename_board",
    {
      title: "Rename board",
      description:
        "Change a board's name. Does not touch the scene, so it cannot " +
        "clobber an edit; pass expectedSceneVersion to have it refuse if the " +
        "board has moved on anyway.",
      inputSchema: renameBoardInput,
      annotations: {
        readOnlyHint: false,
        // A rename replaces one field of one row. The old name is gone, which
        // is a small loss, but no content is destroyed — the hint is reserved
        // for tools that can remove elements or replace a scene.
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runRenameBoard(db, config.owner, renameBoardInput.parse(args)),
      ),
  );

  server.registerTool(
    "duplicate_board",
    {
      title: "Duplicate board",
      description:
        "Copy a board — scene, size and metadata — under a new id. The copy " +
        "is unfiled and unfavourited, like the dashboard's Duplicate.",
      inputSchema: duplicateBoardInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runDuplicateBoard(db, config.owner, duplicateBoardInput.parse(args)),
      ),
  );

  server.registerTool(
    "add_element",
    {
      title: "Add element",
      description:
        "Add one element to a board: a rectangle, ellipse, arrow, text, " +
        "sticky note or frame. The scene_version you pass must still be the " +
        "board's — a stale value is refused rather than overwriting newer " +
        "work. Returns the new element's id.",
      inputSchema: addElementToolInput,
      annotations: {
        // Adds to the board and changes nothing already on it, so it is not
        // destructive — but it does write, and the scene_version can move.
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runAddElement(
          db,
          config.owner,
          config.options,
          addElementToolInput.parse(args),
        ),
      ),
  );

  server.registerTool(
    "update_element",
    {
      title: "Update element",
      description:
        "Change one element's geometry, style, text or frame name. " +
        "Replaces the fields you name and leaves the rest alone. A sticky " +
        "note is re-fitted to its new text, so it grows rather than " +
        "overflowing.",
      inputSchema: updateElementInput,
      annotations: {
        readOnlyHint: false,
        // Replacing an element's text or size destroys what was there.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runUpdateElement(
          db,
          config.owner,
          config.options,
          updateElementInput.parse(args),
        ),
      ),
  );

  server.registerTool(
    "move_element",
    {
      title: "Move element",
      description:
        "Move one element to a new x/y. Its size, style and content are " +
        "untouched; to resize, use update_element.",
      inputSchema: moveElementInput,
      annotations: {
        readOnlyHint: false,
        // Moving loses the old position, which a caller can restore — but it
        // is still a change to existing content, so it is not claimed as
        // non-destructive.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runMoveElement(
          db,
          config.owner,
          config.options,
          moveElementInput.parse(args),
        ),
      ),
  );

  server.registerTool(
    "delete_element",
    {
      title: "Delete element",
      description:
        "Delete one element from a board. The element is marked deleted, " +
        "as the app's own delete does, so it can still be restored with " +
        "undo in the editor.",
      inputSchema: deleteElementInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        // Deleting an already-deleted element is refused, so a repeat call
        // fails rather than succeeding twice.
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) =>
      guard(() =>
        runDeleteElement(
          db,
          config.owner,
          config.options,
          deleteElementInput.parse(args),
        ),
      ),
  );
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
