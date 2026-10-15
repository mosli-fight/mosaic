import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Unit tests for the dashboard run in jsdom with a fake IndexedDB.
 *
 * `fake-indexeddb/auto` must be imported *before* anything touches Dexie, because
 * Dexie captures the global `indexedDB` at module-evaluation time. We do the
 * import here in `setupFiles` so every test file gets it first.
 */
export default defineConfig({
  /**
   * `fastRefresh: false` is what makes component tests possible.
   *
   * With fast refresh on, the plugin injects a runtime that expects the dev-server
   * preamble (`transformIndexHtml` output) to be present on the page. Vitest has no
   * such HTML, so every render of a `.tsx` module threw "@vitejs/plugin-react can't
   * detect preamble" before a single assertion ran. Disabling refresh leaves the
   * automatic JSX runtime — which is all these tests need.
   */
  plugins: [react({ fastRefresh: false })],
  resolve: {
    alias: [
      {
        find: /^@mosaic\/brand$/,
        replacement: path.resolve(__dirname, "../packages/mosaic-brand/src/index.ts"),
      },
      {
        find: /^@\/(.*?)/,
        replacement: path.resolve(__dirname, "./src/$1"),
      },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});