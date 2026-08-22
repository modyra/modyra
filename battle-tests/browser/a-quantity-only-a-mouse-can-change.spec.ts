/**
 * A chip that carries a quantity says what the quantity is, and lets a keyboard change it.
 *
 * In counter mode a chip shows a number between two steppers. This spec once argued that the number
 * had to be `role="spinbutton"` on the chip itself, and won: a spinbutton announces its value
 * natively when it moves, and `aria-valuenow` is a fact a reader can ask for rather than a sentence
 * it has to catch.
 *
 * [ADR 0138](../../docs/architecture/0138-a-chip-is-an-item-not-a-number.md) reversed that, and the
 * reason is stronger than the one it beat: a `spinbutton` cannot carry `aria-posinset`, so a chip
 * cannot be both the number 3 of a range and the item at position 3 of 12. Making only the quantity
 * chip a spinbutton would give the strip one role while nobody has taken two of anything and another
 * role the moment somebody does — a keyboard model that changes underneath a person as a consequence
 * of what they chose.
 *
 * So the quantity is now stated in the chip's accessible name, and the native announcement is
 * replaced by a deliberate one. **That is exactly why this spec must not be deleted.** Where a
 * spinbutton failed loudly — no `aria-valuenow`, visible to any auditor — a name that stops
 * including the count fails silently, and ADR 0138 names this as the cost it has not paid for.
 *
 * The assertions are the property, and they hold under either mechanism:
 *
 *   - a person is told the quantity, by whatever means the renderer uses to say it;
 *   - `ArrowUp` and `ArrowDown` change it without a pointer;
 *   - crossing the field still costs what it cost, so nothing bought the value back with a tab stop.
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
        // Either way of saying it counts. A spinbutton states the value in `aria-valuenow`; a
        // listitem states it in its accessible name. What is refused is a chip that draws a number
        // and tells nobody — which is the same defect under both mechanisms.
        const spin = chip.getAttribute("role") === "spinbutton" ? chip : chip.querySelector('[role="spinbutton"], input[type="number"]');
        const name = chip.getAttribute("aria-label") ?? (chip.textContent ?? "").trim();
        const drawn = (chip.querySelector(".mdy-chip__count")?.textContent ?? "").trim();
        return {
          name,
          // A focusable descendant is what ADR 0128 refuses; a chip that is itself the thing, or a
          // chip that states its quantity in its own name, both keep the strip one tab stop.
          isTheChip: spin === null || spin === chip,
          now: spin?.getAttribute("aria-valuenow") ?? (spin as HTMLInputElement | null)?.value ?? null,
          drawn,
          // The number is stated if a reader can obtain it: exposed as a value, or present in the
          // name the chip announces itself with.
          //
          // A chip that draws **no** number is not in scope. One of something is the default and the
          // renderers draw nothing for it, so a chip with no quantity on screen has no quantity to
          // state — reading that as silence made this check red against every renderer for a chip
          // that was behaving correctly.
          statesIt: drawn === ""
            || (spin?.getAttribute("aria-valuenow") ?? null) !== null
            || name.includes(drawn),
        };
      });
    }, root);

    expect(stated, "the counter fixture drew no chips").not.toBeNull();
    // The premise: this really is counter mode. A toggle-set chip has no quantity to state, and a
    // fixture that failed to ask for `mode: "multi"` would fail this for the wrong reason — which it
    // did, in another spec, for most of an evening.
    expect(stated!.length, "the counter fixture drew fewer chips than it chose").toBeGreaterThan(1);

    const silent = stated!.filter((chip) => !chip.statesIt);
    expect(
      silent.map((chip) => ({ name: chip.name, drawn: chip.drawn })),
      `${silent.length} of ${stated!.length} chips draw a quantity and state none — the number is on ` +
        `the screen and a reader cannot obtain it, neither as a value nor in the name the chip ` +
        `announces itself with. ADR 0138 gave up the spinbutton's native announcement on the ` +
        `understanding that a deliberate one would replace it; this is that understanding, unmet`,
    ).toEqual([]);

    expect(
      stated!.every((chip) => chip.isTheChip),
      "the quantity is exposed on a focusable child of the chip rather than on the chip itself, " +
        "which puts a stop back inside a strip that ADR 0128 made one",
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
