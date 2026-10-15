// STEP 2.1, corrected — reads the `boards` store specifically.
//
// The first pass used `db.objectStoreNames[0]`, which is "activity", not
// "boards", so it reported a zero-length scene for an activity row. This reads
// the store the dashboard actually uses.
import { test, expect } from "@playwright/test";

const LOCAL = "http://localhost:3101";

const readBoard = async (page, id: string) =>
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
    if (!rec) {
      return { found: false };
    }
    let elementCount = 0;
    try {
      elementCount = JSON.parse(rec.scene ?? "{}").elements?.length ?? 0;
    } catch {
      elementCount = -1;
    }
    return {
      found: true,
      sceneBytes: rec.scene ? String(rec.scene).length : 0,
      elementCount,
      hasThumbnail: !!rec.thumbnail,
      sceneVersion: rec.sceneVersion,
      updatedAt: rec.updatedAt,
      keys: Object.keys(rec),
    };
  }, id);

test("STEP 2.1: where does a drawing stop?", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\//.test(r.url())) {
      apiCalls.push(`${r.method()} ${r.url().replace(LOCAL, "")}`);
    }
  });

  await page.goto(`${LOCAL}/dashboard`);
  await page.getByTestId("new-board").click();
  await page.waitForURL("**/board/**");
  await page.waitForTimeout(5000);
  const boardId = page.url().split("/board/")[1];

  const asCreated = await readBoard(page, boardId);
  // eslint-disable-next-line no-console
  console.log(`A_BOARDS_ROW_AS_CREATED: ${JSON.stringify(asCreated)}`);

  // Draw.
  const canvas = page
    .frameLocator('[data-testid="editor-frame"]')
    .locator("canvas.excalidraw__canvas.interactive");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const box = (await canvas.boundingBox())!;

  // eslint-disable-next-line no-console
  console.log("DRAWING_THREE_SHAPES");
  for (const [dx, dy] of [
    [200, 150],
    [320, 230],
    [440, 310],
  ]) {
    await page.mouse.move(box.x + dx, box.y + dy);
    await page.mouse.down();
    await page.mouse.move(box.x + dx + 120, box.y + dy + 90, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }

  // eslint-disable-next-line no-console
  console.log("WAITING_15S_FOR_AUTOSAVE");
  await page.waitForTimeout(15_000);

  const afterSave = await readBoard(page, boardId);
  // eslint-disable-next-line no-console
  console.log(`B_BOARDS_ROW_AFTER_SAVE: ${JSON.stringify(afterSave)}`);
  // eslint-disable-next-line no-console
  console.log(`C_API_CALLS: ${JSON.stringify(apiCalls)}`);

  // Reload and see whether the canvas comes back with content.
  await page.goto(`${LOCAL}/board/${boardId}`);
  await page.waitForTimeout(6000);
  const afterReload = await readBoard(page, boardId);
  // eslint-disable-next-line no-console
  console.log(`D_BOARDS_ROW_AFTER_RELOAD: ${JSON.stringify(afterReload)}`);

  // And what the editor actually renders, counted from the live scene.
  const rendered = await page
    .frameLocator('[data-testid="editor-frame"]')
    .locator("canvas.excalidraw__canvas.interactive")
    .evaluate(() => {
      const w = window as any;
      // Excalidraw exposes its app state on window.h in test builds.
      const el = w.h?.elements ?? w.__EXCALIDRAW__?.elements;
      return {
        count: el?.length ?? "not exposed",
        keys: Object.keys(w)
          .filter((k) => /excal|h$|H$/.test(k))
          .slice(0, 10),
      };
    })
    .catch((e) => ({ error: String(e).slice(0, 100) }));
  // eslint-disable-next-line no-console
  console.log(`E_RENDERED_ELEMENTS: ${JSON.stringify(rendered)}`);

  await page.screenshot({ path: "task2-repro.png" });
});
