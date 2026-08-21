/**
 * A chip that carries a quantity says what the quantity is, and lets a keyboard change it.
 *
 * In counter mode a chip shows a number between two steppers. Today the number is text and the
 * steppers are buttons, so what a person hears is a name and a count read out as part of a label, and
 * what changes it is a live region announcing after the fact.
 *
 * The published answer is `role="spinbutton"` — or a real number input — because then the value is
 * announced natively when it changes, `ArrowUp` and `ArrowDown` adjust it, and `aria-valuenow` is a
 * fact a reader can ask for rather than a sentence it has to catch. Two buttons around a static
 * number plus a region kept in step is the shape that drifts.
 *
 * **[ADR 0128](../../docs/architecture/0128-a-chip-is-one-thing-not-a-cell.md) narrows this and the
 * narrowing is the point**: the spinbutton must *be* the chip, not a focusable child of it. That
 * record made the strip one tab stop by taking the chip's own controls out of the tab order, and a
 * spinbutton nested inside a chip would put one back — the same trade grid was rejected for.
 *
 * So the assertions are three, and the third is what stops a plausible wrong answer:
 *
 *   - the quantity is exposed as a value, not only drawn;
 *   - `ArrowUp` and `ArrowDown` change it from the keyboard;
 *   - crossing the field still costs what it cost, so the fix did not buy the value back with a stop.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS, bench } from "./bench";

for (const host of HOSTS) {
  test(`a counter chip states its quantity, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    const { root } = await bench(page, host, "counter");

    const stated = await page.evaluate((sel) => {
      const strip = document.querySelector(sel)?.querySelector(".mdy-multiselect__chips");
      if (strip === null || strip === undefined) return null;
      return Array.from(strip.querySelectorAll(".mdy-chip")).map((chip) => {
        const spin = chip.getAttribute("role") === "spinbutton" ? chip : chip.querySelector('[role="spinbutton"], input[type="number"]');
        return {
          name: chip.getAttribute("aria-label") ?? (chip.textContent ?? "").trim(),
          isTheChip: spin === chip,
          now: spin?.getAttribute("aria-valuenow") ?? (spin as HTMLInputElement | null)?.value ?? null,
          min: spin?.getAttribute("aria-valuemin") ?? null,
        };
      });
    }, root);

    expect(stated, "the counter fixture drew no chips").not.toBeNull();
    // The premise: this really is counter mode. A toggle-set chip has no quantity to state, and a
    // fixture that failed to ask for `mode: "multi"` would fail this for the wrong reason — which it
    // did, in another spec, for most of an evening.
    expect(stated!.length, "the counter fixture drew fewer chips than it chose").toBeGreaterThan(1);

    const silent = stated!.filter((chip) => chip.now === null);
    expect(
      silent.map((chip) => chip.name),
      `${silent.length} of ${stated!.length} chips draw a quantity and expose none — a reader is given ` +
        `the number as part of a label and told about a change only by a live region kept in step by ` +
        `hand. A spinbutton announces the value natively when it moves`,
    ).toEqual([]);

    expect(
      stated!.every((chip) => chip.isTheChip),
      "the quantity is exposed on a child of the chip rather than on the chip itself, which puts a " +
        "focusable thing back inside a strip that ADR 0128 made one tab stop",
    ).toBe(true);
  });

  test(`a quantity can be changed without a pointer, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    const { root, id } = await bench(page, host, "counter");

    const held = () => page.evaluate(({ api, id }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(id)?.s ?? null,
      { api: host.api, id });

    const before = await held();
    await page.locator(`${root} .mdy-multiselect__chips .mdy-chip`).first().focus();
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(300);
    const afterUp = await held();

    expect(
      afterUp,
      `\`ArrowUp\` on a counter chip left the value at ${JSON.stringify(before)}. The steppers beside ` +
        `the number are pointer affordances; a person who cannot use them has no way to raise a ` +
        `quantity at all`,
    ).not.toEqual(before);

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    const afterDown = await held();

    // The count is not the value. `["a","a","a","b"]` and `["a","a","b","a"]` hold the same three of
    // one and one of the other, and they are different values — the order a person chose in is the
    // order the form holds, which the reordering work settled. A step that raises a quantity and a
    // step that lowers it must leave the order where they found it.
    expect(
      afterDown,
      `up then down left ${JSON.stringify(afterDown)} where it began at ${JSON.stringify(before)}. ` +
        `The count came back and the order did not: raising appends at the end and lowering removes ` +
        `the first, so a person adjusting a quantity twice rearranges a list they did not touch`,
    ).toEqual(before);
  });
}
