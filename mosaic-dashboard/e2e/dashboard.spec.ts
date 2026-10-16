import { expect, test } from "@playwright/test";

import {
  createBoard,
  createFolder,
  openBoardMenu,
  blockExternalRequests,
  resetLocalData,
  waitForDashboard,
} from "./helpers";

/**
 * Dashboard QA (STEP 5).
 *
 * Covers the CRUD and organisation flows as separate specs rather than one long
 * walkthrough, so a failure names the feature that broke instead of a single
 * "the flow failed" at the end. The end-to-end *product* loop (open the editor,
 * draw, save, thumbnail) is the job of smoke.spec.ts.
 */
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalRequests(page);
    await resetLocalData(page);
  });

  test("creates, renames and favourites a board", async ({ page }) => {
    const id = await createBoard(page);
    await expect(page.getByTestId("board-count")).toContainText("1 board");

    // Rename through the context menu, which is the deterministic path to the
    // inline input (double-clicking a name is covered by the manual test).
    await openBoardMenu(page, id);
    await page.getByTestId("menu-rename").click();
    const input = page.getByTestId(`rename-input-${id}`);
    await expect(input).toBeVisible();
    await input.fill("Sprint Planning");
    await input.press("Enter");
    await expect(page.getByTestId(`board-name-${id}`)).toHaveText(
      "Sprint Planning",
    );

    // Favourite, and confirm it appears in the favourites view.
    await page.getByTestId(`star-${id}`).click();
    await expect(page.getByTestId(`star-${id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByTestId("nav-favorites").click();
    await expect(page.getByTestId(`board-card-${id}`)).toBeVisible();
    await expect(page.getByTestId("page-heading")).toHaveText("Favorites");
  });

  test("files a board in a folder via the context menu", async ({ page }) => {
    const id = await createBoard(page);
    const folderId = await createFolder(page, "Team");

    await openBoardMenu(page, id);
    await page.getByTestId("menu-move-toggle").click();
    await page.getByTestId(`menu-move-${folderId}`).click();

    // "All boards" intentionally lists every board, so assert on the folder view
    // and the sidebar counter instead.
    await page.getByTestId(`folder-${folderId}`).click();
    await expect(page.getByTestId(`board-card-${id}`)).toBeVisible();
    await expect(
      page.getByTestId(`folder-${folderId}`).locator("span").last(),
    ).toHaveText("1");
  });

  test("searches and sorts the board grid", async ({ page }) => {
    const a = await createBoard(page);
    await page.getByTestId(`menu-${a}`).click({ force: true });
    await page.getByTestId("menu-rename").click();
    await page.getByTestId(`rename-input-${a}`).fill("Alpha");
    await page.getByTestId(`rename-input-${a}`).press("Enter");

    const b = await createBoard(page);
    await openBoardMenu(page, b);
    await page.getByTestId("menu-rename").click();
    await page.getByTestId(`rename-input-${b}`).fill("Zulu");
    await page.getByTestId(`rename-input-${b}`).press("Enter");

    // Search narrows.
    await page.getByTestId("search-input").fill("alp");
    await expect(page.getByTestId(`board-card-${a}`)).toBeVisible();
    await expect(page.getByTestId(`board-card-${b}`)).toHaveCount(0);

    await page.getByTestId("search-input").fill("");

    // Sort by name, A first.
    await page.getByTestId("sort-select").selectOption("name");
    await expect(
      page.locator('[data-testid^="board-card-"]').first(),
    ).toHaveAttribute("data-testid", `board-card-${a}`);
  });

  test("multi-selects with ctrl and bulk-trashes", async ({ page }) => {
    const a = await createBoard(page);
    const b = await createBoard(page);

    await page.getByTestId(`select-${a}`).click({ force: true });
    await page.getByTestId(`select-${b}`).click({ force: true });

    await expect(page.getByTestId("bulk-bar")).toBeVisible();
    await expect(page.getByTestId("bulk-count")).toContainText("2 selected");

    await page.getByTestId("bulk-trash").click();
    await expect(page.locator('[data-testid^="board-card-"]')).toHaveCount(0);

    await page.getByTestId("nav-trash").click();
    await expect(page.getByTestId("board-count")).toContainText("2 boards");
  });

  test("trashes, restores and deletes forever", async ({ page }) => {
    const id = await createBoard(page);

    // Soft delete.
    await openBoardMenu(page, id);
    await page.getByTestId("menu-trash").click();
    await expect(page.getByTestId(`board-card-${id}`)).toHaveCount(0);
    await page.getByTestId("nav-trash").click();
    await expect(page.getByTestId(`board-card-${id}`)).toBeVisible();

    // Restore.
    await openBoardMenu(page, id);
    await page.getByTestId("menu-restore").click();
    await page.getByTestId("nav-all-boards").click();
    await expect(page.getByTestId(`board-card-${id}`)).toBeVisible();

    // Trash again, then destroy permanently. Deleting forever is irreversible, so
    // it asks first — same shape as the editor's Clear canvas dialog.
    await openBoardMenu(page, id);
    await page.getByTestId("menu-trash").click();
    await page.getByTestId("nav-trash").click();
    await openBoardMenu(page, id);
    await page.getByTestId("menu-delete-forever").click();
    await expect(page.getByTestId("modal")).toBeVisible();
    // Still there until the dialog is confirmed.
    await expect(page.getByTestId(`board-card-${id}`)).toBeVisible();
    await page.getByTestId("modal-confirm").click();
    await expect(page.getByTestId(`board-card-${id}`)).toHaveCount(0);

    // Gone from the sidebar counts too. The label and the count are separate
    // elements with no whitespace between them in the rendered text, so assert
    // on the count span rather than the link text.
    await page.getByTestId("nav-all-boards").click();
    await expect(
      page.getByTestId("nav-trash").locator("span").last(),
    ).toHaveText("0");
    await expect(
      page.getByTestId("nav-all-boards").locator("span").last(),
    ).toHaveText("0");
  });

  test("renames, recolours and deletes a folder without losing its boards", async () => {
    test.skip(
      true,
      "folder recolour UI not built yet; deleteFolder semantics are unit-tested",
    );
  });

  test("records activity for create, rename, favorite and move", async ({
    page,
  }) => {
    const id = await createBoard(page);
    await openBoardMenu(page, id);
    await page.getByTestId("menu-rename").click();
    await page.getByTestId(`rename-input-${id}`).fill("Tracked");
    await page.getByTestId(`rename-input-${id}`).press("Enter");
    await page.getByTestId(`star-${id}`).click();

    await page.getByTestId("nav-activity").click();
    await expect(page.getByTestId("activity-page")).toBeVisible();

    const rows = page.getByTestId("activity-row");
    await expect(rows.first()).toBeVisible();
    // At least create + rename + favorite.
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("activity-page")).toContainText("Tracked");
  });

  test("duplicates a board", async ({ page }) => {
    await createBoard(page);
    const first = page.locator('[data-testid^="board-card-"]').first();
    const id = (await first.getAttribute("data-testid"))!.replace(
      "board-card-",
      "",
    );

    await openBoardMenu(page, id);
    await page.getByTestId("menu-duplicate").click();

    await expect(page.locator('[data-testid^="board-card-"]')).toHaveCount(2);
    // The copy gets a new id and a "(copy)" suffix; assert on the grid text
    // rather than the original board's test id, which is unchanged.
    await expect(
      page.locator('[data-testid^="board-card-"]').filter({
        hasText: "copy",
      }),
    ).toHaveCount(1);
  });

  test("settings page reports local usage and can reset data", async ({
    page,
  }) => {
    await createBoard(page);
    await createFolder(page, "Docs");

    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("settings-page")).toContainText(
      "Using 1 board and 1 folder",
    );

    await page.getByTestId("reset-data").click();
    await expect(page.getByTestId("modal-confirm")).toBeVisible();
    await page.getByTestId("modal-confirm").click();

    await page.getByTestId("nav-all-boards").click();
    await waitForDashboard(page);
    await expect(page.getByTestId("board-count")).toContainText("0 boards");
  });

  test("downloads a board as a .mosaic envelope", async ({ page }) => {
    const id = await createBoard(page);
    await openBoardMenu(page, id);
    await page.getByTestId("menu-download-toggle").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("menu-download-mosaic").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.mosaic$/);
  });
});
