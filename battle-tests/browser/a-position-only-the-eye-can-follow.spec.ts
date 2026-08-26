/**
 * Whether what the control says about the reading position is where the reading position is.
 *
 * An open list has a place in it that the next press will take. A person who can see the list is told
 * where that is by a highlight; a person who cannot is told by an attribute the control carries, which
 * names the option currently under the position. The two are meant to be one fact reported twice.
 *
 * **When they part company, what is left is a control that acts on a position nothing shows.** The
 * value that arrives is the value the person meant — the arrows do reach whatever the commit reads,
 * and it advances. Neither of the drawn reports follows it: the attribute names the first option at
 * every press, and so does the class that highlights one. A person listening hears the same word four
 * times while the selection travels past four options; a person watching sees the same row lit. Both
 * then commit a value neither was told they had arrived at.
 *
 * That the two drawn reports fail together, and the committed value does not, says where the fault is
 * not: the position is being kept and moved. What is not happening is anything drawing it again.
 *
 * **It is invisible to every check that watches the value.** The keystrokes reach the right option and
 * the right value is committed, so a test that presses arrows and reads what came out finds nothing.
 * Asking the question at all means comparing a report against the outcome rather than the outcome
 * against what was expected.
 *
 * The comparison is made through the control's own words: the attribute names an element, that element
 * carries a value, and pressing the commit key produces a value. Those two must be the same one. No
 * number of presses is fixed here — whatever the arrows reach, the attribute is required to have said
 * so, and the file follows a list of any length.
 *
 * **Two premises.** The attribute must be there at all, or this is a different anatomy and nothing was
 * compared; and the commit must have changed what the field holds, or the two agree because neither
 * moved.
 *
 * Claims under attack: A11Y-001, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

/** More than one, so a position that never moves is told apart from one that moves once. */
const WALKS = [1, 2] as const;

for (const host of HOSTS) {
  test(`the option a control names is the option it is on, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const disagreeing: string[] = [];

    for (const steps of WALKS) {
      const id = `told_${steps}`;
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, mountId, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "f", kind: "select", label: "Scelte", searchable: true, options,
        }] as never);
      }, { api: host.api, mountId: id, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);

      const held = () => page.evaluate(({ api, mountId }) =>
        JSON.stringify(((window as never as Api)[api].valueOf as unknown as (one: string) => Record<string, unknown>)(mountId)?.f),
        { api: host.api, mountId: id });

      const before = await held();
      await page.locator(`[data-form="${id}"] [role="combobox"]`).first().focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      for (let step = 0; step < steps; step += 1) {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
      }

      // What the control says: the option it names, and the value that option carries.
      const says = await page.evaluate((mountId) => {
        const named = document.querySelector(`[data-form="${mountId}"] [aria-activedescendant]`)
          ?.getAttribute("aria-activedescendant") ?? null;
        if (named === null) return { named: null, label: null };
        const option = document.getElementById(named);
        return { named, label: option === null ? null : (option.textContent ?? "").trim() };
      }, id);

      expect(
        says.named,
        `${host.name} names no option as the one under the reading position, so there is no report `
        + "here to compare against where the position turned out to be",
      ).not.toBeNull();

      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      const after = await held();

      expect(
        after,
        `${host.name}: committing after ${steps} press(es) changed nothing, so the position never `
        + "moved either and the two reports agree about a walk that did not happen",
      ).not.toBe(before);

      // What the control did: the label of the value it committed.
      const chose = OPTIONS.find((one) => JSON.stringify(one.value) === after)?.label ?? after;

      if (says.label !== chose) {
        disagreeing.push(
          `after ${steps} press(es) it named "${says.label}" and committed "${chose}"`);
      }
    }

    expect(
      disagreeing,
      `${host.name}: the option this control says the reading position is on is not the option it is `
      + `on — ${disagreeing.join("; ")}. The right value arrives, so the position is being kept and `
      + "moved; what is not happening is anything drawing it again. A person is told the same option "
      + "at every press while the selection travels past the others, and then commits one they were "
      + "never told they had reached.",
    ).toEqual([]);
  });
}
