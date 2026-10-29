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
 * ## Why the build is split into chunks
 *
 * The server's startup path is small — the MCP SDK, the Neon driver, the
 * element constructors, the diagram engine. Two things it can do are not:
 * rendering a board to SVG pulls in the editor's whole export pipeline, and
 * that pipeline statically imports the font registry, which carries the
 * woff2/harfbuzz subsetting wasm (about 1.7 MB) even though the exporter runs
 * with `skipInliningFonts`; and the template catalogues are a few hundred
 * kilobytes of data.
 *
 * Bundling all of that into one file made `dist/index.js` 3.5 MB for a server
 * that mostly answers `list_boards`. With `splitting: true`, every dynamic
 * `import()` in the source becomes its own chunk: the entry stays around
 * 130 KB, and the export pipeline and the catalogues are read from disk the
 * first time a tool actually needs them. esbuild only splits dynamic imports
 * — a static import still lands in the entry — so the laziness has to be in
 * the source too, which is why `exportBoard.ts` and `templates.ts` import
 * their heavy modules inside the call.
 *
 * Paths are resolved from this file rather than from the working directory.
 * esbuild treats a relative `entryPoints` as cwd-relative, so a bare
 * `src/index.ts` fails when the script is run from the repo root — which is how
 * someone is likely to try it. Resolving from `import.meta` makes
 * `node packages/mcp/build.mjs` work from anywhere.
 */
import { build } from "esbuild";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

/** The server's own runtime dependencies, kept as real imports. */
const EXTERNAL = [
  "@modelcontextprotocol/sdk",
  "@modelcontextprotocol/sdk/*",
  "@neondatabase/serverless",
  "jsdom",
  "zod",
];

/**
 * Turns a `.woff2` import into the file's name.
 *
 * The editor's font modules import their font files as URLs, which Vite
 * rewrites to a hashed asset path. Node has no such loader, and the exporter
 * never uses the result: it runs with `skipInliningFonts`, so no font file is
 * fetched. esbuild still has to resolve the imports to bundle the modules
 * that contain them, and a URL string is exactly the shape
 * `ExcalidrawFontFace.createUrls` expects if anything ever does read one.
 */
const woff2AsUrl = {
  name: "woff2-as-url",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.woff2$/ }, (args) => ({
      contents: `export default ${JSON.stringify(basename(args.path))};`,
      loader: "js",
    }));
  },
};

await build({
  entryPoints: [join(packageDir, "src/index.ts")],
  outdir: join(packageDir, "dist"),
  entryNames: "index",
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Splits every dynamic `import()` into its own file. See the header.
  splitting: true,
  external: EXTERNAL,
  plugins: [woff2AsUrl],
  define: {
    // The editor sources are written for Vite, which replaces every
    // `import.meta.env.*` at build time. Node has no `import.meta.env` at all,
    // so the whole object is defined rather than a handful of keys: an
    // unlisted key would otherwise survive into the bundle and throw
    // `Cannot read properties of undefined` the first time a lazily-loaded
    // module touched it. That is exactly how the font registry's
    // `import.meta.env.PKG_NAME` broke the export chunk.
    //
    // `DEV` is false because this is a production build; the debug-only
    // branches it guards are not wanted in a server. Every other key is
    // absent, which is the correct value: Vite did not inject it.
    "import.meta.env": JSON.stringify({
      MODE: "production",
      DEV: false,
      PROD: true,
    }),
  },
  sourcemap: true,
  logLevel: "info",
  banner: {
    // The file is also the package `bin`, so it has to be executable directly.
    js: "#!/usr/bin/env node",
  },
});
