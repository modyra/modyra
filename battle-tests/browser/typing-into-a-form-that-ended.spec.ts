/**
 * The window between a form ending and its controls leaving the page.
 *
 * A framework destroys a model and removes its nodes as two steps, and they are not the same
 * instant: an `ngOnDestroy` runs, an animation plays out, a scheduler gets to the removal on the next
 * frame. In between, the controls are still on the page and still bound to a form that has ended, and
 * whatever the user does reaches it — a keystroke already in flight, a blur, a click on the thing
 * they were already reaching for.
 *
 * What must not happen is either extreme. A control that throws takes the page down over a form
 * nobody is using; a control that writes puts a value into a model that has stopped telling anyone
 * about it, so the last thing the user typed is kept somewhere nothing will ever read.
 *
 * The engine's side of this is settled — a destroyed form answers with what it held and takes no more
 * writes. This is the same question asked of the page, which is where a user meets it.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a control outliving its form neither throws nor writes, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const thrown: string[] = [];
    page.on("pageerror", (error) => thrown.push(String(error.message).slice(0, 120)));

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("d", [{ name: "who", kind: "text", label: "Who", initialValue: "lorenzo" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const held = () => page.evaluate(({ api }) => {
      try {
        return JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("d").who);
      } catch {
        return "threw";
      }
    }, { api: host.api });

    // The control: while the form is alive, typing does reach it. Otherwise "the model did not
    // change" below would be true of a page where typing never changes anything.
    const control = page.locator('[data-form="d"] input').first();
    await control.fill("typed while alive");
    await control.blur();
    await page.waitForTimeout(300);
    expect(await held(), "typing did not reach the model even while the form was alive").toBe('"typed while alive"');

    // End the form and leave the controls where they are.
    await page.evaluate(({ api }) =>
      (window as never as Record<string, { destroyFormOnly(i: string): void }>)[api].destroyFormOnly("d"),
      { api: host.api });
    await page.waitForTimeout(320);

    expect(await page.evaluate(() => document.querySelectorAll('[data-form="d"] input').length),
      "the controls left the page with the form, so there is no window to test").toBe(1);

    await control.fill("typed after the end");
    await control.blur();
    await page.waitForTimeout(340);

    expect(await page.evaluate(() => (document.querySelector('[data-form="d"] input') as HTMLInputElement | null)?.value),
      "the control refused the keystroke rather than taking it").toBe("typed after the end");

    expect(await held(), "a form that has ended took a write, so the last thing typed is kept where nothing reads it")
      .toBe('"typed while alive"');

    expect(thrown, "touching a control whose form has ended threw").toEqual([]);
  });
}
