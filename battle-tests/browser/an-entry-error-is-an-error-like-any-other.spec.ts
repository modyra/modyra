/**
 * The error a field raises about its own text, held to the same rule as every other.
 *
 * A date field can hold text it cannot read, and that is an error the *widget* raises rather than one
 * a validator returned. `showsAsInvalid(flags)` — `!flags.valid && !flags.disabled` — does not care
 * where an error came from: a control that is switched off does not announce itself as wrong, and the
 * message under it goes with the announcement.
 *
 * A `required` field obeys that in both renderers: mark it, disable it, and both the attribute and the
 * message go. An unreadable entry does not, and not in the same way — one renderer keeps announcing a
 * control the user cannot touch, the other never announces it at all while showing the message anyway.
 *
 * The two halves are asserted separately because they are separate promises. While the field is live
 * and holding text it cannot read, it is wrong and says so. Once it is switched off, it is not the
 * user's problem and says nothing.
 *
 * The control is the same field made wrong the ordinary way, in the same renderer, in the same run:
 * whatever an entry error does differently is the entry error, not the shell.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`an entry a field cannot read is an error like any other, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, field: Record<string, unknown>) => {
      await page.evaluate(({ api, mountId, f }) => {
        (window as never as Record<string, { mountFields(i: string, x: unknown[]): unknown }>)[api]
          .mountFields(mountId, [f]);
      }, { api: host.api, mountId: id, f: field });
      await page.waitForTimeout(300);
    };
    const state = (id: string) => page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const control = root?.querySelector("input") as HTMLInputElement | null;
      return {
        ariaInvalid: control?.getAttribute("aria-invalid") ?? null,
        disabled: control?.disabled ?? null,
        message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
      };
    }, `[data-form="${id}"]`);
    const disable = async (id: string) => {
      await page.evaluate(({ api, mountId }) =>
        (window as never as Record<string, { disable(i: string, p: string): void }>)[api].disable(mountId, "x"),
        { api: host.api, mountId: id });
      await page.waitForTimeout(380);
    };

    // The control: a field made wrong the ordinary way obeys the rule in this renderer, in this run.
    await mount("ordinary", { name: "x", kind: "text", label: "X", validators: { required: true } });
    const ordinary = page.locator('[data-form="ordinary"] input').first();
    await ordinary.focus();
    await ordinary.blur();
    await page.waitForTimeout(340);
    expect((await state("ordinary")).ariaInvalid, "a required field left empty did not report itself wrong").toBe("true");
    await disable("ordinary");
    const ordinaryOff = await state("ordinary");
    expect(ordinaryOff.ariaInvalid, "the shell rule is not followed even for an ordinary error").toBe("false");
    expect(ordinaryOff.message, "an ordinary error stayed on screen after the field was switched off").toBeNull();

    // The same two questions, asked of an error the widget raises about its own text.
    await mount("entry", { name: "x", kind: "datepicker", label: "X", initialValue: "2026-04-03" });
    const entry = page.locator('[data-form="entry"] input').first();
    await entry.fill("not a date");
    await entry.blur();
    await page.waitForTimeout(340);

    const live = await state("entry");
    expect(live.message, "the field did not say it could not read what it holds").not.toBeNull();
    expect(live.ariaInvalid, "a field holding text it cannot read does not report itself wrong").toBe("true");

    await disable("entry");
    const off = await state("entry");
    expect(off.disabled, "the field was not switched off").toBe(true);
    expect(off.ariaInvalid, "a field the user cannot touch still announces itself as wrong").toBe("false");
    expect(off.message, "a field the user cannot touch still shows what is wrong with it").toBeNull();
  });
}
