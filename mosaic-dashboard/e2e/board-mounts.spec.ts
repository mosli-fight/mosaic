import { expect, test } from "@playwright/test";

import {
  blockExternalRequests,
  resetLocalData,
  waitForDashboard,
} from "./helpers";

/**
 * The board iframe actually mounted the editor.
 *
 * ## Why this spec exists
 *
 * There is a way for the board page to render perfectly — header, board name,
 * back link, a correctly sized iframe element — while showing an empty white
 * rectangle instead of the editor, and it produced no error of any kind.
 *
 * The editor is built with a Vite `base` and then copied into
 * `mosaic-dashboard/dist/editor/`. When those two disagree, the editor's
 * `index.html` resolves its chunks against the wrong directory:
 *
 *     editor built with base "/"     →  requests  /assets/<hash>.js
 *     editor copied to dist/editor/  →  chunks at /editor/assets/<hash>.js
 *
 * The document itself returns 200, so the page loads and looks healthy. Every
 * chunk returns 404, so no script ever runs, so `#root` stays empty and no
 * error is thrown by application code. The only evidence is a network failure,
 * which is exactly what a test that only looks at the DOM will not notice.
 *
 * `scripts/copy-editor-to-dist.mjs` now fails the build on this mismatch. This
 * spec is the runtime counterpart: it fails if the deployed site regresses the
 * same way by any other route, and it fails loudly rather than by timing out on
 * a missing element.
 */
test.describe("board editor mounts", () => {
  test.beforeEach(async ({ page }) => {
    blockExternalRequests(page);
    await resetLocalData(page);
  });

  test("iframe serves its chunks and the editor canvas mounts", async ({
    page,
  }) => {
    /** Every response at or above 400, collected for the whole test. */
    const failed: string[] = [];
    /** Requests that never completed, which also mean "no editor". */
    const aborted: string[] = [];

    page.on("response", (r) => {
      if (r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });
    page.on("requestfailed", (r) => {
      aborted.push(`${r.url()} :: ${r.failure()?.errorText ?? "unknown"}`);
    });

    await waitForDashboard(page);
    await page.getByTestId("new-board").click();
    await page.waitForURL("**/board/**");

    // The iframe must point at the editor, not at the dashboard. This is the
    // assertion that fails first if the two base paths drift apart again.
    const src = await page.getByTestId("editor-frame").getAttribute("src");
    expect(src, "editor iframe must have a src").toBeTruthy();
    expect(src, "editor iframe must not point at the dashboard root").toContain(
      "/editor/",
    );

    // The editor's own bundle must load. Matching on /assets/ with the
    // extension catches both the entry chunk and the stylesheet, and would
    // catch either one alone regressing.
    const editorChunks = await page.evaluate(() => {
      const f = document.querySelector<HTMLIFrameElement>(
        '[data-testid="editor-frame"]',
      );
      if (!f?.contentDocument) {
        return [];
      }
      return [...f.contentDocument.querySelectorAll("script[src], link[href]")]
        .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
        .filter((u) => u.endsWith(".js") || u.endsWith(".css"));
    });

    expect(
      editorChunks.length,
      "editor document should reference its own bundle",
    ).toBeGreaterThan(0);

    for (const url of editorChunks) {
      const status = await page.request.get(
        new URL(url, page.url()).toString(),
      );
      expect(status.status(), `editor asset must resolve: ${url}`).toBeLessThan(
        400,
      );
    }

    // The canvas is the thing a user is actually missing when this breaks.
    const frame = page.frameLocator('[data-testid="editor-frame"]');
    await expect(
      frame.locator("canvas.excalidraw__canvas").first(),
      "editor canvas must mount inside the iframe",
    ).toBeVisible({ timeout: 20_000 });

    // Finally, nothing that the editor needs may have failed.
    //
    // Font files are excluded deliberately. The editor's `fonts/` directory is
    // copied to the editor root rather than into `assets/`, so a font request
    // can 404 while the editor renders perfectly on fallback faces. That is a
    // separate, cosmetic packaging issue, and folding it in here would mean this
    // spec fails for a reason that has nothing to do with the base-path contract
    // it exists to protect.
    const FONT = /\.(woff2|woff|ttf|otf)([?#].*)?(\s|$)/i;
    const blocking = failed.filter((f) => !FONT.test(f));

    expect(
      blocking,
      `no script or stylesheet may return >= 400 while opening a board:\n${blocking.join(
        "\n",
      )}`,
    ).toEqual([]);
    expect(
      aborted.filter((a) => !FONT.test(a)),
      `no script or stylesheet request may fail while opening a board:\n${aborted
        .filter((a) => !FONT.test(a))
        .join("\n")}`,
    ).toEqual([]);
  });

  test("the editor's chunks are served from the editor's own directory", async ({
    page,
  }) => {
    /**
     * The precise regression, asserted on its own.
     *
     * The editor and the dashboard both have an `assets/` directory. If the
     * editor is ever built with base "/", its chunk URLs collide with the
     * dashboard's, and whether a request succeeds becomes a matter of which app
     * happened to write that hashed filename — which is why the original failure
     * was intermittent-looking rather than obviously broken.
     */
    const editorChunkRequests: string[] = [];

    page.on("request", (r) => {
      if (/\/assets\/.*\.(js|css)$/.test(r.url())) {
        editorChunkRequests.push(r.url());
      }
    });

    await waitForDashboard(page);
    await page.getByTestId("new-board").click();
    await page.waitForURL("**/board/**");

    const frame = page.frameLocator('[data-testid="editor-frame"]');
    await expect(
      frame.locator("canvas.excalidraw__canvas").first(),
    ).toBeVisible({
      timeout: 20_000,
    });

    // Filter out the dashboard's own bundle by looking only at requests the
    // frame made. Both origins are identical here, so the reliable separator is
    // the path: the editor's chunks must be under /editor/assets/.
    const editorOwned = editorChunkRequests.filter((u) =>
      u.includes("/editor/assets/"),
    );

    expect(
      editorOwned.length,
      `editor must load its chunks from /editor/assets/, got:\n${editorChunkRequests.join(
        "\n",
      )}`,
    ).toBeGreaterThan(0);
  });
});
