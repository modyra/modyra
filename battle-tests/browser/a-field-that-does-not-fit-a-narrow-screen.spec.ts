/**
 * Whether a field full of values can be read at the narrowest width a person is likely to use.
 *
 * A field that holds many values draws them as a row of blocks. At comfortable widths that row is one
 * line and scrolls sideways, which is a decision taken deliberately: a form reads as a column of
 * controls of one height, and a row that grew would break the line the eye follows. **At 320 CSS px
 * that decision reverses**, and the reversal is the whole point of the record that took it: a line
 * that cannot grow can only scroll, and a sideways scroll inside a page that already scrolls
 * downwards is the two-dimensional scrolling the reflow criterion forbids. Below the threshold the
 * height rule yields and the row is meant to break onto several lines.
 *
 * **It does not.** At 320 the blocks stay on one line and the row runs some two thousand pixels past
 * its own edge, exactly as it does at four times the width. Every value but the first is reachable
 * only by dragging the row sideways.
 *
 * **What is asserted is the consequence, not the mechanism.** The record chose wrapping as the means;
 * this file does not require wrapping, it requires that the content of the field fit the width it is
 * given. A layout that reaches the same end another way passes, and no property name in a stylesheet
 * is the thing under test. That matters here because the declaration and the effect have come apart:
 * the stylesheet does say the blocks may wrap at this width, on an element one level above the one
 * that holds them, and a file written to check the declaration would have agreed with a page that
 * never moved a block.
 *
 * **The repaired state was reached before this was written.** Four properties together — the box
 * stops scrolling, and the element holding the blocks is allowed to wrap, to shrink, and to be
 * narrower than its content — put twelve blocks on twelve lines with nothing past the edge, in all
 * three renderers. Two smaller attempts did not: removing the scroll alone changed nothing, and
 * permitting the wrap alone changed nothing, because an element as wide as its content has no reason
 * to wrap. So this file asks for a state that exists rather than for one nobody has produced, and the
 * cost of getting there is more than one line of a stylesheet.
 *
 * **The comfortable width is the control.** The same field, holding the same values at 1280, overflows
 * too — and there that is the decision working, not a defect. A reading that found no overflow
 * anywhere would mean the arrangement was never full enough to test, and the premise below says so
 * instead of passing.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .multiselect.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

/** The width the reflow criterion names, and a comfortable one to prove the row is full at all. */
const NARROW = 320;
const COMFORTABLE = 1_280;

const OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: `v${index}`,
  label: `Opzione lunga numero ${index}`,
}));

for (const host of HOSTS) {
  test(`a field full of values fits the narrowest width, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const chipsClass = classOf("chips");
    const chipClass = classOf("chip");
    expect(
      [chipsClass, chipClass].filter((one) => one === ""),
      "the contract declares no class for the row or the block, so this file cannot locate them and "
      + "a selector built from an empty string would match the whole document",
    ).toEqual([]);

    const at = async (width: number) => {
      await page.setViewportSize({ width, height: 800 });
      const id = `fit_${width}`;

      await page.evaluate(({ api, mountId, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "m", kind: "multiselect", label: "Scelte", options,
          initialValue: (options as { value: string }[]).map((one) => one.value),
        }] as never);
      }, { api: host.api, mountId: id, options: OPTIONS });

      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);

      const read = await page.evaluate(({ mountId, chips, chip }) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        if (root === null) return null;
        const row = root.querySelector(`.${chips}`) as HTMLElement | null;
        if (row === null) return null;
        const blocks = Array.from(root.querySelectorAll(`.${chip}`));
        // Lines counted by where the blocks' tops landed, which is what a person sees, rather than by
        // any property that claims to govern it.
        const tops = new Set(blocks.map((one) => Math.round(one.getBoundingClientRect().top)));
        // The element that actually holds the blocks, whatever the contract calls it — the diagnosis
        // is worth more than the symptom when the two are on different elements.
        const holder = blocks[0]?.parentElement ?? null;
        const named = (element: Element | null) =>
          element === null ? "(none)"
            : Array.from(element.classList).find((one) => one.startsWith("mdy-")) ?? element.tagName.toLowerCase();
        return {
          blocks: blocks.length,
          lines: tops.size,
          overhang: row.scrollWidth - row.clientWidth,
          box: `${named(row)} says ${getComputedStyle(row).flexWrap}`,
          holder: holder === null ? "(none)" : `${named(holder)} says ${getComputedStyle(holder).flexWrap}`,
        };
      }, { mountId: id, chips: chipsClass, chip: chipClass });

      await page.evaluate(({ api, mountId }) => {
        (window as never as Api)[api].dispose?.(mountId as never);
      }, { api: host.api, mountId: id });

      expect(read, `${host.name} drew no row of blocks at ${width}px`).not.toBeNull();
      expect(read!.blocks, `${host.name} drew no blocks at ${width}px, so there is nothing to lay out`)
        .toBeGreaterThan(0);
      return read!;
    };

    const wide = await at(COMFORTABLE);
    const narrow = await at(NARROW);

    // The premise. A row that fits at the comfortable width was never full, and its fitting at the
    // narrow one would say nothing about a field with more values than it can show.
    expect(
      wide.overhang,
      `${OPTIONS.length} values did not fill the row even at ${COMFORTABLE}px, so the narrow reading `
      + "below is about a field that was never overfull and this file tested nothing",
    ).toBeGreaterThan(0);

    expect(
      narrow.overhang,
      `at ${NARROW}px the field holds ${narrow.blocks} values on ${narrow.lines} line(s) and runs `
      + `${narrow.overhang}px past its own edge, so every value but the first is reachable only by `
      + "dragging sideways inside a page that already scrolls down.\n"
      + `  the box:            ${narrow.box}\n`
      + `  what holds the blocks: ${narrow.holder}\n`
      + `  the same field at ${COMFORTABLE}px: ${wide.lines} line(s), ${wide.overhang}px past the edge, `
      + "which is the decision working rather than a defect",
    ).toBeLessThanOrEqual(0);
  });
}
