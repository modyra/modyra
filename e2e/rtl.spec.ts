import { expect, test } from "@playwright/test";

/**
 * The RTL fixture: what a control looks like in both directions, measured rather than eyeballed.
 *
 * This is deliberately an **instrument, not a gate**. Nothing measured RTL before it — no fixture, no
 * test, no demo toggle — so there was no way to tell a correct control from a broken one, and no way
 * to know whether a fix had worked. The first deliverable is therefore the measurement, and the
 * ledger below records what it currently reads.
 *
 * ## What "correct" means here
 *
 * Under `dir="rtl"` a control should **mirror**: what sat at the inline start stays at the inline
 * start, which is now the right-hand edge. So for a widget of width W, an element whose left offset
 * from the widget was `x` in LTR should have a *right* offset of `x` in RTL. Anything that keeps the
 * same left offset has been positioned physically and does not mirror.
 *
 * A tolerance of 1.5px absorbs sub-pixel layout; nothing here is chasing a rounding difference.
 *
 * ## What it does not do
 *
 * It covers six families, not seventeen kinds, and two of those six have no part in the demo to
 * measure. It is the instrument the rest of this task is built on, not a claim that RTL works.
 */

/** Families in the order §10 lists them, cheapest first, with the part whose position carries it. */
const MIRROR_CASES = [
  { family: "toggle", widget: ".mdy-renderer--toggle", part: ".mdy-toggle__thumb" },
  { family: "select", widget: ".mdy-renderer--select", part: ".mdy-select__arrow" },
  { family: "prefix", widget: ".mdy-renderer--text", part: ".mdy-input-prefix" },
  { family: "suffix", widget: ".mdy-renderer--text", part: ".mdy-input-suffix" },
  { family: "daterange", widget: ".mdy-renderer--daterange", part: ".mdy-daterange__sep" },
  { family: "segmented", widget: ".mdy-renderer--segmented", part: ".mdy-segmented__button" },
] as const;

/**
 * Families whose mirroring is known to be absent, with the physical declarations behind each.
 *
 * Asserted in both directions like every other ledger in this repo: an entry that starts mirroring
 * must be removed, so a fix cannot land silently and a regression cannot hide behind a stale note.
 */
const NOT_YET_MIRRORED: Record<string, string> = {
  select: "the arrow keeps its left offset — 4 physical declarations on the trigger and arrow",
};

/**
 * Measured, and it corrected the guess this ledger was first written from.
 *
 * The entries were predicted from the static count: 73 physical direction-sensitive declarations
 * against 22 logical ones, so the families carrying the most physical CSS were expected to be the
 * broken ones. **Toggle, daterange and segmented all mirror correctly** — and segmented carries 18
 * physical declarations, the largest single family in the sheet.
 *
 * The reason is that flex and grid containers reverse their own main axis under `dir=rtl`, so a
 * `margin-left` on a flex child is re-ordered by the layout whatever it is called. A physical
 * property is only a bug when it positions something *against* the flow — an absolute offset, a
 * translate, a float. Counting declarations finds the first kind and the second equally.
 *
 * So the plan's §10 batching order, which was drawn from that same reasoning, is not the order the
 * work is actually in. `select` is the one measured failure here.
 */

/** Offset of `part` from `widget`, measured from both inline edges. */
async function insets(page: import("@playwright/test").Page, widget: string, part: string) {
  return page.evaluate(
    ([w, p]) => {
      const host = document.querySelector(w);
      const el = host?.querySelector(p);
      if (!host || !el) return null;
      const a = host.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      return { fromLeft: b.left - a.left, fromRight: a.right - b.right };
    },
    [widget, part] as const,
  );
}

test.describe("RTL", () => {
  test("the fixture can drive the document in both directions", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".mdy-renderer--text").first()).toBeVisible();

    await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");

    // Without this the measurements below would compare a page to itself and pass on everything.
    const flipped = await page.evaluate(
      () => getComputedStyle(document.querySelector(".mdy-renderer--text")!).direction,
    );
    expect(flipped, "the widgets must inherit the document direction").toBe("rtl");
  });

  for (const { family, widget, part } of MIRROR_CASES) {
    test(`${family} mirrors under dir=rtl`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.documentElement.setAttribute("dir", "ltr"));
      const ltr = await insets(page, widget, part);
      test.skip(ltr === null, `${family}: ${part} is not in the demo, nothing to measure`);

      await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
      const rtl = await insets(page, widget, part);
      expect(rtl, `${family}: ${part} vanished under rtl`).not.toBeNull();

      // Mirrored means the inline-start inset is preserved: left in LTR becomes right in RTL.
      const mirrored = Math.abs(ltr!.fromLeft - rtl!.fromRight) <= 1.5;
      const expected = NOT_YET_MIRRORED[family] === undefined;

      expect(
        `${family} mirrors: ${mirrored}`,
        expected
          ? `${family} stopped mirroring`
          : `${family} now mirrors — remove its entry from NOT_YET_MIRRORED (${NOT_YET_MIRRORED[family]})`,
      ).toBe(`${family} mirrors: ${expected}`);
    });
  }
});
