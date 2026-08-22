/**
 * What the way back calls the thing it would bring back.
 *
 * Removing a chip is undoable, and the control says so: a strip appears naming what went and offering
 * to restore it. That naming is the whole of its usefulness. A person who removed something by
 * accident — and the accident is easy, because the remove control sits inside the area that opens the
 * list — was looking at where they pressed, not at the chip, so they did not see it go. The sentence
 * is how they find out, and it has to name the thing in the words they chose it by.
 *
 * A value is not those words. `a` is an identifier the document uses to talk to itself; `Alfa` is what
 * the person read when they picked it. "a removed" tells someone who lost `Alfa` nothing they can act
 * on, and tells someone who lost `Amministrazione` exactly as little.
 *
 * The sentence goes out on two channels — a visible strip and a live region — and they are asserted
 * together, because a renderer can get one right and the other wrong. One does exactly that today: the
 * live region says the label and the visible strip says the identifier, so the person who can hear it
 * is told correctly and the person who can only see it is not. Checking either channel alone would
 * have found a renderer that passes.
 *
 * **The check is that the label appears and the raw value does not**, rather than an exact sentence:
 * the wording is a product decision, and a spec that pinned it would fail on translation while a
 * renderer printing an identifier passed.
 *
 * The labels are chosen so the two cannot be confused — a value that is not a prefix of its label, and
 * a label that is not a substring of any value.
 *
 * Claims under attack: UI-004, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [
  { value: "opt_9271", label: "Ferrovia" },
  { value: "opt_4410", label: "Marmo" },
];

for (const host of HOSTS) {
  test(`the way back names what it would bring back, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, options }) => {
      (window as never as Api)[api].mountFields("back", [{
        name: "m", kind: "multiselect", label: "Scelte", clearable: true,
        options, initialValue: ["opt_9271", "opt_4410"],
      }] as never);
    }, { api: host.api, options: OPTIONS });

    await page.locator('[data-form="back"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(700);

    await page.locator('[data-form="back"] .mdy-chip__remove').first().click({ force: true, timeout: 5_000 });
    await page.waitForTimeout(700);

    const said = await page.evaluate(() => {
      const scope = '[data-form="back"]';
      const wayBack = document.querySelector(`${scope} [class*="way-back"], ${scope} [class*="undo"]`);
      const live = Array.from(document.querySelectorAll(`${scope} [role='status'], ${scope} [aria-live]`))
        .map((element) => (element.textContent ?? "").trim())
        .filter((text) => text !== "");
      return { visible: (wayBack?.textContent ?? "").trim(), live };
    });

    // Nothing to read means the removal was not registered, and every assertion below would pass on
    // an empty string.
    expect(said.visible + said.live.join(" "), `${host.name} said nothing at all after a removal`).not.toBe("");

    const everything = `${said.visible} ${said.live.join(" ")}`;
    expect(everything, `${host.name} does not name the removed option: "${everything.trim()}"`)
      .toContain("Ferrovia");
    expect(
      everything,
      `${host.name} names the removed option by the value the document uses to talk to itself rather than `
      + `by the words the person chose it by: "${everything.trim()}"`,
    ).not.toContain("opt_9271");
  });
}
