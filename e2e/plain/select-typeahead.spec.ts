import { expect, test } from "@playwright/test";

/**
 * Typing reaches the list, driven as a user drives it.
 *
 * The buffer is unit-tested, and that proves the algorithm rather than that a renderer feeds it —
 * which is the distinction this change exists to fix. Three adapters implementing one behaviour
 * produced three behaviours, and the one that diverged was the one nothing drove.
 *
 * Written against the demo's actual list rather than around it. A conditional skip here would be a
 * test that reports success having asserted nothing, which is the failure the rule is about.
 */
const TRIGGER = ".mdy-renderer--select .mdy-select__trigger";

/** What the trigger says is active — the reading position, which is what a listbox moves. */
const activeLabel = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const id = document.querySelector(".mdy-renderer--select .mdy-select__trigger")
      ?.getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.textContent?.trim() ?? null : null;
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator(TRIGGER).first();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("a listbox has no filter box, and typing moves the reading position", async ({ page }) => {
  // The model the contract now names: `searchable` is unset, so this select is a listbox.
  await expect(page.locator(".mdy-select__search")).toHaveCount(0);

  // `fr` rather than `f`: one character is what the broken implementation could already match, so a
  // single key would pass against the defect this replaces.
  await page.keyboard.press("f");
  await page.keyboard.press("r");

  await expect.poll(() => activeLabel(page), { message: 'typing "fr" must reach France' }).toBe("France");
});

test("a second character narrows rather than replaces", async ({ page }) => {
  // Germany and France both exist; `g` then `e` must stay on Germany rather than jump to whatever
  // `e` alone would match. This is the assertion the replace-not-accumulate bug fails.
  await page.keyboard.press("g");
  await expect.poll(() => activeLabel(page)).toBe("Germany");
  await page.keyboard.press("e");
  await expect.poll(() => activeLabel(page), { message: '"ge" must still be Germany' }).toBe("Germany");
});

test("the buffer expires, so a pause starts a new word", async ({ page }) => {
  await page.keyboard.press("g");
  await expect.poll(() => activeLabel(page)).toBe("Germany");

  // Past the idle interval. Without it the buffer reads "gi", which matches nothing, and the active
  // option would stay on Germany — passing for the wrong reason.
  await page.waitForTimeout(1200);
  await page.keyboard.press("i");

  await expect.poll(() => activeLabel(page), { message: "the second query must not inherit the first" }).toBe("Italy");
});
