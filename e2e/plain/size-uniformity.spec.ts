import { expect, test } from "@playwright/test";

/**
 * A field is one height, and a chip is one height.
 *
 * These are properties of a *page*, not of a widget. Every control was defensible alone, and only a
 * column of them showed the steps: sliders 36, most fields 38, segmented 42, multiselect 54. Each
 * came from a different cause — a control with its own height token, a track too short to fill its
 * row, a pointer target sized into the layout, a chip whose box-sizing made one token mean two
 * numbers.
 *
 * Asserted as numbers because "looks even" is not a check, and because every one of those causes
 * looked reasonable in the rule that carried it.
 */

/** Kinds whose height is legitimately their content's, not the field's. */
const GROWS = new Set([
  // Multi-line by definition.
  "textarea",
  // A stack of options, as tall as it has options.
  "radio-group",
]);

/** Kinds that render no input wrapper at all — a checkbox is its own control, not a filled box. */
const NO_WRAPPER = new Set(["checkbox", "toggle", "file"]);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".mdy-renderer--select").first()).toBeVisible();
});

test("every field that is a single row is the same height", async ({ page }) => {
  const measured = await page.evaluate(({ grows, noWrapper }) => {
    const rows: { kind: string; height: number }[] = [];
    for (const renderer of document.querySelectorAll(".mdy-renderer")) {
      const kind = [...renderer.classList]
        .find((c) => c.startsWith("mdy-renderer--"))?.replace("mdy-renderer--", "") ?? "";
      if (grows.includes(kind) || noWrapper.includes(kind)) continue;
      const wrapper = renderer.querySelector(".mdy-input-wrapper");
      if (!(wrapper instanceof HTMLElement)) continue;
      const height = Math.round(wrapper.getBoundingClientRect().height);
      if (height > 0) rows.push({ kind, height });
    }
    return rows;
  }, { grows: [...GROWS], noWrapper: [...NO_WRAPPER] });

  expect(measured.length, "the demo must render several single-row fields").toBeGreaterThan(5);
  const heights = [...new Set(measured.map((r) => r.height))];
  expect(heights, `heights differ: ${JSON.stringify(measured)}`).toHaveLength(1);
});

test("a chip is one height, whichever mode it is in", async ({ page }) => {
  // Toggle mode reserves width for a tick; counter mode carries two steppers instead. They are the
  // same chip, and `--mdy-chip-height` has to mean the same number in both.
  const heights = await page.evaluate(() => {
    const seen = new Set<number>();
    for (const chip of document.querySelectorAll(".mdy-chip")) {
      if (!(chip instanceof HTMLElement)) continue;
      const h = Math.round(chip.getBoundingClientRect().height);
      // A chip inside a closed popup has no box; only what is on screen is being compared.
      if (h > 0 && !chip.classList.contains("mdy-chip--value")) seen.add(h);
    }
    return [...seen];
  });
  expect(heights.length, `chip heights: ${heights.join(", ")}`).toBe(1);
});

test("the fields that grow, grow for a reason", async ({ page }) => {
  // The exceptions are asserted too, so "taller" cannot quietly spread to a kind that has no claim
  // to it. A textarea and a radio group are content-sized; everything else is a row.
  const taller = await page.evaluate(({ grows }) => {
    const out: string[] = [];
    for (const kind of grows) {
      const wrapper = document.querySelector(`.mdy-renderer--${kind} .mdy-input-wrapper`);
      if (wrapper instanceof HTMLElement) {
        out.push(`${kind}:${Math.round(wrapper.getBoundingClientRect().height)}`);
      }
    }
    return out;
  }, { grows: [...GROWS] });

  for (const entry of taller) {
    const height = Number(entry.split(":")[1]);
    expect(height, `${entry} should exceed a single row`).toBeGreaterThan(40);
  }
});

test("every icon is one size, and centred in what holds it", async ({ page }) => {
  // Three mechanisms drew icons here: real SVG, text characters in the reader's font, and nothing
  // at all with CSS drawing a rotated square. They could not have matched — a character takes the
  // font's size and baseline, and a CSS square takes its own. Now they are all geometry, and the
  // size is a property of the set rather than of whichever control happens to hold one.
  const icons = await page.evaluate(() => {
    const out: { size: string; offset: string }[] = [];
    for (const svg of document.querySelectorAll("svg")) {
      if (!(svg instanceof SVGSVGElement)) continue;
      const r = svg.getBoundingClientRect();
      if (r.width === 0) continue;
      const host = svg.parentElement;
      if (!(host instanceof HTMLElement)) continue;
      const h = host.getBoundingClientRect();
      out.push({
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        offset: `${Math.round((r.left + r.width / 2) - (h.left + h.width / 2))},` +
                `${Math.round((r.top + r.height / 2) - (h.top + h.height / 2))}`,
      });
    }
    return out;
  });

  expect(icons.length, "the demo must render icons to compare").toBeGreaterThan(4);
  expect([...new Set(icons.map((i) => i.size))], "icon sizes differ").toHaveLength(1);
  expect([...new Set(icons.map((i) => i.offset))], "icons are not centred").toEqual(["0,0"]);
});

test("no icon is a text character", async ({ page }) => {
  // A magnifier, a chevron and a plus were once `⌕`, `‹` and `+` — characters, rendered in the
  // reader's font at that font's size and baseline, which is why they matched nothing beside them.
  const glyphs = await page.evaluate(() => {
    const found: string[] = [];
    const pictographic = /[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u;
    for (const el of document.querySelectorAll(
      ".mdy-select__arrow, .mdy-datepicker__toggle, .mdy-timepicker__toggle, " +
      ".mdy-multiselect__trigger, .mdy-chip__btn, .mdy-datepicker__nav-btn",
    )) {
      const text = (el.textContent ?? "").trim();
      if (text && pictographic.test(text)) found.push(`${el.className}: ${text}`);
    }
    return found;
  });
  expect(glyphs, "affordances drawing a character instead of geometry").toEqual([]);
});
