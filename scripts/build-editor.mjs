// Sets EXCALIDRAW_BASE_PATH for the editor build, then runs it.
//
// Why a script rather than an inline `FOO=bar yarn ...`:
//
//   - POSIX-only syntax. On Windows `cmd.exe` it silently does something else,
//     which is the same trap `excalidraw-app/vite.config.mts` documents when it
//     prefers `VITE_MOSAIC_EDITOR_BASE` over an env prefix.
//   - no new dependency. `cross-env` is not in devDependencies, and adding it
//     for one variable is not worth the lockfile churn.
//
// scripts/build-e2e.mjs already does exactly this, so the pattern is established
// in the repo rather than introduced here.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The base the editor's built assets will be requested under.
 *
 * It must match where `scripts/copy-editor-to-dist.mjs` puts the bundle, which
 * is `mosaic-dashboard/dist/editor/`. Vercel serves that folder at `/editor/`
 * and rewrites `/app/*` onto the same place, so `/editor/` is correct from both.
 *
 * Docker overrides this with `/app` via the Dockerfile's own ARG, which is why
 * the value is read from the environment rather than hard-coded here.
 */
const BASE = process.env.EXCALIDRAW_BASE_PATH ?? "/editor";

const fail = (msg) => {
  console.error(`[build-editor] ${msg}`);
  process.exit(1);
};

const appDir = join(repoRoot, "excalidraw-app");
if (!existsSync(join(appDir, "package.json"))) {
  fail(`excalidraw-app/package.json not found at ${appDir}`);
}

console.log(`[build-editor] EXCALIDRAW_BASE_PATH=${BASE}`);

const child = spawn(
  process.platform === "win32" ? "yarn.cmd" : "yarn",
  ["build"],
  {
    cwd: appDir,
    env: { ...process.env, EXCALIDRAW_BASE_PATH: BASE },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`[build-editor] done, base=${BASE}`);
  } else {
    fail(`editor build exited with code ${code}`);
  }
});
