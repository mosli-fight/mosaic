// TASK 2, STEP 2.1 — reproduce against PRODUCTION.
//
// The local run already showed something the task description does not predict:
//
//   IFRAME_ORIGIN_SAME: true
//   B_BOARDS_ROW_AFTER_SAVE: sceneBytes 2705, sceneVersion 3, thumbnail set
//   C_API_CALLS: []
//
// i.e. locally the editor writes to IndexedDB and never calls /api/boards.
// Production has DATABASE_URL wired and the dashboard's storage adapter may be
// in API mode, so the same run has to be repeated there before writing any fix —
// otherwise the fix targets a path production does not take.
import { test, expect } from "@playwright/test";

const PROD = "https://mosaic-app-swart.vercel.app";

test("STEP 2.1 prod: where does a drawing stop?", async ({ page }) => {
  const apiCalls: string[] = [];
  const failures: string[] = [];

  page.on("request", (r) => {
    const u = r.url();
    if (/\/api\//.test(u)) {
      apiCalls.push(`${r.method()} ${u.replace(PROD, "")}`);
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400) {
      failures.push(`${r.status()} ${r.url().replace(PROD, "")}`);
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/font|woff/i.test(m.text())) {
      // eslint-disable-next-line no-console
      console.log(`CONSOLE_ERROR: ${m.text().slice(0, 140)}`);
    }
  });

  // (a) open a board on production
  await page.goto(`${PROD}/dashboard`);
  await page.getByTestId("new-board").click();
  await page.waitForURL("**/board/**");
  await page.waitForTimeout(6000);

  const boardId = page.url().split("/board/")[1] ?? "";
  // eslint-disable-next-line no-console
  console.log(`A_BOARD_ID: ${boardId}`);
  // eslint-disable-next-line no-console
  console.log(`B_URL: ${page.url()}`);

  // (e) IndexedDB databases + origins, as the task asks
  const dbs = await page.evaluate(async () => {
    const names = (await indexedDB.databases()).map(
      (d: IDBDatabaseInfo) => `${d.name ?? "(none)"}@${d.version ?? "?"}`,
    );
    return names;
  });
  // eslint-disable-next-line no-console
  console.log(`C_INDEXEDDB_DATABASES: ${JSON.stringify(dbs)}`);

  const sameOrigin = await page.evaluate(() => {
    const f = document.querySelector<HTMLIFrameElement>(
      '[data-testid="editor-frame"]',
    );
    return {
      frameOrigin: f?.contentWindow?.location.origin ?? "unknown",
      topOrigin: window.location.origin,
      src: f?.getAttribute("src"),
    };
  });
  // eslint-disable-next-line no-console
  console.log(`D_ORIGIN: ${JSON.stringify(sameOrigin)}`);

  // (b)(c) draw, wait past the autosave interval
  const canvas = page
    .frameLocator('[data-testid="editor-frame"]')
    .locator("canvas.excalidraw__canvas.interactive");
  await expect(canvas).toBeVisible({ timeout: 40_000 });

  const box = (await canvas.boundingBox())!;
  // eslint-disable-next-line no-console
  console.log("DRAWING_ONE_RECTANGLE");
  await page.mouse.move(box.x + 240, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 290, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  // eslint-disable-next-line no-console
  console.log("WAITING_15S_FOR_AUTOSAVE");
  await page.waitForTimeout(15_000);

  // (d) how many PATCH/PUT hit /api/boards/<id>?
  const boardCalls = apiCalls.filter((c) => /\/api\/boards\//.test(c));
  // eslint-disable-next-line no-console
  console.log(`E_ALL_API_CALLS: ${JSON.stringify(apiCalls)}`);
  // eslint-disable-next-line no-console
  console.log(
    `F_BOARD_PATCH_PUT_COUNT: ${
      boardCalls.filter((c) => /^(PATCH|PUT)/.test(c)).length
    }`,
  );
  // eslint-disable-next-line no-console
  console.log(`G_BOARD_CALLS: ${JSON.stringify(boardCalls)}`);
  // eslint-disable-next-line no-console
  console.log(`H_NETWORK_FAILURES: ${JSON.stringify(failures.slice(0, 8))}`);

  // What did IndexedDB end up with, on production?
  const stored = await page
    .evaluate(async (id) => {
      const open = indexedDB.open("mosaic-dashboard");
      const db: IDBDatabase = await new Promise((res, rej) => {
        open.onsuccess = () => res(open.result);
        open.onerror = () => rej(open.error);
      });
      const tx = db.transaction(["boards"], "readonly");
      const req = tx.objectStore("boards").get(id);
      const rec: any = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      if (!rec) {
        return { found: false };
      }
      let n = -1;
      try {
        n = JSON.parse(rec.scene ?? "{}").elements?.length ?? 0;
      } catch {
        /* unparseable */
      }
      return {
        found: true,
        sceneBytes: rec.scene ? String(rec.scene).length : 0,
        elementCount: n,
        sceneVersion: rec.sceneVersion,
        hasThumbnail: !!rec.thumbnail,
      };
    }, boardId)
    .catch((e) => ({ error: String(e).slice(0, 120) }));
  // eslint-disable-next-line no-console
  console.log(`I_IDB_BOARD_ROW: ${JSON.stringify(stored)}`);

  // Does it survive a reload?
  await page.goto(`${PROD}/board/${boardId}`);
  await page.waitForTimeout(7000);
  const after = await page
    .evaluate(async (id) => {
      const open = indexedDB.open("mosaic-dashboard");
      const db: IDBDatabase = await new Promise((res, rej) => {
        open.onsuccess = () => res(open.result);
        open.onerror = () => rej(open.error);
      });
      const tx = db.transaction(["boards"], "readonly");
      const req = tx.objectStore("boards").get(id);
      const rec: any = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      return {
        sceneBytes: rec?.scene ? String(rec.scene).length : 0,
        sceneVersion: rec?.sceneVersion,
      };
    }, boardId)
    .catch(() => ({}));
  // eslint-disable-next-line no-console
  console.log(`J_IDB_AFTER_RELOAD: ${JSON.stringify(after)}`);

  await page.screenshot({ path: "task2-prod-repro.png" });
  // eslint-disable-next-line no-console
  console.log("SCREENSHOT: task2-prod-repro.png");
});
