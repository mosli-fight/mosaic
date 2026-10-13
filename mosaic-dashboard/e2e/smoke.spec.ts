import { expect, test } from "@playwright/test";

import {
  blockExternalRequests,
  createBoard,
  createFolder,
  openBoardMenu,
  resetLocalData,
  waitForDashboard,
} from "./helpers";

/**
 * End-to-end smoke test (STEP 5).
 *
 * Walks the whole product loop in one spec on purpose:
 *
 *   create -> rename -> favourite -> file in a folder -> open the editor ->
 *   draw a rectangle -> Ctrl+S -> back -> thumbnail visible -> trash -> restore
 *
 * Keeping it as a single flow means a broken hand-off between the dashboard and
 * the editor (the IndexedDB bridge) fails loudly here, rather than passing as
 * two independently-green halves. `dashboard.spec.ts` and `editor.spec.ts` then
 * cover each feature in isolation, so a failure names the feature.
 */
test.describe("Mosaic dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalRequests(page);
    await resetLocalData(page);
  });

  test("full board lifecycle", async ({ page }) => {
    // ---- create ----------------------------------------------------------
    const boardId = await createBoard(page);
    await expect(page.getByTestId("board-count")).toContainText("1 board");

    // ---- rename ----------------------------------------------------------
    await openBoardMenu(page, boardId);
    await page.getByTestId("menu-rename").click();
    const renameInput = page.getByTestId(`rename-input-${boardId}`);
    await expect(renameInput).toBeVisible();
    await renameInput.fill("Sprint Planning");
    await renameInput.press("Enter");
    await expect(page.getByTestId(`board-name-${boardId}`)).toHaveText(
      "Sprint Planning",
    );

    // ---- favourite -------------------------------------------------------
    await page.getByTestId(`star-${boardId}`).click();
    await expect(page.getByTestId(`star-${boardId}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // ---- file in a folder ------------------------------------------------
    const folderId = await createFolder(page, "Team");
    await openBoardMenu(page, boardId);
    await page.getByTestId("menu-move-toggle").click();
    await page.getByTestId(`menu-move-${folderId}`).click();

    // "All boards" lists every board regardless of folder, so the meaningful
    // assertion is the folder view plus the sidebar counter.
    await page.getByTestId(`folder-${folderId}`).click();
    await expect(page.getByTestId(`board-card-${boardId}`)).toBeVisible();
    await expect(
      page.getByTestId(`folder-${folderId}`).locator("span").last(),
    ).toHaveText("1");
    await page.getByTestId("nav-all-boards").click();

    // ---- open the editor and draw ----------------------------------------
    await page.getByTestId(`board-card-${boardId}`).click();
    await page.waitForURL(`**/board/${boardId}`);

    // Two canvases share the `excalidraw__canvas` class (a static scene layer and
    // an interactive layer); the interactive one is the top layer and is what
    // receives pointer events.
    const frame = page.frameLocator('[data-testid="editor-frame"]');
    const canvas = frame.locator("canvas.excalidraw__canvas.interactive");
    await canvas.waitFor({ state: "attached", timeout: 90_000 });

    // The shape tools are rendered from a dynamic list and have no stable
    // data-testid, so select the rectangle with its keyboard shortcut.
    await frame.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("r");

    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, box.y + 260, { steps: 12 });
    await page.mouse.up();

    // Ctrl+S is intercepted in board mode and writes to IndexedDB.
    await page.keyboard.press("Control+s");
    await expect(page.getByTestId("save-status")).toBeVisible({
      timeout: 20_000,
    });

    // ---- back to the dashboard: the thumbnail is now visible ------------
    // The board page's own header back-link was removed in Task 1 because the
    // editor already renders one in its footer, so navigation goes through that.
    await frame.getByTestId("back-to-dashboard").click();
    await waitForDashboard(page);
    await expect(page.getByTestId(`board-thumb-${boardId}`)).toBeVisible({
      timeout: 20_000,
    });

    // ---- trash, then restore --------------------------------------------
    await openBoardMenu(page, boardId);
    await page.getByTestId("menu-trash").click();
    await expect(page.getByTestId(`board-card-${boardId}`)).toHaveCount(0);

    await page.getByTestId("nav-trash").click();
    await expect(page.getByTestId(`board-card-${boardId}`)).toBeVisible();
    await openBoardMenu(page, boardId);
    await page.getByTestId("menu-restore").click();

    await page.getByTestId("nav-all-boards").click();
    await expect(page.getByTestId(`board-card-${boardId}`)).toBeVisible();
    await expect(page.getByTestId(`board-name-${boardId}`)).toHaveText(
      "Sprint Planning",
    );
  });
});
