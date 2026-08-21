/**
 * Typing a letter in an open option list jumps to the option that starts with it.
 *
 * Type-ahead is the base gesture of a listbox: the ARIA authoring practices specify it, every native
 * `<select>` has it, and a person who knows the value they want does not read a list to find it. With
 * twelve options and no filter box it is the difference between one keystroke and twelve.
 *
 * **The scope matters and is the reason this file exists.** Type-ahead on the *chip strip* was
 * proposed, considered and rejected — the strip is a set already chosen, printable characters belong
 * to the field's own input where there is one, and a second differently-scoped type-ahead is a cost
 * with no win. That decision was taken and it is not this one. The popup is a set being chosen from,
 * and the published practice is unambiguous there.
 *
 * The two were agreed separately and read as one: one side reasoned about the strip and said no, the
 * other reasoned about the popup and said mandatory, and each was told it was right. **An agreement
 * reached across a scope mismatch is indistinguishable from an agreement**, which is why this asserts
 * the popup and says so in its title.
 *
 * Asserted as *the active option moves to the match*, not as a particular key handler: a control that
 * filters the list instead of moving through it also satisfies a person looking for "Milano", and
 * choosing between those is a design decision this file must not make.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS, bench, open } from "./bench";

const CITIES = [
  { value: "ro", label: "Roma" },
  { value: "mi", label: "Milano" },
  { value: "na", label: "Napoli" },
  { value: "to", label: "Torino" },
  { value: "pa", label: "Palermo" },
];

for (const host of HOSTS) {
  test(`typing a letter reaches the option that starts with it, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "empty", { options: CITIES, searchable: false });
    await open(page, root);

    /** Whichever option the control currently calls active, by any of the ways one is named. */
    const active = () => page.evaluate(() => {
      const named = document.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant");
      const byId = named === null || named === undefined ? null : document.getElementById(named);
      const marked = document.querySelector('.mdy-chip--active, [data-active="true"], .mdy-multiselect__option--active');
      const focused = document.activeElement;
      const label = (element: Element | null | undefined) =>
        element === null || element === undefined ? null : (element.getAttribute("title") ?? element.textContent ?? "").trim();
      return label(byId) ?? label(marked) ?? (focused?.closest(".mdy-chip") === null ? null : label(focused?.closest(".mdy-chip")));
    });

    const before = await active();

    // "m" for Milano — second in the list, so a control that simply starts at the top does not pass by
    // accident, and a control that moves one place does not either.
    await page.keyboard.press("m");
    await page.waitForTimeout(350);
    const afterM = await active();

    // The premise: the popup is open and something is listed. Typing into a closed control proves
    // nothing, and neither does typing into a list of one.
    const listed = await page.evaluate(() =>
      document.querySelectorAll(".mdy-multiselect__options .mdy-chip, .mdy-multiselect-overlay__grid .mdy-chip").length);
    expect(listed, "the popup is not showing options, so there is nothing to type into").toBeGreaterThan(2);

    expect(
      afterM,
      `typing "m" left the active option at ${JSON.stringify(before)} — it is ${JSON.stringify(afterM)} ` +
        `after. Nothing moved, so a person who knows they want Milano reads the list to find it. ` +
        `Type-ahead is the base gesture of a listbox and the popup is where it belongs; the strip is ` +
        `where it was declined, and those are different questions`,
    ).toBe("Milano");
  });
}
