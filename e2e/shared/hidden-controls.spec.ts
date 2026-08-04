import { expect, test } from "@playwright/test";

/**
 * A visually hidden native control carries state and focus, never paint.
 *
 * Several widgets keep a real `<input>` for the platform — the accessibility tree, the tab order,
 * the form post, the keyboard model — and let a sibling element draw the appearance. The input is
 * moved off the screen and clipped to a single pixel rather than removed, because `display: none`
 * would take all four of those away with it.
 *
 * Nothing about such a control is visible, so nothing should paint it. The field rules match any
 * input inside a renderer, and painting one anyway is invisible by construction: a background on a
 * clipped pixel produces the same screenshot whether it is right or wrong. That is what makes this
 * a browser test rather than a style audit — the failure it guards against is not a wrong colour,
 * it is a focused control that ends the page, and it is engine-specific.
 *
 * The values involved resolve through several layers of custom properties, so what is finally
 * painted is not what any one declaration says. Reading the stylesheet cannot answer whether this
 * holds; focusing the control in each engine can.
 */

/**
 * Every widget that hides its native control, with the sibling that draws it. Absent widgets are
 * skipped rather than failed — a page that renders a subset is a legitimate page — but a run in
 * which *nothing* matched would pass while asserting nothing, so the count is checked at the end.
 */
const HIDDEN_CONTROLS = [
  { name: "checkbox", control: ".mdy-checkbox input[type=checkbox]" },
  { name: "radio", control: ".mdy-radio-item input[type=radio]" },
  { name: "toggle", control: ".mdy-toggle input[type=checkbox]" },
  { name: "segmented", control: ".mdy-segmented__control, .mdy-segmented__button input[type=radio]" },
  { name: "file", control: ".mdy-file-input" },
] as const;

/** Painted at all: a colour with any alpha, or a shadow. `none`/transparent is what is expected. */
const paintOf = (page: import("@playwright/test").Page, selector: string) =>
  page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, shadow: style.boxShadow };
  }, selector);

const isUnpainted = (paint: { background: string; shadow: string }) =>
  (paint.shadow === "none" || paint.shadow === "") &&
  /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|^transparent$/.test(paint.background);

test.describe("visually hidden native controls", () => {
  test("stay unpainted while focused, and focusing them does not end the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".mdy-renderer").first()).toBeAttached();

    let asserted = 0;

    for (const { name, control } of HIDDEN_CONTROLS) {
      const locator = page.locator(control).first();
      if ((await locator.count()) === 0) continue;

      // Clipped to a pixel: the premise of the rule. A control that grew a visible size is not
      // covered by it, and asserting the rest against such a control would be asserting nothing.
      const box = await locator.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      expect(box.width, `${name}: control is not clipped`).toBeLessThanOrEqual(2);
      expect(box.height, `${name}: control is not clipped`).toBeLessThanOrEqual(2);

      await locator.evaluate((el: HTMLElement) => el.focus());

      // Read *after* focus, and read the page afterwards. An engine that cannot paint what the
      // focused state asks for terminates here rather than reporting a wrong value, so the
      // subsequent read is as much of the assertion as the comparison is.
      const paint = await paintOf(page, control);
      expect(paint, `${name}: control vanished while focused`).not.toBeNull();
      expect(isUnpainted(paint!), `${name}: focused hidden control is painted ${JSON.stringify(paint)}`).toBe(true);

      expect(await page.evaluate(() => document.readyState), `${name}: the page ended`).toBeTruthy();
      asserted += 1;
    }

    // A selector that stops matching is the failure mode this test cannot otherwise see: every
    // widget skipped, nothing compared, green.
    expect(asserted, "no hidden control matched — the selectors are stale").toBeGreaterThan(0);
  });
});
