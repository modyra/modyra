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

/**
 * Families in the order §10 lists them, cheapest first, with the part whose position carries it.
 *
 * `widget` documents which kind each part belongs to; the measurement finds the part itself and uses
 * its own enclosing renderer, so a part living on a control other than the first of its kind is
 * still measured.
 */
const MIRROR_CASES = [
  { family: "toggle", widget: ".mdy-renderer--toggle", part: ".mdy-toggle__thumb" },
  { family: "select", widget: ".mdy-renderer--select", part: ".mdy-select__arrow" },
  { family: "prefix", widget: ".mdy-renderer--text", part: ".mdy-input-prefix" },
  { family: "suffix", widget: ".mdy-renderer--text", part: ".mdy-input-suffix" },
  { family: "daterange", widget: ".mdy-renderer--daterange", part: ".mdy-daterange__sep" },
  { family: "segmented", widget: ".mdy-renderer--segmented", part: ".mdy-segmented__button" },
  { family: "datepicker", widget: ".mdy-renderer--datepicker", part: ".mdy-datepicker__toggle" },
  { family: "timepicker", widget: ".mdy-renderer--timepicker", part: ".mdy-timepicker__toggle" },
  { family: "colors", widget: ".mdy-renderer--colors", part: ".mdy-colors__toggle-area" },
  { family: "multiselect", widget: ".mdy-renderer--multiselect", part: ".mdy-multiselect__search-btn" },
  { family: "checkbox", widget: ".mdy-renderer--checkbox", part: ".mdy-checkbox__indicator" },
  { family: "radio", widget: ".mdy-renderer--radio-group", part: ".mdy-radio-circle" },
  { family: "slider", widget: ".mdy-renderer--slider", part: ".mdy-slider-value" },
  { family: "file", widget: ".mdy-renderer--file", part: ".mdy-file-container" },
  { family: "label", widget: ".mdy-renderer--text", part: ".mdy-label" },
  { family: "errors", widget: ".mdy-renderer--text", part: ".mdy-control__errors" },
] as const;

/**
 * Families whose mirroring is known to be absent, with the physical declarations behind each.
 *
 * Asserted in both directions like every other ledger in this repo: an entry that starts mirroring
 * must be removed, so a fix cannot land silently and a regression cannot hide behind a stale note.
 */
const NOT_YET_MIRRORED: Record<string, string> = {
  // Measured: the toggle sits 189px from the inline start in LTR and 181px from it in RTL — 8px
  // further in. Its own padding, margin and corner radii are logical and do flip (4/12 becomes
  // 12/4), so the remaining 8px belongs to something beside it inside the field, not to the button.
  // Recorded rather than chased: the fixture has located it to within a single widget, which is
  // what a batch needs to start from.
  colors: "the toggle lands 8px inside where it should — a second physical rule in the colour field",
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
 * work is actually in.
 *
 * `select` was the one measured failure, and it fits the rule exactly: its arrow is *absolutely*
 * positioned, so the flow cannot re-order it the way it re-orders a flex child — it stays on
 * whichever physical edge was named. `right: 0.75rem` became `inset-inline-end`, and the ledger is
 * empty for the six families measured here.
 */

/**
 * Offset of `part` from its widget, measured from both inline edges.
 *
 * It takes the first widget **of that kind which actually contains the part**, and both simpler
 * rules were wrong in ways that hid themselves:
 *
 * - *First widget of the kind* skipped `prefix` and `suffix` entirely, because the demo carries them
 *   on a text field that is not the first one. A skip reads exactly like "nothing to measure".
 * - *First part anywhere on the page* measured the colour picker, whose markup includes both a
 *   `.mdy-select__arrow` and a `.mdy-input-suffix`. That one is worse: it reported confidently about
 *   the wrong widget.
 */
async function insets(page: import("@playwright/test").Page, widget: string, part: string) {
  return page.evaluate(
    ([w, p]) => {
      const host = [...document.querySelectorAll(w)].find((el) => el.querySelector(p));
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
      test.skip(ltr === null, `${family}: no ${widget} in the demo carries ${part}`);

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
