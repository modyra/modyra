import { expect, test } from "@playwright/test";

/**
 * The select, driven by real keys in a real browser.
 *
 * Milestone D's whole point: `role="listbox"` in the DOM says nothing about whether the arrow keys
 * move through it. This is the half jsdom cannot answer — focus, native key defaults, and what the
 * browser does with Tab are not simulable, and asserting them there produces a green that means
 * nothing.
 *
 * The policy is `selectKeyboardAction` in `@modyra/widgets`, asserted as a pure function in that
 * package's own suite. What is asserted here is that pressing the key actually does it.
 *
 * Every assertion below auto-retries. A key press and the frame that renders its result are two
 * different moments, and reading the DOM in between reports the state before the key — which looks
 * exactly like a widget that ignored it.
 */

const SELECT = ".mdy-renderer--select";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

/** `aria-expanded` on the opener is the contract's own statement of open-ness. */
const expectOpen = (page: import("@playwright/test").Page, open: boolean) =>
  expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", String(open));

/** Which part of the widget holds focus, or `null` when focus has left it entirely. */
const focusedPart = (page: import("@playwright/test").Page) =>
  page.evaluate((sel) => {
    const active = document.activeElement;
    if (!active || !active.closest(sel)) return null;
    return (active.className as string).split(" ").find((c) => c.startsWith("mdy-")) ?? "unknown";
  }, SELECT);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(TRIGGER).first()).toBeVisible();
  await page.locator(TRIGGER).first().focus();
});

test("ArrowDown opens a closed list", async ({ page }) => {
  await expectOpen(page, false);
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);
});

test("ArrowUp does not open a closed list", async ({ page }) => {
  // The asymmetry is deliberate: down reaches for the list, up has nothing above the trigger.
  await page.keyboard.press("ArrowUp");
  await expectOpen(page, false);
});

test("Enter opens a closed list, and Escape closes it again", async ({ page }) => {
  await page.keyboard.press("Enter");
  await expectOpen(page, true);
  await page.keyboard.press("Escape");
  await expectOpen(page, false);
});

test("opening from the keyboard puts focus where the user will type", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);
  // A searchable list that opens without focus asks for a second gesture before a keystroke does
  // anything, and gives a keyboard user no way in at all.
  await expect.poll(() => focusedPart(page)).not.toBeNull();
});

test("Escape closes and leaves focus inside the widget", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);

  await page.keyboard.press("Escape");
  await expectOpen(page, false);

  // The half only a browser can answer: where focus actually ended up. Landing on the document body
  // strands the user at the top of the page with no way back to the field they were in.
  await expect.poll(() => focusedPart(page), {
    message: "Escape must not leave the user on the document body",
  }).not.toBeNull();
});

test("Tab closes the list and lets focus carry on", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);

  await page.keyboard.press("Tab");
  await expectOpen(page, false);

  // Tab keeps its native meaning. A list left open follows the user to the next field, and focus
  // pulled back to the control they just left traps them in it.
  await expect.poll(() => focusedPart(page), {
    message: "Tab must not restore focus to the field being left",
  }).toBeNull();
});
