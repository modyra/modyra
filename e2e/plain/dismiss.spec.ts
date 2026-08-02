import { expect, test } from "@playwright/test";

/**
 * Which pointer gesture dismisses an overlay, measured on the framework-free renderer.
 *
 * `dismissOnOutsidePointer` is declared for every overlay kind and the contract does not say which
 * event delivers it. The renderers do not agree: this one and the custom-element renderer listen on
 * `pointerdown`, the Angular one on `click`. Both dismiss a plain tap, so the difference was
 * recorded as timing rather than function — but `pointerdown` fires on press and `click` only on a
 * completed press-and-release over the same target, and those come apart in two ordinary gestures:
 *
 *   - a drag that begins outside the popup and ends elsewhere fires no `click` at all;
 *   - a press outside that returns inside before releasing fires its `click` on the popup.
 *
 * A touch user scrolling the page starts exactly the first of those. This file settles what this
 * renderer actually does, which needed a browser for the other renderer's demo and now has one.
 */

test.use({ hasTouch: true });

const SELECT = ".mdy-renderer--select";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

const expectOpen = (page: import("@playwright/test").Page, open: boolean) =>
  expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", String(open));

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(TRIGGER).first()).toBeVisible();
});

test("a tap outside dismisses the list", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  await page.locator("h1").first().tap();
  await expectOpen(page, false);
});

test("a drag that starts outside dismisses on press, before any click", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // Press outside and move away without releasing over the same target: the gesture a touch user
  // makes to scroll. No `click` is produced by it.
  const heading = await page.locator("h1").first().boundingBox();
  expect(heading).not.toBeNull();
  if (!heading) return;

  await page.mouse.move(heading.x + 5, heading.y + 5);
  await page.mouse.down();
  await page.mouse.move(heading.x + 5, heading.y + 240, { steps: 8 });

  // Asserted before the release, which is the whole point: this renderer acts on the press.
  await expectOpen(page, false);
  await page.mouse.up();
});
