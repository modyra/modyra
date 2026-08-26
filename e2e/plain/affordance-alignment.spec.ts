import { expect, test } from "@playwright/test";

/**
 * The icons and carets at a field's trailing edge line up down a form.
 *
 * This is a property of a *page*, not of a widget, which is why no per-widget test caught it: each
 * affordance is defensible alone, and only a column of them shows that a 16px caret, a 24px search
 * button, a 32px toggle and a 44px swatch do not share a centre.
 *
 * Measured, because "looks aligned" is not a check. Two numbers per affordance:
 *
 *   - how far its centre sits from its field's inline end;
 *   - where its centre sits down its field's height, as a fraction.
 *
 * Both must agree across every kind that has one.
 */

/**
 * Every trailing affordance on the page, with the field it belongs to.
 *
 * **A trailing affordance is a small control at the field's inline end, not whatever opens the
 * field.** This list named the multiselect's trigger, which was a small button until the strip and
 * the opener became siblings and the trigger took the row's free width. Measured then, its centre sat
 * 316px from the field's end against 19px everywhere else — a true reading of a control that is not
 * an affordance, reported as a misalignment.
 *
 * **Two of the five are decorations, and they are still the thing to measure here.** A caret is not a
 * target — the control behind it is — but it is what sits at the field's inline end, and the column
 * this page is about is a column of what the eye follows. `decorative` marks them so the target-size
 * test below can exempt exactly those two and no others: the same fact, asked two different
 * questions.
 *
 * The multiselect's edge is its caret for the same reason the single-choice sibling's is. Behind it
 * stand the commands — the clear-all and the way back — one slot further in, which is where the
 * decision that put them there means them to be.
 */
const AFFORDANCES = [
  { kind: "select", selector: ".mdy-renderer--select .mdy-select__arrow", decorative: true },
  { kind: "datepicker", selector: ".mdy-renderer--datepicker .mdy-datepicker__toggle", decorative: false },
  { kind: "timepicker", selector: ".mdy-renderer--timepicker .mdy-timepicker__toggle", decorative: false },
  { kind: "colors", selector: ".mdy-renderer--colors .mdy-colors__toggle-area", decorative: false },
  { kind: "multiselect", selector: ".mdy-renderer--multiselect .mdy-multiselect__arrow", decorative: true },
];

interface Placement {
  kind: string;
  /** Distance from the affordance's centre to the field's inline end. */
  insetFromEnd: number;
  /** Where the centre sits down the field, 0 = top, 1 = bottom. */
  verticalFraction: number;
  box: string;
}

async function placements(page: import("@playwright/test").Page): Promise<Placement[]> {
  return page.evaluate((list) => {
    const out: Placement[] = [];
    for (const { kind, selector } of list) {
      const el = document.querySelector(selector);
      const field = el?.closest(".mdy-renderer");
      const wrapper = field?.querySelector(".mdy-input-wrapper") ?? field;
      if (!(el instanceof HTMLElement) || !(wrapper instanceof HTMLElement)) continue;
      const a = el.getBoundingClientRect();
      const w = wrapper.getBoundingClientRect();
      if (a.width === 0 || w.width === 0) continue;
      out.push({
        kind,
        insetFromEnd: Math.round((w.right - (a.left + a.width / 2)) * 10) / 10,
        verticalFraction: Math.round(((a.top + a.height / 2 - w.top) / w.height) * 100) / 100,
        box: `${Math.round(a.width)}x${Math.round(a.height)}`,
      });
    }
    return out;
  }, AFFORDANCES);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".mdy-renderer--select").first()).toBeVisible();
});

test("every trailing affordance shares one inset and one vertical centre", async ({ page }) => {
  const found = await placements(page);
  console.log("PLACEMENTS:", JSON.stringify(found, null, 1));
  expect(found.length, "the demo must render several affordances to compare").toBeGreaterThan(2);

  const insets = [...new Set(found.map((p) => p.insetFromEnd))];
  const verticals = [...new Set(found.map((p) => p.verticalFraction))];

  // One inset, one vertical centre. Sub-pixel differences are tolerated by the rounding above.
  expect(insets, `insets differ: ${JSON.stringify(found)}`).toHaveLength(1);
  expect(verticals, `vertical centres differ: ${JSON.stringify(found)}`).toHaveLength(1);
});

test("an interactive affordance is at least the target size this project ships", async ({ page }) => {
  // **24px, not 44, and the difference is a decision this project recorded rather than an oversight.**
  // The foundation states it beside the token: *"the steppers take WCAG 2.5.8's 24px instead, which is
  // the AA requirement and the level this project ships against; 2.5.5's 44px is AAA."* Two controls
  // stacked in one field cannot both be 44 — the field is 3.5rem and two targets would need 5.5.
  //
  // So 44 is delivered by an **overlay** wherever it costs no layout, which is what the target token
  // is for, and the floor every affordance must clear is the one the project ships against. An earlier
  // version of this test asserted 44 on everything, which held the library to a level it had not
  // chosen — and then failed on a trigger that is a control spanning its row rather than a small
  // affordance, where a 44px target is a request for a 44px row. That is the row-system decision, and
  // it is not this test's to take.
  //
  // The target is the larger of the element and its overlay: an affordance big enough on its own needs
  // no overlay, and one that is not is measured on what the overlay gives it.
  //
  // The carets are exempt: they are `pointer-events: none` and the control behind them is the target.
  const small = await page.evaluate((list) => {
    const out: string[] = [];
    for (const { kind, selector, decorative } of list) {
      if (decorative) continue;
      const el = document.querySelector(selector);
      if (!(el instanceof HTMLElement)) continue;
      const own = el.getBoundingClientRect();
      const overlay = getComputedStyle(el, "::after");
      const width = Math.max(own.width, parseFloat(overlay.width) || 0);
      const height = Math.max(own.height, parseFloat(overlay.height) || 0);
      if (!(width >= 24 && height >= 24)) {
        out.push(`${kind}: ${Math.round(width)}x${Math.round(height)}`);
      }
    }
    return out;
  }, AFFORDANCES);
  expect(small, "interactive affordances whose pointer target is below the 24px AA floor").toEqual([]);
});

test("the layout box stays small enough not to grow the field", async ({ page }) => {
  // The regression this pins: every field is one height, whether or not it carries an affordance.
  const heights = await page.evaluate(() => {
    const seen = new Set<number>();
    for (const kind of ["text", "select", "multiselect", "datepicker", "timepicker", "colors", "number"]) {
      const w = document.querySelector(`.mdy-renderer--${kind} .mdy-input-wrapper`);
      if (w instanceof HTMLElement) seen.add(Math.round(w.getBoundingClientRect().height));
    }
    return [...seen];
  });
  expect(heights, "fields must share one height").toHaveLength(1);
});

test("the select caret takes no pointer, so the trigger is the target", async ({ page }) => {
  const events = await page.evaluate(() => {
    const el = document.querySelector(".mdy-renderer--select .mdy-select__arrow");
    return el instanceof HTMLElement ? getComputedStyle(el).pointerEvents : null;
  });
  expect(events).toBe("none");
});
