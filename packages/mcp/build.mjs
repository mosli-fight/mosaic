/**
 * Bundles the MCP server into `dist/index.js`.
 *
 * esbuild rather than `tsc`: the server is a Node executable, and `tsc` here is
 * configured for type-checking only (`noEmit`). Bundling also folds in the
 * shared owner-scoping module from `api/_owner.ts` and the editor's own element
 * constructors and diagram engine, so the server cannot drift from the code the
 * app runs by resolving a stale copy at runtime.
 *
 * ## Why the external list is written out
 *
 * `packages: "external"` would be the obvious choice, and it is what this
 * script used before the element tools existed. It does not work any more:
 * that option externalises *every* bare import, including the transitive ones
 * inside the bundled editor sources, and `roughjs` is CommonJS with
 * extensionless internal imports (`roughjs/bin/math`). Node cannot resolve
 * those from an ESM bundle, so the server died on startup with
 * `ERR_MODULE_NOT_FOUND`.
 *
 * Listing the server's own runtime dependencies instead keeps them as real
 * imports — they are installed next to the package, and bundling the MCP SDK
 * and the Neon driver would add megabytes for no benefit — while everything
 * the editor sources pull in is bundled normally.
 *
 * ## Why `import.meta.env` is defined
 *
 * The editor sources are written for Vite, which replaces `import.meta.env.*`
 * at build time. Node has no such object, so the three flags the bundled code
 * reads are defined here. `DEV` is false: this is a production build, and the
 * debug-only branches it guards are not wanted in a server.
 *
 * Paths are resolved from this file rather than from the working directory.
 * esbuild treats a relative `entryPoints` as cwd-relative, so a bare
 * `src/index.ts` fails when the script is run from the repo root — which is how
 * someone is likely to try it. Resolving from `import.meta` makes
 * `node packages/mcp/build.mjs` work from anywhere.
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

/** The server's own runtime dependencies, kept as real imports. */
const EXTERNAL = [
  "@modelcontextprotocol/sdk",
  "@modelcontextprotocol/sdk/*",
  "@neondatabase/serverless",
  "zod",
];

await build({
  entryPoints: [join(packageDir, "src/index.ts")],
  outfile: join(packageDir, "dist/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: EXTERNAL,
  define: {
    "import.meta.env.MODE": '"production"',
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "true",
    // Read by the editor's debug plumbing. Undefined is the correct value:
    // the flag is off unless Vite injected it.
    "import.meta.env.VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX":
      "undefined",
  },
  sourcemap: true,
  logLevel: "info",
  banner: {
    // The file is also the package `bin`, so it has to be executable directly.
    js: "#!/usr/bin/env node",
  },
});
