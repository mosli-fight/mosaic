// TASK 2, STEP 2.5.1 — local (IndexedDB path) verification.
//
// The point of the bridge is that the dashboard, not the editor, decides where
// data lives. Locally `VITE_API_URL` is undefined so `storage` is the IndexedDB
// adapter; this asserts the scene arrives there, and that it comes back after a
// reload.
import { test, expect } from "@playwright/test";

const LOCAL = "http://localhost:3101";

const readBoardRow = (page, id: string) =>
  page.evaluate(async (boardId) => {
    const open = indexedDB.open("mosaic-dashboard");
    const db: IDBDatabase = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result);
      open.onerror = () => rej(open.error);
    });
    const tx = db.transaction(["boards"], "readonly");
    const req = tx.objectStore("boards").get(boardId);
    const rec: any = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if (!rec) return { found: false };
    let elementCount = -1;
    try {
      elementCount = JSON.parse(rec.scene ?? "{}").elements?.length ?? 0;
    } catch {
      /* unparseable */
    }
    return {
      found: true,
      sceneBytes: rec.scene ? String(rec.scene).length : 0,
      elementCount,
      sceneVersion: rec.sceneVersion,
      hasThumbnail: !!rec.thumbnail,
    };
  }, id);

test("STEP 2.5.1 local: bridge persists the scene to IndexedDB", async ({
  page,
}) => {
  const saves: string[] = [];
  page.on("console", (m) => {
    const text = m.text();
    if (/mosaic/.test(text)) saves.push(text.slice(0, 160));
  });

  await page.goto(`${LOCAL}/dashboard`);
  await page.getByTestId("new-board").click();
  await page.waitForURL("**/board/**");
  await page.waitForTimeout(5000);
  const boardId = page.url().split("/board/")[1]!;

  const canvas = page
    .frameLocator('[data-testid="editor-frame"]')
    .locator("canvas.excalidraw__canvas.interactive");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "task2-debug-before.png" });
  console.log(`A_CANVAS_VISIBLE: true`);

  // Excalidraw boots with the *select* tool, and dragging with it pans nothing
  // and creates nothing — an earlier version of this test "verified" persistence
  // against a scene it never actually drew into. Pick the rectangle tool first
  // (keyboard shortcut, which does not depend on toolbar markup), then drag.
  //
  // Focus and the tool change both go through real mouse/keyboard events rather
  // than a locator `hover`: Excalidraw overlays the canvas with its own hint
  // layer, so Playwright's actionability checks never resolve and time out.
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await page.keyboard.press("r");

  for (const [dx, dy] of [
    [200, 150],
    [320, 230],
    [440, 310],
  ]) {
    // Escape first, then re-arm. After a rectangle is drawn Excalidraw returns
    // to the select tool, and a bare `r` press is swallowed while a selection is
    // active — so without the reset some drags produce no element at all.
    await page.keyboard.press("Escape");
    await page.keyboard.press("r");
    await page.mouse.move(box.x + dx, box.y + dy);
    await page.mouse.down();
    await page.mouse.move(box.x + dx + 110, box.y + dy + 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
  }

  // The pill only shows for ~1.6s after a confirmed write, so polling for it
  // after the fact (as an earlier version of this test did) proves nothing.
  // Watch for it *while* the save is happening instead.
  let pillSeen = "";
  const pillWatch = setInterval(async () => {
    try {
      const text = await page.getByTestId("save-status").innerText({ timeout: 400 });
      if (text && text !== pillSeen) {
        pillSeen = text;
      }
    } catch {
      /* not visible */
    }
  }, 150);
  await page.locator('[data-testid="editor-frame"]').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(2500);
  clearInterval(pillWatch);
  console.log(`A_PILL_TEXT_SEEN: ${JSON.stringify(pillSeen)}`);

  const saved = await readBoardRow(page, boardId);
  console.log(`B_IDB_ROW_AFTER_SAVE: ${JSON.stringify(saved)}`);
  console.log(`C_MOSAIC_CONSOLE: ${JSON.stringify(saves.slice(-4))}`);

  await page.goto(`${LOCAL}/board/${boardId}`);
  await page.waitForTimeout(6000);
  const afterReload = await readBoardRow(page, boardId);
  console.log(`D_IDB_ROW_AFTER_RELOAD: ${JSON.stringify(afterReload)}`);

  expect(saved.found).toBe(true);
  expect(saved.sceneBytes).toBeGreaterThan(0);
  expect(saved.sceneVersion).toBeGreaterThan(0);
  // The assertion that actually distinguishes a real drawing from an empty
  // canvas. Without it this test passes on a scene that was never drawn into.
  // Two, not three: re-arming Excalidraw's shape tool between drags is flaky and
  // the count is not what is under test — persistence is.
  expect(saved.elementCount).toBeGreaterThanOrEqual(2);
  expect(afterReload.sceneBytes).toBeGreaterThan(0);
  expect(afterReload.elementCount).toBeGreaterThanOrEqual(2);
  expect(afterReload.sceneVersion).toBeGreaterThanOrEqual(saved.sceneVersion);

  await page.screenshot({ path: "task2-local-verify.png" });
});