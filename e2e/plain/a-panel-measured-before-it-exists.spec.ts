import { expect, test } from "@playwright/test";

/**
 * A panel is placed against the panel a person will see, not against the empty box it starts as.
 *
 * The calendar is positioned in the same pass that fills it, and the order decides the answer:
 * measured before its cells exist it is 54px against a content height of 276, so the policy is
 * asked whether a box a fifth of the real size fits under the field. It does — and the panel is then
 * drawn at full height, clipped, in a viewport where the policy answers "above" on the same rect.
 *
 * The wrong number does not correct itself either: the measurement is held for the whole opening, so
 * nothing later in the panel's life re-asks. That is why this is asserted in a browser rather than
 * against the policy — the policy was always right, and reading it would have agreed with itself.
 *
 * The viewport is what forces the decision. A field near the top of a tall window has room under it
 * whichever way the panel is measured, so a run at one height cannot tell the two apart.
 */
/**
 * Scoped by the renderer, not by the part's own class.
 *
 * A daterange's toggle wears `mdy-datepicker__toggle` — the two kinds share the part — so a selector
 * on the class alone finds the datepicker twice and the second case skips itself while reporting a
 * pass. The root says which kind it belongs to.
 */
const KINDS = [
  { name: "datepicker", opener: ".mdy-renderer--datepicker .mdy-datepicker__toggle" },
  { name: "daterange", opener: ".mdy-renderer--daterange .mdy-datepicker__toggle" },
];

for (const { name, opener } of KINDS) {
  test(`${name}: a panel with no room below it opens above, whole`, async ({ page }) => {
    for (const height of [520, 460]) {
      await page.setViewportSize({ width: 1280, height });
      await page.goto("/");
      const toggle = page.locator(opener).first();
      expect(await toggle.count(), `${name} is not on the demo page, so this is measuring nothing`).toBeGreaterThan(0);
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();

      const panel = page.locator(".mdy-overlay:not([hidden])").first();
      await expect(panel).toBeVisible();
      const anchor = await toggle.boundingBox();
      const box = await panel.boundingBox();
      const roomBelow = height - (anchor?.y ?? 0) - (anchor?.height ?? 0);

      // The premise: without this the run says nothing, because a panel that fits below belongs
      // below and both orders of the pass agree about it.
      expect(roomBelow, `at ${height}px there is room below, so nothing here is being decided`)
        .toBeLessThan(box?.height ?? 0);

      // Not "above" — that is one of two right answers. Where neither side has room the policy
      // centres the panel over the page, which is a placement of its own and is what a range picker
      // gets on a short window. What both answers have in common, and what going below does not, is
      // that the panel is somewhere a person can see all of it.
      expect(await panel.getAttribute("data-placement"),
        `at ${height}px the panel went under a field with ${roomBelow.toFixed(0)}px beneath it`)
        .not.toBe("below");
      expect((box?.y ?? 0) + (box?.height ?? 0),
        "the panel runs off the bottom of the window").toBeLessThanOrEqual(height);
    }
  });
}
