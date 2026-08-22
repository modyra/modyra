/**
 * A field that was wrong before the user arrived.
 *
 * Most wrong fields are wrong because somebody typed something. Some are wrong on arrival: an initial
 * value the shape refuses, a draft restored from an older schema, a value a server sent back. Nobody
 * touched them, and nobody may ever touch them — the user has no reason to visit a field they did not
 * fill in.
 *
 * `projectFieldShellA11y` treats the mark and the message as one answer: *the wrapper, the label,
 * `aria-invalid` and whether the error text renders are four faces of one question, answered once*.
 * Withholding one and not the other is the case that comment rules out, and it is the case a form
 * reaches by being restored rather than typed into.
 *
 * The reason is not lost — touching the field brings it, and so does attempting a submission. What
 * is missing is finding out *by looking*: between arriving and acting, the control is marked wrong
 * with nothing beside it and the form-level summary is empty as well. The mark is answered on
 * arrival and the message on interaction, from a verdict the projection says is answered once.
 *
 * The control is the same field after a touch, which must show the message in both renderers —
 * otherwise this would be about a page that shows no messages at all, which is finding 125.
 *
 * Claims under attack: UI-008.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`a field wrong on arrival says why, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // A value the field's own shape refuses, present before anybody arrives — arriving the way such a
    // value actually arrives.
    //
    // Not as the document's `initialValue`: that door drops it and warns, deliberately and with the
    // reasoning written where it is done — *"kept, it made a form that was invalid before anybody
    // touched it, the field reporting 'holds string' about a value the user never entered and cannot
    // see how to correct"*. A declaration that cannot hold its own value is a defect of the document,
    // and the person reading the page cannot fix it.
    //
    // A value from a **draft, a server or a scripted write** is a fact of the world instead. It is
    // kept and marked, which is what `valueShape` is for, and it is the case this battle is about:
    // the header names all three doors and only this one leaves the value there to be explained.
    await page.evaluate(({ api }) => {
      const host = (window as never as Record<string, Record<string, (...args: unknown[]) => unknown>>)[api];
      host.mountFields("t", [{ name: "age", kind: "number", label: "Age" }] as never);
      host.setValue("t", { age: "not a number" });
    }, { api: host.api });
    await page.waitForTimeout(420);

    const state = () => page.evaluate(() => {
      const root = document.querySelector('[data-form="t"]');
      const control = root?.querySelector("input") as HTMLInputElement | null;
      return {
        marked: control?.getAttribute("aria-invalid") ?? null,
        message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
      };
    });

    const onArrival = await state();

    // The premise: the form did read the value as wrong. Otherwise there is nothing to explain.
    expect(onArrival.marked, "a value the shape refuses did not mark the control wrong").toBe("true");

    expect(
      onArrival.message,
      "the control is marked wrong and the reason is withheld, over a value the person never typed",
    ).not.toBeNull();

    // The control: after a touch the message is there in both, so the withholding above is about
    // *when* rather than about a page that cannot show messages.
    const control = page.locator('[data-form="t"] input').first();
    await control.focus();
    await control.blur();
    await page.waitForTimeout(340);

    expect((await state()).message, "the message is missing even after the field was touched")
      .toContain("This field holds number");
  });
}
