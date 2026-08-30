import { expect, test } from "@playwright/test";

/**
 * A floating label sits where the text it stands in for begins.
 *
 * At rest the label covers the control's own placeholder, so it is anchored to the edge the text
 * starts from — and under `dir="rtl"` that edge is the right-hand one. Written as `left` it stayed on
 * the left while the field ran the other way: 10px from the left in both directions, on a control
 * whose text begins 10px from the right.
 *
 * **Nothing on any demo page draws this mode**, in any of the three renderers, so no screenshot and
 * no other spec covers a block of the foundation two adapters publish. The class is the renderer's
 * own mechanism — lit toggles exactly this one from its `floatingLabel` property — so applying it
 * here is the same act, performed by hand because no page performs it.
 */
test("the label is anchored to the inline start, not to the left", async ({ page }) => {
  await page.goto("/");

  const insets = async (dir: "ltr" | "rtl") => {
    await page.evaluate((d) => {
      document.documentElement.setAttribute("dir", d);
      document.querySelector(".mdy-renderer--text")?.classList.add("mdy-floating-label");
    }, dir);
    return page.evaluate(() => {
      const host = document.querySelector(".mdy-renderer--text.mdy-floating-label");
      const label = host?.querySelector(".mdy-label");
      if (!host || !label) return null;
      const a = host.getBoundingClientRect();
      const b = label.getBoundingClientRect();
      return { fromLeft: b.left - a.left, fromRight: a.right - b.right };
    });
  };

  const ltr = await insets("ltr");
  expect(ltr, "no text field on the page took the floating-label class").not.toBeNull();
  // The premise: a label flush against the edge would mirror trivially, and prove nothing.
  expect(ltr!.fromLeft, "the label sits on the edge, so a mirrored one is indistinguishable")
    .toBeGreaterThan(1);

  const rtl = await insets("rtl");
  expect(Math.abs(ltr!.fromLeft - rtl!.fromRight), "the label kept its distance from the left while "
    + "the field ran the other way, so it no longer stands where the control's text begins")
    .toBeLessThanOrEqual(1);
});
