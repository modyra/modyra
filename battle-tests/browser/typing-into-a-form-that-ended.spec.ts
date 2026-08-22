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

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

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

    // **Neither throws nor writes** — the test's own title, and the only two things asserted below.
    // A third assertion had crept in: that the control still *takes* the keystroke. That described
    // the world of the defect rather than the property, and it went red the day the control was
    // taken out of play — a repair reading as a regression.
    //
    // Both endings satisfy the title. A control that refuses the edit never writes; a control that
    // accepts it and discards it never writes either. The spec is blind to which, on purpose.
    const editable = await control.isEditable();
    if (editable) {
      await control.fill("typed after the end");
      await control.blur();
    }
    await page.waitForTimeout(340);

    expect(
      await held(),
      editable
        ? "the control was still editable and the form took the write, so a form that has ended is still being edited"
        : "the control was out of play, so the value the form ended with must be the value it holds",
    ).toBe('"typed while alive"');

    expect(thrown, "touching a control whose form has ended threw").toEqual([]);
  });
}
