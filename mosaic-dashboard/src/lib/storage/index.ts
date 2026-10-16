import { createApiAdapter } from "./api";
import { closeDatabase, indexedDbAdapter, resetDatabase } from "./indexeddb";

import type { StorageAdapter } from "./types";

/**
 * Backend selection — the single import every caller should need.
 *
 * The rule is deliberately boring: **`VITE_API_URL` present means API mode.**
 * An empty string counts as present, because that is exactly what production uses
 * (the functions are same-origin under `/api`), and it is set to an empty string
 * in `.env.production`. Falling back to IndexedDB when it is empty would silently
 * send production back to local storage.
 *
 * This module is also the only place that knows both backends exist, which keeps
 * `dexie` out of the bundle graph for API-mode callers beyond the one module that
 * genuinely needs it.
 */

/**
 * Raw value as Vite injected it. `undefined` means the variable was not defined at
 * all, which is the signal for local mode.
 *
 * Note the empty string is *defined*: production sets `VITE_API_URL=` because the
 * functions are same-origin under `/api`. Treating `""` as absent would send
 * production back to IndexedDB, which is precisely the bug this distinction avoids.
 */
const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

/** True when the build should talk to the Neon API rather than IndexedDB. */
export const usingApi = rawApiUrl !== undefined;

/**
 * Base URL for API calls, normalised so `""` and undefined behave identically: every
 * request in `api.ts` is written as `${baseUrl}/api/...`, which produces a correct
 * root-relative path when `baseUrl` is `""`.
 */
const apiUrl = rawApiUrl ?? "";

/**
 * Base URL every server request must be built on.
 *
 * Exported rather than kept private because `ShareModal` mints its share link
 * outside the adapter (there is no storage method for it). When that call used a
 * bare `/api/...` it was correct only for the same-origin deployment; point
 * `VITE_API_URL` at a different origin and the share request goes to the wrong host
 * and fails with the same "Could not share this board" the broken route produced.
 * One export means one place to get it right.
 */
export const apiBaseUrl = apiUrl;

/**
 * The active adapter.
 *
 * In API mode the boards operations go to Neon and the not-yet-servered ones fall
 * through to IndexedDB; see `api.ts` for why.
 */
export const storage: StorageAdapter = usingApi
  ? createApiAdapter({ baseUrl: apiUrl, local: indexedDbAdapter })
  : indexedDbAdapter;

/**
 * Which backend is live, for the Settings page and for `console.info` at startup.
 */
export type StorageBackend = "api" | "indexeddb";

export const backend: StorageBackend = usingApi ? "api" : "indexeddb";

// One line in the browser console so it is obvious which store answered a query.
console.info(
  `[storage] backend: ${backend}${
    usingApi
      ? ` (VITE_API_URL=${apiUrl === "" ? "<same-origin>" : apiUrl})`
      : ""
  }`,
);

/**
 * Local-only helpers, re-exported for the Settings page and tests.
 *
 * These reach past the adapter interface on purpose — there is no HTTP equivalent
 * of "close this database handle", so they are not part of `StorageAdapter`.
 */
export { closeDatabase, resetDatabase };
