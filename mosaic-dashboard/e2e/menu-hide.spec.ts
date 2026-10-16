import { test, expect } from "@playwright/test";

/**
 * Verifies the five upstream menu items are hidden behind FEATURE_FLAGS.
 *
 * Scope note: the five items live in the hamburger ("Main menu"). The checks are
 * split deliberately:
 *
 *  - the MENU assertions are strict - nothing upstream may render there;
 *  - the DOCUMENT assertions pin an exact allow-list of links that exist
 *    *elsewhere* in the editor (welcome screen, guest banner, encryption
 *    tooltip). Pinning the exact list rather than ignoring it means any NEW
 *    upstream link fails the test, while the known ones stay visible in the
 *    diff and cannot quietly accumulate.
 */

const EDITOR =
  process.env.MOSAIC_E2E_EDITOR_URL ?? "http://localhost:3101/editor/";

/**
 * Opens the hamburger ("Main menu") and waits for it.
 *
 * The trigger renders as `button.dropdown-menu-button.main-menu-trigger` and has
 * neither an aria-label nor a test id, so its class is the stable handle.
 */
const openMenu = async (page: import("@playwright/test").Page) => {
  await page.locator("button.main-menu-trigger").click();
  await expect(page.locator(".dropdown-menu")).toBeVisible({
    timeout: 60_000,
  });
};

/**
 * Links outside the hamburger menu that still point upstream, with the reason
 * each is still there. Anything not listed here must not appear.
 *
 * - the encryption blog link comes from `labels.link` in en.json, which
 *   Part 1's rebrand deliberately left as product copy. It is informational,
 *   not a paid upsell, so it stays.
 * - the welcome screen guest CTA and the guest banner (both Excalidraw+ paid
 *   upsells) were REMOVED in #122 — Mosaic has no paid product or signup flow
 *   to repoint them to. If either ever reappears, this test fails.
 */
const KNOWN_RESIDUAL_UPSTREAM_HREFS = [
  "https://plus.excalidraw.com/blog/end-to-end-encryption",
];

const UPSTREAM_HOSTS = [
  "plus.excalidraw.com",
  "app.excalidraw.com",
  "github.com/excalidraw",
  "x.com/excalidraw",
  "discord.gg",
];

const allHrefs = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[href]")].map(
      (a) => (a as HTMLAnchorElement).getAttribute("href") || "",
    ),
  );

test.beforeEach(async ({ page }) => {
  await page.goto(EDITOR);
  await page.locator("canvas.excalidraw__canvas").first().waitFor({
    state: "attached",
    timeout: 120_000,
  });
});

test("the five upstream items are not rendered in the menu", async ({
  page,
}) => {
  await openMenu(page);

  const text = (await page.locator(".dropdown-menu").innerText()).toLowerCase();
  for (const label of [
    "excalidraw+",
    "github",
    "follow us",
    "discord",
    "sign up",
    "sign in",
  ]) {
    expect(text, `menu should not contain "${label}"`).not.toContain(label);
  }
});

test("the menu has no upstream link in it", async ({ page }) => {
  await openMenu(page);

  const menuHrefs = await page
    .locator(".dropdown-menu")
    .evaluate((el) =>
      [...el.querySelectorAll("[href]")].map(
        (a) => (a as HTMLAnchorElement).getAttribute("href") || "",
      ),
    );

  for (const host of UPSTREAM_HOSTS) {
    expect(
      menuHrefs.filter((h) => h.includes(host)),
      `menu should not link to ${host}`,
    ).toEqual([]);
  }
});

test("the rest of the menu still works", async ({ page }) => {
  await openMenu(page);
  const menu = page.locator(".dropdown-menu");
  // Guards against "the menu is simply empty", which would make the assertions
  // above pass for the wrong reason.
  await expect(menu).toContainText(
    /Open|Preferences|Change canvas background|Editor/i,
  );
});

test("no NEW upstream link appears anywhere in the editor", async ({
  page,
}) => {
  await openMenu(page);

  const upstream = (await allHrefs(page)).filter((h) =>
    UPSTREAM_HOSTS.some((host) => h.includes(host)),
  );
  const unexpected = upstream.filter(
    (h) => !KNOWN_RESIDUAL_UPSTREAM_HREFS.includes(h),
  );

  expect(
    unexpected,
    `unexpected upstream links: ${JSON.stringify(unexpected, null, 2)}`,
  ).toEqual([]);

  // The known residual is asserted exactly, so removing one of them (or adding a
  // fourth) shows up as a failure to be acknowledged rather than drifting.
  expect(upcoming(upstream)).toEqual(upcoming(KNOWN_RESIDUAL_UPSTREAM_HREFS));
});

/** Sorts so the comparison is order-independent. */
function upcoming(list: string[]): string[] {
  return [...list].sort();
}
