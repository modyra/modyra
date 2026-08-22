/**
 * The same value, typed and given, judged two different ways.
 *
 * A date field refuses text it cannot read: the entry is flagged, the model keeps `null`, and the
 * form will not send. That path is well made — it is finding 121's repair.
 *
 * The other way in is not the keyboard. `patchValue` is what an application calls when a fetch
 * answers, when a related field changes, when a draft is restored. The same string arriving that way
 * is taken into the model, the control is marked valid, no message is shown, and the form sends it.
 *
 * `MDY_VALUE_CONTRACTS.datepicker` is `{shape: "string"}`, so a shape check cannot object: every
 * string is a string. The readability check that does object lives on the typed path alone.
 *
 * A colour field does the same and adds a second face: the model holds `banana`, the swatch shows
 * `#000000`, and what is sent is `banana`. The page shows one thing and the form sends another.
 *
 * What must not vary is the verdict. Whether a value is one this field can hold is a question about
 * the value, and the answer cannot depend on which door it came through.
 *
 * Claims under attack: VAL-004, UI-006.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`a value refused when typed is refused when given, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string) => {
      await page.evaluate(({ mountId, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "when", kind: "datepicker", label: "When" }]);
      }, { mountId: id, api: host.api });
      await page.waitForTimeout(280);
    };
    const verdict = (id: string) => page.evaluate(({ sel, api, mountId }) => {
      const root = document.querySelector(sel);
      const control = root?.querySelector("input") as HTMLInputElement | null;
      return {
        model: JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).when),
        marked: control?.getAttribute("aria-invalid") ?? null,
      };
    }, { sel: `[data-form="${id}"]`, api: host.api, mountId: id });

    // Typed: the well-made path, and the control for what follows.
    await mount("typed");
    const box = page.locator('[data-form="typed"] input').first();
    await box.fill("not a date");
    await box.blur();
    await page.waitForTimeout(340);

    const whenTyped = await verdict("typed");
    expect(whenTyped.marked, "a date field stopped objecting to text it cannot read, so there is no asymmetry left")
      .toBe("true");

    // Given: the same string, from where an application puts one.
    await mount("given");
    await page.evaluate(({ api }) =>
      (window as never as Record<string, { setValue(i: string, p: unknown): void }>)[api]
        .setValue("given", { when: "not a date" }), { api: host.api });
    await page.waitForTimeout(340);

    expect(
      (await verdict("given")).marked,
      "the same value the field refuses from the keyboard is accepted when an application gives it",
    ).toBe(whenTyped.marked);
  });

  test(`a form does not send what its controls are not showing, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("c", [{ name: "hue", kind: "colors", label: "Hue" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    await page.evaluate(({ api }) =>
      (window as never as Record<string, { setValue(i: string, p: unknown): void }>)[api].setValue("c", { hue: "banana" }),
      { api: host.api });
    await page.waitForTimeout(340);

    const shown = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-form="c"] input')).map((each) => (each as HTMLInputElement).value));
    const held = await page.evaluate(({ api }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("c").hue,
      { api: host.api });

    // The premise: the model kept what it was given, which is UI-006 and is right.
    expect(held, "the widget rewrote the model to make itself consistent").toBe("banana");

    expect(
      shown,
      "a control shows a colour the form does not hold, so the page and the value disagree and only the page is visible",
    ).toContain("banana");
  });
}
