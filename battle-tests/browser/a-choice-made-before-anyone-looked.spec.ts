/**
 * A multiselect that starts with exactly one choice already made.
 *
 * This is the ordinary case, not the edge one: a form opened to edit something that exists, holding
 * a single value. The control has to say so before the person touches anything — and then behave
 * like a control that has been touched.
 *
 * **The count is the whole finding.** One chosen and the first press does nothing; two chosen and
 * the same press opens it, on the same control, with the same options behind it. That is why this
 * file mounts one and not two: a fixture choosing two options passes every assertion here while the
 * defect is fully present, and the case a person meets most is the one with a single value in it.
 *
 * A control whose first press does nothing and whose second press works is not a slow control — it
 * is one that has taught the person their press does not count. They press twice from then on,
 * including where the second press closes what the first opened.
 *
 * The strip is asserted beside it because the two are read together: what the strip shows must be
 * what the form holds, and a strip that is right while the press is dead is a control that looks
 * correct and is not.
 *
 * The press is made after the mount has settled, because a node addressed during a re-render is
 * pressed after it has been replaced, and the press then lands on an element the document has
 * already discarded. That reads exactly like a control ignoring a press, and it is not one — so the
 * settle is what makes the difference between the two legible.
 *
 * The keyboard is asserted beside the pointer. Both are published, both are the same intent, and a
 * control that answers one and not the other is a control a mouse user and a keyboard user disagree
 * about.
 *
 * Claims under attack: UI-011, UI-003, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
  { value: "d", label: "Delta" },
];

/** One value, not two. Two passes while the defect is present — see the header. */
const CHOSEN = ["a"];
const CHOSEN_LABELS = ["Alfa"];

const mountChosen = async (page: import("@playwright/test").Page, host: typeof HOSTS[number]) => {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
  await page.evaluate(({ api, options, chosen }) => {
    (window as never as Api)[api].mountFields("chosen", [{
      name: "s", kind: "multiselect", label: "Scelte", options, initialValue: chosen,
    }] as never);
  }, { api: host.api, options: OPTIONS, chosen: CHOSEN });
  await page.locator('[data-form="chosen"]').waitFor({ timeout: 5_000 });
  await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
  await page.waitForTimeout(1_000);
};

const expanded = (page: import("@playwright/test").Page) => page.evaluate(() =>
  document.querySelector('[data-form="chosen"] .mdy-multiselect__trigger')?.getAttribute("aria-expanded") ?? "none");

for (const host of HOSTS) {
  test(`the strip shows the choice the form holds, ${host.name}`, async ({ page }) => {
    await mountChosen(page, host);

    const shown = await page.evaluate(() => Array.from(document.querySelectorAll('[data-form="chosen"] .mdy-chip'))
      .map((chip) => (chip.querySelector(".mdy-chip__label")?.textContent ?? chip.textContent ?? "").trim())
      .filter((label) => label !== ""));

    const held = await page.evaluate(({ api }) =>
      (window as never as Api)[api].valueOf("chosen" as never) as unknown as Record<string, unknown>, { api: host.api });

    // The model first: if the form did not take the initial value, the strip is right to show
    // nothing and this test is measuring the wrong thing.
    expect(held.s, `${host.name} did not take the initial value the field declared`).toEqual(CHOSEN);

    expect(shown, `${host.name} starts with ${JSON.stringify(CHOSEN)} chosen and its strip shows ${JSON.stringify(shown)}`)
      .toEqual(CHOSEN_LABELS);
  });

  test(`the first press opens a control that already holds a value, ${host.name}`, async ({ page }) => {
    await mountChosen(page, host);

    const trigger = page.locator('[data-form="chosen"] .mdy-multiselect__trigger');
    await expect(trigger).toHaveCount(1, { timeout: 5_000 });
    expect(await expanded(page), `${host.name} came up already open`).toBe("false");

    await trigger.click({ timeout: 5_000 });
    const afterOne = await page.waitForFunction(
      () => document.querySelector('[data-form="chosen"] .mdy-multiselect__trigger')?.getAttribute("aria-expanded") === "true",
      undefined,
      { timeout: 3_000 },
    ).then(() => true).catch(() => false);

    if (!afterOne) {
      await trigger.click({ timeout: 5_000 });
      const afterTwo = await page.waitForFunction(
        () => document.querySelector('[data-form="chosen"] .mdy-multiselect__trigger')?.getAttribute("aria-expanded") === "true",
        undefined,
        { timeout: 3_000 },
      ).then(() => true).catch(() => false);
      // Naming which of the two it is, because they need different repairs: a press that never
      // arrives is a listener problem, a press that arrives and is swallowed is a state problem.
      expect(afterOne, `${host.name} ignored the first press on a control holding a value and opened on the ${afterTwo ? "second" : "neither"}`)
        .toBe(true);
    }
    expect(afterOne).toBe(true);
  });

  test(`the keyboard opens a control that already holds a value, ${host.name}`, async ({ page }) => {
    await mountChosen(page, host);

    const trigger = page.locator('[data-form="chosen"] .mdy-multiselect__trigger');
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const opened = await page.waitForFunction(
      () => document.querySelector('[data-form="chosen"] .mdy-multiselect__trigger')?.getAttribute("aria-expanded") === "true",
      undefined,
      { timeout: 3_000 },
    ).then(() => true).catch(() => false);
    expect(opened, `${host.name} does not open from the keyboard when it already holds a value`).toBe(true);
  });
}
