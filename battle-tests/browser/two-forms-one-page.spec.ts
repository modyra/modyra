/**
 * What two forms of one shape do to each other when nothing is said about ids.
 *
 * `plain-lifecycle` proves the scoped case: given an `idPrefix` each, two forms over the same field
 * names keep their labels pointing at their own controls. This records the other case, because the
 * option is opt-in and unset is the default.
 *
 * The behaviour is deliberate and `MountMdyFormOptions.idPrefix` says so in its own words — *the
 * second form's relationships silently resolve to the first form's elements; neither form examined
 * alone looks wrong, which is why only a page holding both can detect it.* So this is not a claim
 * that the default is wrong. It is the consequence written down where it can be seen: sixteen
 * duplicate ids on a page with two of one form, every label in the second resolving into the first,
 * and a click on the second form's label moving focus into the first.
 *
 * It is measured rather than asserted as a defect because the decision is taken. What is missing is
 * not the option — it is that no guide mentions it, so the first page an application writes with the
 * same editor twice is the broken one.
 */

import { expect, test } from "@playwright/test";

const settled = async (page: import("@playwright/test").Page) => {
  // Two frames: the renderer's own settle beat, then the one that would show its consequence.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

const mountTwo = async (page: import("@playwright/test").Page, scoped: boolean) => {
  await page.evaluate((withPrefix) => {
    window.battle.mount("first", withPrefix ? { key: "a", idPrefix: "first" } : { key: "a" });
    window.battle.mount("second", withPrefix ? { key: "a", idPrefix: "second" } : { key: "a" });
  }, scoped);
  await settled(page);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("scoped, the two forms share no id and each label stays at home", async ({ page }) => {
  await mountTwo(page, true);

  // The control: both forms are really on the page.
  expect(await page.evaluate(() => window.battle.controlCount())).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.battle.duplicateIds())).toEqual([]);

  const owner = await page.evaluate(() => {
    const label = document.querySelector('[data-form="second"] label') as HTMLLabelElement | null;
    const target = label ? document.getElementById(label.htmlFor) : null;
    return (target?.closest("[data-form]") as HTMLElement | null)?.dataset.form ?? null;
  });
  expect(owner).toBe("second");
});

test("unscoped, every id is shared and every label points at the first form", async ({ page }) => {
  await mountTwo(page, false);

  // The duplicates are the visible half: a document with two of every id is simply invalid.
  const duplicates = await page.evaluate(() => window.battle.duplicateIds());
  expect(duplicates.length).toBeGreaterThan(0);

  // The quiet half, and the one that reaches a person: the second form's label resolves into the
  // first form, so a screen reader announces one field while the user is in another.
  const owner = await page.evaluate(() => {
    const label = document.querySelector('[data-form="second"] label') as HTMLLabelElement | null;
    const target = label ? document.getElementById(label.htmlFor) : null;
    return (target?.closest("[data-form]") as HTMLElement | null)?.dataset.form ?? null;
  });
  expect(owner).toBe("first");
});

test("unscoped, a click on the second form's label lands in the first", async ({ page }) => {
  await mountTwo(page, false);

  await page.locator('[data-form="second"] label').first().click();
  const focused = await page.evaluate(
    () => (document.activeElement?.closest("[data-form]") as HTMLElement | null)?.dataset.form ?? null,
  );

  // The consequence a user meets without any assistive technology at all.
  expect(focused).toBe("first");
});

declare global {
  interface Window {
    battle: {
      mount(id: string, options?: { key?: string; idPrefix?: string }): string;
      duplicateIds(): string[];
      controlCount(): number;
    };
  }
}
