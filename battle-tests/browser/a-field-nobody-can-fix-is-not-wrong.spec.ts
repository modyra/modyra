/**
 * A field the user cannot touch is not a field they got wrong.
 *
 * `showsAsInvalid(flags)` is published as `!flags.valid && !flags.disabled`. One line, and it decides
 * something a person hears: whether a control announces itself as an error. A disabled field that
 * still says `aria-invalid="true"` tells a screen-reader user there is something wrong with a control
 * they are not allowed to change, and offers them nothing to do about it. The message under it says
 * the same thing to everyone else.
 *
 * The rule is easy to lose. `aria-invalid` follows validity, disabling is a separate switch, and
 * anything that caches the first while flipping the second leaves the attribute behind — visibly
 * correct in every state the developer happened to look at.
 *
 * `fieldAccessibleName(sources)` is the other rule pinned here: the first non-blank of `ariaLabel`,
 * `label` and `name`, with `nameIsAFallback` true when it came down to the name. A field nobody
 * labelled is still a field somebody has to fill in, and the name it was declared with is the last
 * thing standing between it and a control announced as nothing at all.
 */

import { expect, test } from "@playwright/test";
import { fieldAccessibleName, nameIsAFallback, showsAsInvalid } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a field that cannot be fixed does not report itself wrong, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The rule, from the function rather than from a copy of it.
    expect(showsAsInvalid({ valid: false, disabled: false }), "an invalid, enabled field does not show as invalid").toBe(true);
    expect(showsAsInvalid({ valid: false, disabled: true }), "the published rule no longer spares a disabled field").toBe(false);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("d", [{ name: "x", kind: "text", label: "X", validators: { required: true } }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const state = () => page.evaluate(() => {
      const root = document.querySelector('[data-form="d"]');
      const control = root?.querySelector("input") as HTMLInputElement | null;
      return {
        ariaInvalid: control?.getAttribute("aria-invalid") ?? null,
        disabled: control?.disabled ?? null,
        message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
      };
    });

    // Put it in the state the rule is about: wrong, and the user can do something about it.
    const control = page.locator('[data-form="d"] input').first();
    await control.focus();
    await control.blur();
    await page.waitForTimeout(340);

    const wrong = await state();
    expect(wrong.ariaInvalid, "the field did not report itself invalid, so switching it off proves nothing").toBe("true");
    expect(wrong.message, "no message was shown, so there is nothing for disabling to take away").not.toBeNull();

    // Now take the ability to fix it away.
    await page.evaluate(({ api }) =>
      (window as never as Record<string, { disable(i: string, p: string): void }>)[api].disable("d", "x"),
      { api: host.api });
    await page.waitForTimeout(360);

    const off = await state();
    expect(off.disabled, "the field was not switched off").toBe(true);
    expect(off.ariaInvalid, "a field the user cannot change still announces itself as an error").toBe("false");
    expect(off.message, "a field the user cannot change still shows what is wrong with it").toBeNull();
  });

  test(`a field nobody labelled still has a name, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // What the projection says the name is when nothing but the field's own name was given.
    const sources = { ariaLabel: undefined, label: undefined, name: "surname" };
    expect(fieldAccessibleName(sources)).toBe("surname");
    expect(nameIsAFallback(sources), "a name used because nothing else was given is not reported as a fallback").toBe(true);
    expect(nameIsAFallback({ ...sources, label: "Surname" }), "a labelled field is reported as falling back").toBe(false);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("n", [{ name: "surname", kind: "text" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    const named = await page.evaluate(() => {
      const root = document.querySelector('[data-form="n"]');
      const control = root?.querySelector("input") as HTMLInputElement | null;
      const labelledby = control?.getAttribute("aria-labelledby");
      return {
        ariaLabel: control?.getAttribute("aria-label") ?? null,
        labelledbyText: labelledby === null || labelledby === undefined
          ? null
          : (document.getElementById(labelledby)?.textContent ?? "").trim(),
      };
    });

    // However it is carried, the control is announced as something rather than as nothing.
    const announced = named.ariaLabel ?? named.labelledbyText;
    expect(announced, "a field nobody labelled is announced as nothing at all").toBe(fieldAccessibleName(sources));
  });
}
