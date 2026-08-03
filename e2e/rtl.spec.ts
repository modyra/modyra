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
 * It covers sixteen families across the four packaged themes, which is the surface the demo renders —
 * not all seventeen kinds, and not the overlay placement, which is contract-level and tested in
 * `@modyra/widgets`.
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
const NOT_YET_MIRRORED: Record<string, string> = {};


/**
 * Empty, and measured rather than predicted.
 *
 * Counting physical direction-sensitive declarations does not identify what breaks under `dir=rtl`.
 * Toggle, daterange and segmented all mirror correctly, and segmented carries 18 physical
 * declarations — the largest single family in the sheet.
 *
 * The reason is that flex and grid containers reverse their own main axis under `dir=rtl`, so a
 * `margin-left` on a flex child is re-ordered by the layout whatever it is called. A physical
 * property is only a bug when it positions something *against* the flow — an absolute offset, a
 * translate, a float — and counting declarations finds both kinds equally.
 *
 * `select` is the case that fits the rule: its arrow is *absolutely* positioned, so the flow cannot
 * re-order it the way it re-orders a flex child, and it stays on whichever physical edge was named.
 * `inset-inline-end` rather than `right` is what keeps it mirrored.
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

/**
 * The packaged themes, because geometry being theme-independent is an assumption until measured.
 *
 * A theme can change padding, radii and affix sizes, any of which could reintroduce a physical
 * offset the default theme does not have.
 */
const THEMES = ["modyra.css", "modyra-modern.css", "modyra-material.css", "modyra-ios.css"] as const;

async function useTheme(page: import("@playwright/test").Page, file: string): Promise<void> {
  await page.evaluate(async (href) => {
    const link = document.getElementById("mdy-theme-link") as HTMLLinkElement | null;
    if (!link) throw new Error("the demo has no #mdy-theme-link to swap");
    if (link.getAttribute("href") === `styles/${href}`) return;
    await new Promise<void>((resolve) => {
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => resolve(), { once: true });
      link.setAttribute("href", `styles/${href}`);
    });
  }, file);
  // One frame, so the swapped sheet has been applied before anything is measured.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
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

/**
 * Every family, every packaged theme.
 *
 * One test per theme rather than per family: a theme either mirrors or it does not, and naming the
 * families that failed in one message is more useful than sixty-four green ticks. The per-family
 * tests above stay because they are what a single regression should fail on.
 */
for (const theme of THEMES) {
  test(`every family mirrors under ${theme}`, async ({ page }) => {
    await page.goto("/");
    await useTheme(page, theme);

    const broken: string[] = [];
    for (const { family, widget, part } of MIRROR_CASES) {
      await page.evaluate(() => document.documentElement.setAttribute("dir", "ltr"));
      const ltr = await insets(page, widget, part);
      if (!ltr) continue;   // not in the demo under this theme; the per-family tests report the skip

      await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
      const rtl = await insets(page, widget, part);
      if (!rtl) { broken.push(`${family} (vanished under rtl)`); continue; }

      const mirrored = Math.abs(ltr.fromLeft - rtl.fromRight) <= 1.5;
      const expected = NOT_YET_MIRRORED[family] === undefined;
      if (mirrored !== expected) {
        broken.push(`${family} (${ltr.fromLeft.toFixed(1)} vs ${rtl.fromRight.toFixed(1)})`);
      }
    }

    expect(`${theme}: ${broken.join(", ") || "all mirror"}`).toBe(`${theme}: all mirror`);
  });
}
