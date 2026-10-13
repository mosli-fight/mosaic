import { test, expect } from "@playwright/test";

/**
 * Dev-server smoke check: both apps boot under a single `yarn start`.
 *
 * Runs against already-running dev servers (editor :3000, dashboard :3002) and
 * is NOT part of `yarn e2e` - that suite builds and serves its own bundles. This
 * exists to prove the developer-facing wiring, which the built-output suite
 * cannot see.
 */

const EDITOR_ROOT = "http://localhost:3000/";
const EDITOR_MOUNT = "http://localhost:3000/editor/";
const DASHBOARD_ROOT = "http://localhost:3002/";
const DASHBOARD_GRID = "http://localhost:3002/dashboard";

test("editor renders at its dev root", async ({ page }) => {
  await page.goto(EDITOR_ROOT);
  // The canvas is the real signal: the static shell renders even when the
  // bundle fails to boot, so a <h1> alone would be a false pass.
  await page
    .locator("canvas.excalidraw__canvas")
    .first()
    .waitFor({ state: "attached", timeout: 120_000 });
  await expect(page).toHaveTitle(/Mosaic/);
});

test("editor renders at its /editor mount", async ({ page }) => {
  await page.goto(EDITOR_MOUNT);
  await page
    .locator("canvas.excalidraw__canvas")
    .first()
    .waitFor({ state: "attached", timeout: 120_000 });
});

test("dashboard renders on its own origin", async ({ page }) => {
  await page.goto(DASHBOARD_ROOT);
  await expect(page.getByTestId("nav-all-boards")).toBeVisible({
    timeout: 120_000,
  });
  // "/" redirects client-side to /dashboard.
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByTestId("new-board")).toBeVisible();
});

test("a board opens in the editor and shares IndexedDB", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(DASHBOARD_GRID);
  await page.getByTestId("new-board").click();
  // The editor's own footer link; the board page's header link was removed in
  // Task 1 because it duplicated this one.
  await page
    .frameLocator('[data-testid="editor-frame"]')
    .getByTestId("back-to-dashboard")
    .click();
  await expect(page.getByTestId("board-grid")).toBeVisible();

  await page.locator('[data-testid^="board-card-"]').first().click();

  // The editor iframe must actually mount. Because the dashboard proxies
  // `/editor` on its own origin, this is same-origin and board mode can read the
  // board that was just created - which is the whole point of the layout.
  const canvas = page
    .frameLocator('[data-testid="editor-frame"]')
    .locator("canvas.excalidraw__canvas.interactive");
  await canvas.waitFor({ state: "attached", timeout: 90_000 });

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});
