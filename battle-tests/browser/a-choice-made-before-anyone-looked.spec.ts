/**
 * A multiselect that starts with exactly one choice already made.
 *
 * This is the ordinary case, not the edge one: a form opened to edit something that exists, holding
 * a single value. The control has to say so before the person touches anything — and then behave
 * like a control that has been touched.
 *
 * **The tags a person has already chosen live inside the pressable area that opens the list, and
 * each carries its own button that deletes it.** A press at the middle of the field — the place
 * anyone aims to open a control — therefore lands on whatever happens to be under the middle, and
 * with a single short value that is the delete button. The value is removed, the list does not open,
 * and pressing again opens a field that has lost what it held.
 *
 * **Which of the two happens is decided by the length of a word.** A short label leaves the ✕ near
 * the centre; a longer one pushes it left and the same press opens the list normally. No code chooses
 * that. Two people doing the identical thing get opposite outcomes because of how long their word is,
 * which is why this cannot be repaired by moving anything a few pixels.
 *
 * That is also why this file mounts **one** chosen value and not two: with two, the strip is wide
 * enough that the centre falls past the ✕, and every assertion here passes while the defect is fully
 * present.
 *
 * The keyboard is unaffected — tab to the field, press the down arrow, the list opens and the value
 * is untouched. It is the pointer alone, which is what makes it invisible to a suite that drives by
 * key and to an accessibility sweep that finds every control correctly named.
 *
 * The strip is asserted beside it because the two are read together: what the strip shows must be
 * what the form holds, and a strip that is right while the aim point destroys it is a control that
 * looks correct and is not.
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

  test(`aiming at the middle of the field does not delete what it holds, ${host.name}`, async ({ page }) => {
    await mountChosen(page, host);

    const trigger = page.locator('[data-form="chosen"] .mdy-multiselect__trigger');
    await expect(trigger).toHaveCount(1, { timeout: 5_000 });

    // The centre of the control, which is where a person aims to open it. Not a part selector: the
    // question is what occupies that point, and naming a part would presuppose the answer.
    const under = await page.evaluate(() => {
      const box = document.querySelector('[data-form="chosen"] .mdy-multiselect__trigger')?.getBoundingClientRect();
      if (box === undefined) return "none";
      const element = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return element === null ? "none" : `${element.tagName}.${element.className.split(/\s+/)[0]}`;
    });

    await trigger.click({ timeout: 5_000 });
    await page.waitForTimeout(400);

    const held = await page.evaluate(({ api }) =>
      (window as never as Api)[api].valueOf("chosen" as never) as unknown as Record<string, unknown>, { api: host.api });

    expect(
      held.s,
      `${host.name}: pressing the middle of the field lands on ${under} and the value went from `
      + `${JSON.stringify(CHOSEN)} to ${JSON.stringify(held.s)} — the control that deletes sits where a person aims to open`,
    ).toEqual(CHOSEN);

    expect(await expanded(page), `${host.name} did not open on a press at the middle of its own trigger`).toBe("true");
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
