/**
 * Two different choices, held at once, and the field shows one.
 *
 * A multiselect keys what it holds so it can tell one choice from another. The controller derives
 * that key from the value's **content** — [ADR 0051](../../docs/architecture/0051-an-option-is-compared-by-what-it-holds.md)
 * again, `{ id: 1 }` and `{ id: 2 }` are different options because they hold different data.
 *
 * Measured with a list of two object-valued options and **both of them selected**, using the very
 * objects the list was built from:
 *
 *     plain      1 chip   "Alfa 2"
 *     lit        1 chip   "Alfa 2"
 *     angular    1 chip   "Alfa 2"
 *
 * The model holds two values and every renderer draws one, labelled as the first taken **twice**. So
 * Beta is not shown as missing — it is shown as more Alfa. A person reads a field that says something
 * they did not choose, and the count agrees with it.
 *
 * **Nothing about a copy is involved here.** These are the same objects, so no reconciliation is
 * being asked for; the field simply cannot tell its two values apart.
 *
 * ## Why no existing check sees it
 *
 * `String(v)` and the contract's key agree for every primitive — `"a"` keys to `"a"` either way — and
 * every fixture in this suite uses string values. The two derivations part company only on an object,
 * where one reads the content and the other returns `[object Object]` for every object there is.
 *
 * That is why the string case is mounted here too, and asserted **first**: it is the control. If it
 * ever fails, the object case below is not measuring keying at all and the reading means nothing.
 * A defect that only appears outside the shape every fixture uses is invisible in exactly the
 * proportion that the fixtures agree with each other.
 *
 * **The property, not the repair.** Whether the renderers should pass the key derivation they use or
 * adopt the contract's is a decision for whoever owns them, and a spec naming one would take it here.
 * What is asserted is that two values a document declared as different reach a person as two things.
 *
 * Claims under attack: UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const chipsIn = (page: import("@playwright/test").Page, form: string) =>
  page.evaluate((selector) => Array.from(document.querySelectorAll(`${selector} .mdy-chip`))
    .map((chip) => (chip.textContent ?? "").replace(/\s+/g, " ").trim()), `[data-form="${form}"]`);

for (const host of HOSTS) {
  test(`two choices held at once are two chips, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_000, height: 600 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The control, and it is a control rather than a second case: every fixture in this suite holds
    // strings, and if strings ever stopped working the object reading below would be describing
    // something else entirely.
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("plain-keys", [{
        name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a", "b"],
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="plain-keys"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const withStrings = await chipsIn(page, "plain-keys");
    expect(
      withStrings.length,
      `${host.name} drew ${withStrings.length} chip(s) for two string values — ${JSON.stringify(withStrings)}. `
      + "The control failed, so the object case below is not measuring how values are keyed.",
    ).toBe(2);

    // The same shape, with objects. The very objects the list was built from: no copy, no
    // reconciliation, nothing to recognise loosely.
    await page.evaluate(({ api }) => {
      const alfa = { id: 1, nome: "Alfa" };
      const beta = { id: 2, nome: "Beta" };
      (window as never as Api)[api].mountFields("object-keys", [{
        name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
        options: [{ value: alfa, label: "Alfa" }, { value: beta, label: "Beta" }],
        initialValue: [alfa, beta],
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="object-keys"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const held = await page.evaluate(({ api }) =>
      JSON.stringify((window as never as Api)[api].valueOf("object-keys" as never)), { api: host.api });

    // The premise: the form kept both. A field that dropped one has a different defect and this
    // would be reporting the wrong one.
    expect(
      held,
      `${host.name} did not keep both values — it holds ${held}. What the field draws is then correct `
      + "about a model that already lost one, which is not what this file is about.",
    ).toContain('"id":2');

    const withObjects = await chipsIn(page, "object-keys");
    expect(
      withObjects.length,
      `${host.name} holds two different values and drew ${withObjects.length} chip(s): `
      + `${JSON.stringify(withObjects)}. The second choice is not shown as missing — it is shown as `
      + "more of the first, and the count agrees. A person reads a field stating something they did "
      + "not choose.",
    ).toBe(2);
  });
}
