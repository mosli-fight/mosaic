/**
 * Bundles the MCP server into `dist/index.js`.
 *
 * esbuild rather than `tsc`: the server is a Node executable, and `tsc` here is
 * configured for type-checking only (`noEmit`). Bundling also folds in the
 * shared owner-scoping module from `api/_owner.ts`, so the server cannot drift
 * from the HTTP API's scoping rule by resolving a stale copy at runtime.
 *
 * `packages: "external"` keeps third-party dependencies as real imports — the
 * MCP SDK and the Neon driver are installed next to the package, and bundling
 * them would make the executable tens of megabytes for no benefit.
 *
 * Paths are resolved from this file rather than from the working directory.
 * esbuild treats a relative `entryPoints` as cwd-relative and, with
 * `packages: "external"` set, a bare `src/index.ts` is then matched by that
 * option and rejected with "the entry point cannot be marked as external" —
 * an error that says nothing about the real cause. Resolving from `import.meta`
 * makes `node packages/mcp/build.mjs` work from the repo root, which is how
 * someone is likely to try it.
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(packageDir, "src/index.ts")],
  outfile: join(packageDir, "dist/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
  banner: {
    // The file is also the package `bin`, so it has to be executable directly.
    js: "#!/usr/bin/env node",
  },
});
