/**
 * A field that holds one value, showing two of them chosen.
 *
 * A radio group and a segmented button are **single-choice**: exactly one of their options is the
 * chosen one, and that is not a preference but the whole of what the control means. A person reading
 * two marked radios cannot tell what the form holds, and neither can they fix it — pressing either
 * one is what they already did.
 *
 * Measured with a list of two object-valued options and the **second** held:
 *
 *     kind         plain   angular   lit
 *     radio          1        1       2
 *     segmented      1        1       2
 *
 * The model holds one value throughout. So this is not a form that lost track of what it has; it is a
 * control that answers *are you the chosen one?* with yes for both.
 *
 * **The same shape as the chips that became one, one kind over.** There, two different values keyed to
 * one and collapsed; here, one value matches two options. Both come from comparing what a document
 * declared as data by something other than the data — and both are invisible to every fixture in this
 * suite, because for a primitive the two comparisons agree exactly.
 *
 * That is why the string case is mounted here and asserted **first, as the control**. With strings the
 * same renderer marks one. If that ever stops being true, the object reading below is not measuring
 * how a choice is recognised and says nothing.
 *
 * **The property, not the repair.** Whether a renderer should ask the contract for the comparison or
 * carry its own is a decision for whoever owns it. What is asserted is that a single-choice control
 * marks a single choice.
 *
 * Claims under attack: UI-011, ADP-001, A11Y-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Kinds where exactly one option is the chosen one. */
const SINGLE_CHOICE = ["radio", "segmented"] as const;

/** Everything a renderer may use to say "this one is chosen". */
const chosenIn = (page: import("@playwright/test").Page, form: string) =>
  page.evaluate((selector) => {
    const scope = document.querySelector(selector);
    if (scope === null) return null;
    return Array.from(scope.querySelectorAll('input,[role="radio"],[role="option"],[role="tab"],option'))
      .filter((element) => (element as HTMLInputElement).checked === true
        || element.getAttribute("aria-checked") === "true"
        || element.getAttribute("aria-selected") === "true"
        || (element as HTMLOptionElement).selected === true)
      .map((element) => (element.closest("label")?.textContent ?? element.textContent
        ?? element.getAttribute("aria-label") ?? "").trim().slice(0, 12));
  }, `[data-form="${form}"]`);

const mount = async (
  page: import("@playwright/test").Page,
  host: (typeof HOSTS)[number],
  id: string,
  kind: string,
  useObjects: boolean,
) => {
  await page.evaluate(({ api, id, kind, useObjects }) => {
    const alfa = useObjects ? { id: 1, nome: "Alfa" } : "a";
    const beta = useObjects ? { id: 2, nome: "Beta" } : "b";
    (window as never as Api)[api].mountFields(id, [{
      name: "f", kind, label: "Scelte",
      options: [{ value: alfa, label: "Alfa" }, { value: beta, label: "Beta" }],
      initialValue: beta,
    }] as never);
  }, { api: host.api, id, kind, useObjects });
  await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
  await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
  await page.waitForTimeout(450);
};

for (const host of HOSTS) {
  for (const kind of SINGLE_CHOICE) {
    test(`a ${kind} holding one value marks one option, ${host.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1_000, height: 700 });
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      // The control. Every fixture in this suite holds strings, so if this ever fails the reading
      // below is about something other than how a choice is recognised.
      await mount(page, host, `one-${kind}-strings`, kind, false);
      const withStrings = await chosenIn(page, `one-${kind}-strings`);
      expect(
        withStrings,
        `${host.name} did not draw a ${kind} for string values, so the control cannot be read`,
      ).not.toBeNull();
      expect(
        withStrings!.length,
        `${host.name}: a ${kind} holding one string value marks ${withStrings!.length} option(s) — `
        + `${JSON.stringify(withStrings)}. The control failed, so nothing below is about object values.`,
      ).toBe(1);

      await mount(page, host, `one-${kind}-objects`, kind, true);

      // The premise: the field really is holding one value. A field that lost it, or gained one,
      // would make the count below correct about a model that is already wrong.
      const held = await page.evaluate(({ api, id }) =>
        JSON.stringify((window as never as Api)[api].valueOf(id as never)), { api: host.api, id: `one-${kind}-objects` });
      expect(
        held,
        `${host.name}: the ${kind} holds ${held}, which is not the single value it was given`,
      ).toContain('"id":2');

      const withObjects = await chosenIn(page, `one-${kind}-objects`);
      expect(
        withObjects!.length,
        `${host.name}: a ${kind} holds one value and marks ${withObjects!.length} option(s) as chosen — `
        + `${JSON.stringify(withObjects)}. A single-choice control showing two chosen is a state its own `
        + "meaning forbids: a person cannot tell what the form holds, and pressing either option is "
        + "what they already did.",
      ).toBe(1);
    });
  }
}
