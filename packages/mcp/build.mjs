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
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
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
