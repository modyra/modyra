/**
 * The field under the cursor goes out of play, and the cursor goes to the top of the document.
 *
 * Disabling a focused element blurs it — that is the platform, not this library. What follows from it
 * is this library's: the user who was typing is now on `body`, their next Tab starts from the
 * beginning of the page, and a screen reader is told nothing about where they went.
 *
 * It is reachable without anybody clicking anything. A document's rule takes a field out of play when
 * another field changes, so a value arriving from a fetch, or a colleague's edit in the field above,
 * can empty the keyboard's position mid-word.
 *
 * The control is in the same measurement and it is what makes this a finding rather than a fact about
 * browsers: **read-only keeps the field focused**. Taking a field out of play does not have to cost
 * the user their place — one of the two ways of doing it already does not.
 *
 * `@modyra/widgets` publishes `createFocusCustodian`, `focusTrigger` and `restoreFocusTrigger`, so
 * deciding where focus should go is something this package already does elsewhere.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  disable(id: string, path: string): void;
  readonly(id: string, path: string): void;
}>;

/** Where the keyboard is, named the way a reader would find it. */
const standing = (page: import("@playwright/test").Page) => page.evaluate(() => {
  const element = document.activeElement as HTMLElement | null;
  return element === null || element === document.body
    ? "(nowhere)"
    : `${element.tagName.toLowerCase()}#${element.id || "-"}`;
});

for (const host of HOSTS) {
  test(`a field taken out of play under the cursor, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const start = async () => {
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api }) => {
        (window as never as Api)[api].mountFields("g", [
          { name: "one", kind: "text", label: "One" },
          { name: "two", kind: "text", label: "Two" },
        ]);
      }, { api: host.api });
      await page.waitForTimeout(280);
      const field = page.locator('[data-form="g"] input').first();
      await field.focus();
      await field.type("half a word");
      return field;
    };

    // The control: made read-only under the cursor, the field keeps the keyboard. So a field leaving
    // play does not have to take the user's place with it.
    await start();
    const beforeReadonly = await standing(page);
    await page.evaluate(({ api }) => (window as never as Api)[api].readonly("g", "one"), { api: host.api });
    await page.waitForTimeout(300);
    const afterReadonly = await standing(page);

    expect(beforeReadonly, "the keyboard was not in the field to begin with, so nothing below is a measurement").not.toBe("(nowhere)");
    expect(afterReadonly, "a read-only field lost the keyboard too, so this renderer never keeps it and the comparison says nothing").toBe(beforeReadonly);

    // And the same field, disabled instead.
    const field = await start();
    const beforeDisable = await standing(page);
    expect(beforeDisable, "the keyboard was not in the field to begin with").not.toBe("(nowhere)");
    await page.evaluate(({ api }) => (window as never as Api)[api].disable("g", "one"), { api: host.api });
    await page.waitForTimeout(300);

    const after = await standing(page);
    const typed = await field.inputValue();

    expect(
      after,
      `the user was typing ${JSON.stringify(typed)} and the keyboard is now ${after}: their next Tab starts from the top of the document`,
    ).not.toBe("(nowhere)");
  });
}
