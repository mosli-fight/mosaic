import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      /**
       * `@mosaic/brand` is a workspace TypeScript source package with no build
       * step, exactly like the `@excalidraw/*` ones below. `packages/common`
       * imports it for `BRAND_NAME`, so without this alias every test that pulls
       * in `@excalidraw/common` fails to resolve it and the whole editor suite
       * errors before a single assertion runs.
       */
      {
        find: /^@mosaic\/brand$/,
        replacement: path.resolve(
          __dirname,
          "./packages/mosaic-brand/src/index.ts",
        ),
      },
      {
        find: /^@mosaic\/brand\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/mosaic-brand/src/$1"),
      },
      {
        find: /^@excalidraw\/common$/,
        replacement: path.resolve(__dirname, "./packages/common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: path.resolve(__dirname, "./packages/element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(__dirname, "./packages/excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/excalidraw/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(__dirname, "./packages/math/src/index.ts"),
      },
      {
        find: /^@excalidraw\/math\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/math/src/$1"),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(__dirname, "./packages/utils/src/index.ts"),
      },
      {
        find: /^@excalidraw\/utils\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/utils/src/$1"),
      },
      {
        find: /^@excalidraw\/fractional-indexing$/,
        replacement: path.resolve(
          __dirname,
          "./packages/fractional-indexing/src/index.ts",
        ),
      },
      {
        find: /^@excalidraw\/fractional-indexing\/(.*?)/,
        replacement: path.resolve(
          __dirname,
          "./packages/fractional-indexing/src/$1",
        ),
      },
      {
        find: /^@excalidraw\/laser-pointer$/,
        replacement: path.resolve(
          __dirname,
          "./packages/laser-pointer/src/index.ts",
        ),
      },
      {
        find: /^@excalidraw\/laser-pointer\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/laser-pointer/src/$1"),
      },
    ],
  },
  //@ts-ignore
  test: {
    /**
     * The dashboard has its own vitest project (`mosaic-dashboard/vitest.config.mts`)
     * and must not be collected here.
     *
     * Its tests import through the `@/` alias, need `fake-indexeddb` installed
     * before Dexie loads, and rely on its own `setupFiles`. Running them under
     * this config fails to resolve the alias and crashes on IndexedDB, which
     * looks like real breakage but is purely a harness mismatch. `yarn
     * test:dashboard` runs them correctly, and `test:all` chains both.
     */
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "mosaic-dashboard/**",
      "examples/**",
    ],
    // Since hooks are running in stack in v2, which means all hooks run serially whereas
    // we need to run them in parallel
    sequence: {
      hooks: "parallel",
    },
    setupFiles: ["./setupTests.ts"],
    globals: true,
    environment: "jsdom",
    /**
     * Retry once before failing.
     *
     * This suite is timing-sensitive — canvas geometry, font measurement and
     * `ResizeObserver` all depend on when layout settles — and a handful of
     * tests fail intermittently on both Windows and the Linux CI runner while
     * passing reliably in isolation. A pristine upstream worktree with zero
     * local changes reproduces it, so it predates the Mosaic work.
     *
     * `retry: 1` rather than a blanket ignore: a genuinely broken test still
     * fails, it just gets one clean environment to prove it. Anything more
     * than this would be hiding failures.
     */
    retry: 1,
    // don't list skipped tests in the failure tree — keeps output readable
    hideSkippedTests: true,
    coverage: {
      reporter: ["text", "json-summary", "json", "html", "lcovonly"],
      // Since v2, it ignores empty lines by default and we need to disable it as it affects the coverage
      // Additionally the thresholds also needs to be updated slightly as a result of this change
      ignoreEmptyLines: false,
      thresholds: {
        lines: 60,
        branches: 70,
        functions: 63,
        statements: 60,
      },
    },
  },
});
