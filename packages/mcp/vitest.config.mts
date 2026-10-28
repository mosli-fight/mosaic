import { defineConfig } from "vitest/config";

import rootConfig from "../../vitest.config.mts";

/**
 * Runs the MCP package's tests on their own.
 *
 * The root config is jsdom + the editor's setup file, which the server package
 * has no use for — it is a Node program with no DOM. Keeping a local config
 * means `yarn --cwd packages/mcp test` is fast and fails for the right reasons.
 *
 * The root `test:app` suite still collects these files (they are ordinary
 * `*.test.ts` under `packages/`), so CI covers them without an extra step.
 *
 * ## Why the root aliases are reused rather than repeated
 *
 * `insert_diagram` renders the diagram-as-code DSL with the editor's own
 * engine (`packages/excalidraw/components/diagram`), which imports
 * `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math` and
 * `@excalidraw/utils` by package name. Those packages publish from `dist/`,
 * which is not built when tests run, so a bare import fails to resolve.
 *
 * The root config already maps every one of them to source. Copying that list
 * here would be a second place for it to drift — a new workspace package would
 * resolve under `yarn test:app` and fail under `yarn --cwd packages/mcp test`,
 * which is exactly the kind of "works in CI, broken locally" split worth
 * avoiding. Importing the list means the two cannot disagree.
 */
export default defineConfig({
  resolve: {
    alias: rootConfig.resolve?.alias,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
