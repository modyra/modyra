/**
 * A letter typed at a closed choice reaches the choice.
 *
 * Pressing `d` on a closed `<select>` jumps to Delta. Every platform does it, nobody was taught it,
 * and it is the fastest way to pick from a list a person already knows. It costs no popup, no arrow
 * keys and no reading.
 *
 * [ADR 0139](../../docs/architecture/0139-a-select-has-two-shapes.md) records that `select` is two
 * controls and that `searchable` moves two of the three renderers between them. Its amendment records
 * that one of the reasons given for preferring the native shape — *the platform's keyboard model* —
 * turned out not to hold: neither native shape receives a `change` event, and both are driven by the
 * library imitating the platform.
 *
 * **This is the reason that did survive, made measurable rather than argued.**
 *
 *     searchable: false        searchable: true
 *     plain    nothing         nothing
 *     lit      "d"             nothing
 *     angular  "d"             nothing
 *
 * Type-ahead exists in the native shape and nowhere else, and plain never has it because plain never
 * draws that shape.
 *
 * **It is red for plain today, and that is the point.** The open question ADR 0139 leaves is whether
 * plain should follow the switch, and the argument for it is exactly this capability. A decision made
 * without a check here would be made on a recollection; with one, whichever way it goes, the cost is
 * a diff rather than a claim — and if plain is deliberately left as it is, this file is where that
 * choice is written down as a thing given up rather than a thing overlooked.
 *
 * The searchable shape not having it is **not** a defect and is not asserted: a combobox with a
 * search field answers a letter by filtering, which is the same capability by another route and is
 * measured in `two-shapes-of-one-choice`.
 *
 * Claims under attack: A11Y-006, UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "c", label: "Charlie" },
  { value: "d", label: "Delta" },
];

for (const host of HOSTS) {
  test(`a letter reaches a closed choice, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The shape a document gets when it does not ask for search, which is the common case.
    await page.evaluate(({ api, options }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields("letter", [{ name: "f", kind: "select", label: "P", searchable: false, options }] as never);
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(400);

    const control = page.locator('[data-form="letter"] [role="combobox"], [data-form="letter"] select').first();
    await expect(control, "no select this spec can reach was drawn").toHaveCount(1, { timeout: 5_000 });
    await control.focus();

    const held = () => page.evaluate(({ api }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("letter").f,
      { api: host.api });

    // The premise: nothing is chosen, so anything that arrives came from the letter.
    expect(await held(), "the control started with a value, so a change proves nothing").toBeFalsy();

    await page.keyboard.press("d");
    await page.waitForTimeout(300);

    expect(
      await held(),
      "typing `d` at the closed control reached nothing. Every platform jumps to the option that " +
        "starts with the letter, it is the fastest way to pick from a list somebody already knows, " +
        "and it is the surviving argument in ADR 0139 for drawing the native shape at all — the " +
        "keyboard-model argument did not hold",
    ).toBe("d");
  });
}
