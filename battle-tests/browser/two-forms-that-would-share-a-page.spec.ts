/**
 * Two forms with the same field names, on one page.
 *
 * A widget id is the field name, and every id a form generates derives from it — the input's own id,
 * `label[for]`, `aria-describedby`, `aria-errormessage`, the popup a control names, a radio group's
 * `name`. Two forms built from the same names therefore mint the same ids, and the mount option that
 * prevents it says why in its own words: *neither form examined alone looks wrong, which is why only
 * a page holding both can detect it*.
 *
 * This is that page. Without `idPrefix`, two date fields called `when` produce forty-nine duplicated
 * ids, and clicking the **second** form's label puts the cursor in the **first** form's input — the
 * harm stated plainly rather than described.
 *
 * With `idPrefix`, none of it happens. That is what this pins: the remedy works, and the damage it
 * prevents is real rather than theoretical.
 *
 * One renderer never has the hazard, because it mints an id per widget instance instead of from the
 * field's name. Both are asked, and both must be clean once the option is used; only the one that
 * derives ids from names is asked what happens without it.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`two forms on one page keep their own ids, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, prefix: string | null) => {
      await page.evaluate(({ mountId, api, idPrefix }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[], o?: unknown): unknown }>)[api]
          .mountFields(mountId, [{ name: "when", kind: "datepicker", label: "When" }],
            idPrefix === null ? {} : { idPrefix });
      }, { mountId: id, api: host.api, idPrefix: prefix });
      await page.waitForTimeout(240);
    };

    /** Every id on the page that more than one element carries. */
    const duplicated = () => page.evaluate(() => {
      const counted = new Map<string, number>();
      for (const element of Array.from(document.querySelectorAll("[id]"))) {
        counted.set(element.id, (counted.get(element.id) ?? 0) + 1);
      }
      return [...counted.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    });

    await mount("one", "a");
    await mount("two", "b");

    // The premise: both forms are on the page and built something.
    expect(await page.evaluate(() =>
      document.querySelectorAll('[data-form="one"] input, [data-form="two"] input').length),
      "the two forms did not both build a control").toBeGreaterThan(1);

    expect(await duplicated(), "two forms scoped apart still mint the same ids").toEqual([]);

    // And the relationship a duplicated id breaks: a label belongs to the field beside it.
    await page.locator('[data-form="two"] label').first().click();
    await page.waitForTimeout(280);

    const landed = await page.evaluate(() => {
      const second = document.querySelector('[data-form="two"]');
      const first = document.querySelector('[data-form="one"]');
      const active = document.activeElement;
      return {
        inSecond: second !== null && active !== null && second.contains(active),
        inFirst: first !== null && active !== null && first.contains(active),
      };
    });

    expect(landed.inSecond, "clicking a form's own label did not focus a control in that form").toBe(true);
    expect(landed.inFirst, "clicking the second form's label focused the first form's control").toBe(false);
  });
}
