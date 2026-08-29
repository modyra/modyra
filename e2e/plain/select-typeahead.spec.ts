import { expect, test } from "@playwright/test";

/**
 * Typing reaches the list, driven as a user drives it.
 *
 * **This file used to test a shape that no longer exists.** It drove an incremental-search buffer at
 * the trigger of a combobox with no filter box — the model a select had when `searchable` was unset.
 * ADR 0176 gives that configuration to the platform's own chooser, which brings its own typeahead,
 * so there is no longer a control in this renderer where a buffer at the trigger is the answer. The
 * buffer itself is still unit-tested; what has no shape left is a page that drives it.
 *
 * What a filtering select does with typing is a different act and is what this asserts now: the
 * keystrokes go into the field at the top of the popup, and the list narrows to what matches.
 * Typing over the trigger's own text would hide the committed value while somebody looks for
 * another one, which is why the filter box exists rather than the trigger accepting text.
 */
const TRIGGER = ".mdy-renderer--select .mdy-select__trigger";
const OPTION = ".mdy-select__list .mdy-select__option:not([hidden])";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator(TRIGGER).first();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("a select that filters has a field to filter in, and the keyboard is in it", async ({ page }) => {
  const search = page.locator(".mdy-select__search");
  await expect(search).toHaveCount(1);
  // Where the typing goes has to be where the keyboard already is, or the first keystroke is lost
  // to whatever had focus instead.
  await expect(search).toBeFocused();
});

test("typing narrows the list rather than moving through it", async ({ page }) => {
  const before = await page.locator(OPTION).count();
  expect(before).toBeGreaterThan(1);

  // Two characters, not one: a single letter is what a broken filter could already match, so it
  // would pass against the defect this guards.
  await page.keyboard.press("f");
  await page.keyboard.press("r");

  await expect.poll(() => page.locator(OPTION).count(), { message: 'typing "fr" must narrow the list' })
    .toBeLessThan(before);
  await expect(page.locator(OPTION).first()).toHaveText(/France/);
});

test("a second character narrows further rather than starting again", async ({ page }) => {
  await page.keyboard.press("g");
  const afterOne = await page.locator(OPTION).count();
  await page.keyboard.press("e");

  await expect.poll(() => page.locator(OPTION).count(), { message: '"ge" must not read as "e"' })
    .toBeLessThanOrEqual(afterOne);
  await expect(page.locator(OPTION).first()).toHaveText(/Germany/);
});
