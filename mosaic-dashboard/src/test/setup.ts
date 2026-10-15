import { beforeEach } from "vitest";

// Must come first: Dexie resolves the global `indexedDB` at module-evaluation
// time, so the fake implementation has to be installed before `@/db` is imported
// anywhere in the test graph.
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

import { resetDatabase } from "@/lib/storage";

/**
 * Global test bootstrap for the dashboard's unit tests.
 *
 * Isolation strategy: instead of recreating the Dexie instance (which would mean
 * swapping the singleton that `lib/storage/indexeddb.ts` holds), we simply clear every
 * table before each test. Dexie performs fast reads from an in-memory cache, so
 * this is cheap and gives the same guarantee — no rows leak between cases.
 */
beforeEach(async () => {
  await resetDatabase();
});
