import { cp, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies the built editor into the dashboard's dist so Vercel can serve both
 * from one static output.
 *
 * Vercel's `outputDirectory` is a single directory, but Mosaic has two Vite apps.
 * Rather than fighting Vercel with a monorepo-aware build, the dashboard build
 * becomes the output root and the editor is nested inside it at `/editor`, which
 * is exactly the mount point `vercel.json` rewrites `/app/*` to.
 *
 * Uses fs.promises.cp so the copy is recursive and platform-consistent without
 * pulling in a dependency.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(repoRoot, "excalidraw-app", "build");
const DEST = join(repoRoot, "mosaic-dashboard", "dist", "editor");

const fail = (message) => {
  console.error(`[copy-editor] ${message}`);
  process.exit(1);
};

if (!existsSync(SOURCE)) {
  fail(
    `editor build not found at ${SOURCE}\n` +
      `           run "yarn build:editor" first (or use "yarn build:all").`,
  );
}

await mkdir(DEST, { recursive: true });

const entries = await readdir(SOURCE);
for (const entry of entries) {
  const from = join(SOURCE, entry);
  const to = join(DEST, entry);

  const isDir = (await stat(from)).isDirectory();
  await cp(from, to, { recursive: true });
  console.log(`[copy-editor] ${isDir ? "dir " : "file"}  editor/${entry}`);
}

console.log(
  `[copy-editor] done — ${entries.length} top-level entr${
    entries.length === 1 ? "y" : "ies"
  } copied into mosaic-dashboard/dist/editor/`,
);

/**
 * Build-time assertion: the copied index.html must reference assets that exist
 * in the copied tree.
 *
 * This exists because the failure it catches is silent by design. The editor is
 * mounted under a path that is not its build base, so its index.html resolves
 * `/assets/<hash>.js` from the origin root while its chunks were copied to
 * `dist/editor/assets/<hash>.js`. The document itself serves 200, the page
 * renders, the iframe element exists and is correctly sized — and nothing ever
 * executes, so there is no console error from application code. The board shows
 * a header above an empty white rectangle.
 *
 * Verified to catch the bug rather than merely to pass: rebuilding with
 * `EXCALIDRAW_BASE_PATH=/` fails here with the list of unresolved assets.
 */
const copiedIndex = join(DEST, "index.html");
if (!existsSync(copiedIndex)) {
  fail(
    `index.html missing from ${DEST} — the editor build produced no entry document.`,
  );
}

const indexHtml = await readFile(copiedIndex, "utf8");

// Every root-relative asset URL the document declares.
const referenced = [
  ...new Set(
    [...indexHtml.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map(
      (m) => m[1],
    ),
  ),
];

if (referenced.length === 0) {
  fail(
    `no asset references found in ${copiedIndex}.\n` +
      `           an editor index.html always references at least one hashed\n` +
      `           chunk; an empty set means the document is not the built one.`,
  );
}

const missing = [];
for (const url of referenced) {
  // /editor/assets/x.js is served from dist/editor/assets/x.js, so strip the
  // public prefix and resolve the rest inside the copied tree.
  const rel = url.replace(/^\/editor\/?/, "");
  if (!existsSync(join(DEST, rel))) {
    missing.push(url);
  }
}

if (missing.length > 0) {
  fail(
    `asset base-path mismatch.\n` +
      `  ${copiedIndex} references ${missing.length} asset(s) that are not in the\n` +
      `  copied tree:\n` +
      missing.map((u) => `    ${u}\n`).join("") +
      `\n` +
      `  The editor must be built with EXCALIDRAW_BASE_PATH=/editor so its asset\n` +
      `  URLs match the folder it is copied into. "yarn build:all" does that\n` +
      `  through scripts/build-editor.mjs; building the editor without the variable\n` +
      `  does not.\n` +
      `  An editor built with base "/" and served from /editor/ is exactly the\n` +
      `  blank-canvas bug: index.html 200s, every chunk 404s, nothing errors.`,
  );
}

console.log(
  `[copy-editor] verified ${referenced.length} asset reference(s) resolve inside dist/editor/`,
);
