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

/** Every trailing affordance on the page, with the field it belongs to. */
const AFFORDANCES = [
  { kind: "select", selector: ".mdy-renderer--select .mdy-select__arrow" },
  { kind: "datepicker", selector: ".mdy-renderer--datepicker .mdy-datepicker__toggle" },
  { kind: "timepicker", selector: ".mdy-renderer--timepicker .mdy-timepicker__toggle" },
  { kind: "colors", selector: ".mdy-renderer--colors .mdy-colors__toggle-area" },
  { kind: "multiselect", selector: ".mdy-renderer--multiselect .mdy-multiselect__trigger" },
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

test("an interactive affordance meets the 44px target size", async ({ page }) => {
  // WCAG 2.5.5, and measured on the **overlay** rather than the element. The box the affordance
  // occupies in the layout is deliberately smaller than its target: sized to 44px it drove the
  // field's height, and three kinds grew to 46px while the rest stayed at 38.
  //
  // The select caret is exempt: it is `pointer-events: none` and the trigger behind it is the
  // target, which the assertion below holds it to.
  const small = await page.evaluate((list) => {
    const out: string[] = [];
    for (const { kind, selector } of list) {
      if (kind === "select") continue;
      const el = document.querySelector(selector);
      if (!(el instanceof HTMLElement)) continue;
      const after = getComputedStyle(el, "::after");
      const w = parseFloat(after.width);
      const h = parseFloat(after.height);
      if (!(w >= 44 && h >= 44)) out.push(`${kind}: target ${after.width}x${after.height}`);
    }
    return out;
  }, AFFORDANCES);
  expect(small, "interactive affordances whose pointer target is below 44px").toEqual([]);
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
