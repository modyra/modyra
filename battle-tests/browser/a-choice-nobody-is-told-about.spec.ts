/**
 * What a person who cannot see the chips is told when a choice lands.
 *
 * Asked for directly — *"UIX deve essere anche chiara l'usabilità e l'accessibilità"* — so this is the
 * half of the perimeter that no screenshot shows.
 *
 * A multiselect's whole purpose is accumulating choices, and the chips strip is the feedback that they
 * accumulated. Somebody using a screen reader does not get that strip; they get whatever the control
 * says out loud. Measured, opening the popup, choosing an option, and closing again:
 *
 *     start ""   opened ""   afterPick ""   closed ""      value became ["a"]
 *
 * **The live region exists, is `aria-live="polite"`, and is never written to.** The choice registered
 * and nothing was announced — so the only confirmation that anything happened is the one a person
 * cannot perceive.
 *
 * This is not a missing feature so much as a half-built one: somebody put the region there, which means
 * somebody meant to announce. An empty `aria-live` is worse than none, because it reads to a reviewer
 * as the problem already being handled.
 *
 * What it should say is not asserted here beyond it being about the choice — the wording is a design
 * decision and belongs to whoever writes it. What is asserted is that **something is said, that it
 * names what changed, and that it changes again when the choice does** — the last one because a region
 * written once and never updated announces the first choice and silently swallows every one after it.
 *
 * Claims under attack: A11Y-001, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

/**
 * How an option in the popup is reached, taken from the catalogue rather than written here.
 *
 * An earlier draft looked for `[role="option"]` and `.mdy-multiselect__option` and found neither: this
 * popup renders its options as chips, and a spec that names the DOM it expects goes red on an anatomy
 * change rather than on a defect. The contract knows what an option is; ask it.
 */
const OPTION = (MDY_WIDGET_CONTRACTS.multiselect.parts as Record<string, { classes: string[] }>)
  .option.classes.map((name) => `.${name}`).join("");

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const OPTIONS = ["a", "b", "c"].map((value) => ({ value, label: `Opzione ${value.toUpperCase()}` }));

for (const host of HOSTS) {
  test(`a choice is announced to somebody who cannot see the chips, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api, options }) => {
      (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
        .mountFields("say", [{ name: "s", kind: "multiselect", label: "Ingredienti", options }]);
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(400);

    const announced = () =>
      page.evaluate(() => {
        const root = document.querySelector('[data-form="say"]');
        if (root === null) return null;
        return Array.from(root.querySelectorAll("[aria-live]"))
          .map((element) => (element.textContent ?? "").trim())
          .filter(Boolean)
          .join(" | ");
      });

    const held = () =>
      page.evaluate(({ api }) =>
        (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("say")?.s ?? null,
        { api: host.api });

    // The premise: a region exists to be written to. A control with none would fail this for a
    // different reason and deserves a different sentence.
    expect(
      await page.evaluate(() => document.querySelectorAll('[data-form="say"] [aria-live]').length),
      "this control has no live region at all, so nothing could be announced through one",
    ).toBeGreaterThan(0);

    // Bounded, because an element that never becomes actionable hangs for the whole test timeout and
    // reports "the browser was closed" instead of what it was waiting for.
    await page.locator('[data-form="say"] .mdy-multiselect__trigger, [data-form="say"] [aria-haspopup]')
      .first().click({ force: true, timeout: 5_000 })
      .catch(() => undefined);
    await page.waitForTimeout(300);

    const options = page.locator(`[data-form="say"] ${OPTION}, .mdy-multiselect-overlay__panel ${OPTION}`);
    await options.first().click({ force: true, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);

    const chosen = await held();
    // The control: something really was chosen. Without it, silence would be correct.
    expect(
      Array.isArray(chosen) && chosen.length,
      `nothing was chosen, so there is nothing to announce — the value is ${JSON.stringify(chosen)}`,
    ).toBeGreaterThan(0);

    const first = await announced();
    expect(
      first,
      `a choice landed — the value is now ${JSON.stringify(chosen)} — and the live region says nothing. ` +
        `The strip is the only confirmation, and it is the one a person using a screen reader does not ` +
        `get. An empty aria-live is worse than none: it reads to a reviewer as already handled`,
    ).not.toBe("");

    // And it keeps up. A region written once announces the first choice and swallows every one after,
    // which looks correct in any test that only makes one.
    await options.nth(1).click({ force: true, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const second = await announced();

    expect(
      second,
      `a second choice was made and the announcement is still ${JSON.stringify(first)} — a live region ` +
        `written once tells somebody about the first thing they did and nothing about the rest`,
    ).not.toBe(first);
  });
}
