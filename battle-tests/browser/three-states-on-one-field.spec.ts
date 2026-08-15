/**
 * Wrong, unreachable and unchangeable, on the same field at once.
 *
 * Each of the three has a rule of its own and the rules are published: `showsAsInvalid` is
 * `!valid && !disabled`, and the boolean projection says in a comment beside it that *a read-only
 * control is not disabled — it takes focus, its text can be selected and copied, and announcing it as
 * disabled tells a screen-reader user they cannot interact with something they can*.
 *
 * Apart, each is easy. Together they are three subtleties a refactor flattens:
 *
 *   - **read-only and wrong** stays wrong. The user cannot fix it here, but the form still counts it,
 *     still submits it, and the reason is still worth reading.
 *   - **disabled and wrong** is not wrong. The field is out of play, so there is nothing to fix and
 *     nothing to announce.
 *   - **disabled and read-only** is disabled. Read-only says *you may read this but not change it*,
 *     which a disabled field already implies; saying both is noise.
 *
 * Nothing in this suite drove the combinations, only the states one at a time.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`three states on one field settle the way the rules say, ${host.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Mount a required field, leave it empty so it is wrong, then apply the states asked for. */
    const settle = async (id: string, states: { readonly?: boolean; disabled?: boolean }) => {
      await page.evaluate(({ mountId, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: "text", label: "X", validators: { required: true } }]);
      }, { mountId: id, api: host.api });
      await page.waitForTimeout(200);

      const control = page.locator(`[data-form="${id}"] input`).first();
      await control.focus();
      await control.blur();
      await page.waitForTimeout(280);

      if (states.readonly === true) {
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { readonly(i: string, p: string): void }>)[api].readonly(mountId, "x"),
          { mountId: id, api: host.api });
        await page.waitForTimeout(200);
      }
      if (states.disabled === true) {
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { disable(i: string, p: string): void }>)[api].disable(mountId, "x"),
          { mountId: id, api: host.api });
        await page.waitForTimeout(220);
      }

      return page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const control = root?.querySelector("input") as HTMLInputElement | null;
        return {
          invalid: control?.getAttribute("aria-invalid") ?? null,
          disabled: control?.disabled ?? null,
          readOnly: control?.readOnly ?? null,
          message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() !== "",
        };
      }, `[data-form="${id}"]`);
    };

    // The premise: wrong on its own is wrong, and says so.
    expect(await settle("wrong", {}), "a required field left empty is not reported as wrong")
      .toEqual({ invalid: "true", disabled: false, readOnly: false, message: true });

    // Read-only and wrong: still wrong, still explained, and the user can still read the field.
    expect(
      await settle("kept", { readonly: true }),
      "a read-only field stopped being wrong, so the form counts something it no longer explains",
    ).toEqual({ invalid: "true", disabled: false, readOnly: true, message: true });

    // Disabled and wrong: not wrong. Nothing to fix, nothing to announce.
    expect(
      await settle("out", { disabled: true }),
      "a disabled field still announces itself wrong, about something nobody can change",
    ).toEqual({ invalid: "false", disabled: true, readOnly: false, message: false });

    // Both: disabled wins, and takes read-only with it rather than saying both.
    expect(
      await settle("both", { readonly: true, disabled: true }),
      "a field that is disabled and read-only reports them both, which is two answers to one question",
    ).toEqual({ invalid: "false", disabled: true, readOnly: false, message: false });
  });
}
