import { defineConfig } from "vitest/config";

/**
 * Runs the MCP package's tests on their own.
 *
 * The root config is jsdom + the editor's setup file, which the server package
 * has no use for — it is a Node program with no DOM. Keeping a local config
 * means `yarn --cwd packages/mcp test` is fast and fails for the right reasons.
 *
 * The root `test:app` suite still collects these files (they are ordinary
 * `*.test.ts` under `packages/`), so CI covers them without an extra step.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
