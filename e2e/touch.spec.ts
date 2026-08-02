import { expect, test } from "@playwright/test";

/**
 * The overlays, driven by a finger rather than a mouse.
 *
 * `dismissOnOutsidePointer` is a declared capability of every overlay kind in the widget contract,
 * and the contract does not say which pointer event delivers it. The renderers do not agree:
 * `@modyra/plain` and `@modyra/lit` listen on `pointerdown`, this adapter on `click`. Both are
 * conformant to the words; whether they behave the same to a touch user is a question only a real
 * browser with a real touch context can answer, which is why it is asked here.
 *
 * A tap is not a mouse click with a different name: it produces no `mousemove`, no hover, and its
 * `click` is synthesised only when the press and release land close enough together on the same
 * target. A dismissal bound to the wrong event leaves a popup a touch user cannot close.
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

test("a tap opens the list", async ({ page }) => {
  await expectOpen(page, false);
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);
});

test("a tap outside dismisses it", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // The page heading, which is outside every widget and takes no pointer behaviour of its own.
  await page.locator("h1").first().tap();
  await expectOpen(page, false);
});

test("a drag that starts outside does not dismiss, because no click completes", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // The same gesture the framework-free renderer is measured against in `e2e/plain/dismiss.spec.ts`:
  // press outside, move away, never complete a click on that target. This adapter dismisses on
  // `click`, so it does not act — and the two renderers observably differ on a gesture a touch user
  // makes to scroll the page.
  //
  // Pinned rather than fixed. Which of the two is right is a product decision: dismissing on press
  // is more responsive and closes on an accidental brush, dismissing on click keeps the popup
  // through a scroll and needs a second gesture to close.
  const heading = await page.locator("h1").first().boundingBox();
  expect(heading).not.toBeNull();
  if (!heading) return;

  await page.mouse.move(heading.x + 5, heading.y + 5);
  await page.mouse.down();
  await page.mouse.move(heading.x + 5, heading.y + 240, { steps: 8 });
  await expectOpen(page, true);
  await page.mouse.up();
});

test("a tap picks an option and closes the list", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  const option = page.locator(`${SELECT} .mdy-select__option`).first();
  await expect(option).toBeVisible();
  const chosen = (await option.textContent())?.trim() ?? "";
  await option.tap();

  await expectOpen(page, false);
  // Opening is worthless if the tap did not also commit: a list that closes without choosing looks
  // identical to one that chose, from `aria-expanded` alone.
  await expect(page.locator(`${SELECT} .mdy-select__value`).first()).toHaveText(chosen);
});
