/**
 * What two forms of one shape do to each other when nothing is said about ids.
 *
 * Two mounts of one document over one set of field names. Nobody names a scope, which is the default
 * and the state an application reaches first — the same editor placed twice, a filter beside a form,
 * a comparison of two records, a dialog over a page.
 *
 * **Each form carries a scope of its own whether or not anyone asked** ([ADR
 * 0146](../../docs/architecture/0146-a-form-carries-its-own-scope.md)), so the second form's label
 * points at the second form's control. The property this file holds is that the *unscoped* case and
 * the scoped one now behave alike: naming a scope changes what the ids are, not whether they
 * collide.
 *
 * That equivalence is the whole point and it is why the two tests below read almost identically to
 * the scoped one above them. A file where they diverged would be recording that the default is worse
 * than the option, which is the state the record was written to end.
 *
 * **Three symptoms, and they fail independently**, because a repair can reach one and miss the
 * others: no duplicate id on the page; the second form's label resolving into the second form; and a
 * click on that label moving focus into the second form. The first is what a validator sees, the
 * second is what a screen reader follows, and the third is what a person meets with no assistive
 * technology at all.
 *
 * **Each asserts a premise first**, because every one of the three is satisfied by an empty page: no
 * duplicates, no stray label and no stray focus are all true of a document with nothing in it. The
 * premise is that both forms really rendered controls.
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

test("unscoped, the two forms share no id and every label stays at home", async ({ page }) => {
  await mountTwo(page, false);

  // The premise: both forms really are on the page. Every assertion below is true of an empty one.
  expect(
    await page.evaluate(() => window.battle.controlCount()),
    "fewer than two controls rendered, so nothing here could collide and nothing is being measured",
  ).toBeGreaterThan(1);

  // The visible half: a document with two of every id is simply invalid.
  expect(
    await page.evaluate(() => window.battle.duplicateIds()),
    "two forms of one document publish the same ids, so every reference in one of them resolves "
    + "into whichever rendered first",
  ).toEqual([]);

  // The quiet half, and the one that reaches a person: a label resolving into the other form makes a
  // screen reader announce one field while the user is in another.
  const owner = await page.evaluate(() => {
    const label = document.querySelector('[data-form="second"] label') as HTMLLabelElement | null;
    const target = label ? document.getElementById(label.htmlFor) : null;
    return (target?.closest("[data-form]") as HTMLElement | null)?.dataset.form ?? null;
  });
  expect(owner, "the second form's label names a control in another form").toBe("second");
});

test("unscoped, a click on the second form's label lands in the second", async ({ page }) => {
  await mountTwo(page, false);

  expect(
    await page.evaluate(() => window.battle.controlCount()),
    "fewer than two controls rendered, so a click cannot land in the wrong one",
  ).toBeGreaterThan(1);

  await page.locator('[data-form="second"] label').first().click();
  const focused = await page.evaluate(
    () => (document.activeElement?.closest("[data-form]") as HTMLElement | null)?.dataset.form ?? null,
  );

  // The consequence a user meets without any assistive technology at all: pressing a label puts the
  // caret in the control it names, and it must be the one beside it.
  expect(
    focused,
    "pressing the second form's label moved the caret into another form, which a person sees happen "
    + "and cannot explain",
  ).toBe("second");
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
