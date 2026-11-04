/**
 * The stdio MCP server entry point.
 *
 * The server itself — tool registration, input validation, result
 * serialisation — is `server.ts`, shared with the hosted HTTP route so both
 * transports serve the same fifteen tools. This file is only the stdio
 * adapter: load the configuration, build the database handle, connect over
 * stdin/stdout.
 *
 * Nothing is ever written to stdout except protocol messages: stdout *is* the
 * transport, so a stray `console.log` corrupts the session. Diagnostics go to
 * stderr, which the client surfaces in its own log.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { describeOwner } from "./owner.js";
import { createServer } from "./server.js";

import type { Config } from "./config.js";

/**
 * Starts the server on stdio.
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
    `[mosaic-mcp] ready — reading and writing boards for ` +
      `${describeOwner(config.owner)}\n`,
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
