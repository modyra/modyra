/**
 * A control that says it is wrong, and does not say what is wrong.
 *
 * `projectFieldShellA11y` computes the shell's accessibility from one verdict, and its own comment
 * says why: *the wrapper, the label, `aria-invalid` and whether the error text renders are four faces
 * of one question, answered once*. A control marked `aria-invalid="true"` is a control whose errors
 * are shown — by construction, not by convention.
 *
 * So the check is that one question answered consistently: wherever a field reports itself invalid,
 * the message exists on the page and the control points at it. Nothing here asserts *which* element
 * holds it or what id it carries — one renderer names it `x__errors` and another
 * `mdy-field-7__errors`, and both are right. What cannot vary is that a person is told what to fix.
 *
 * Without it a user sees a field outlined in red with no explanation, and a screen reader announces
 * "invalid" with nothing after it. There is no way to find out what the form wants except by
 * guessing.
 *
 * A field that reports itself valid is skipped rather than failed: a `required` slider holds `0`,
 * which is not empty, so it is never in this state and has nothing to say.
 *
 * Claims under attack: A11Y-004, VAL-003.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

// **Every renderer, from the shared list.** This file kept one of its own with plain and lit
// in it. That was never a scope decision: the angular host published six of the twenty-two
// doors these specs need, so a spec that wanted one it lacked left the renderer out, and the
// next reader copied the list. Sixty-eight files came to exclude it that way. The doors are
// open now.
import { HOSTS } from "./bench";

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`a field that says it is wrong says what is wrong, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const silent: string[] = [];
    const unreferenced: string[] = [];
    let invalidSeen = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `v-${kind}`;
      await page.evaluate(({ mountId, k, api, options }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options, validators: { required: true } }]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS });
      await page.waitForTimeout(220);

      // Touch it the way a user does: arrive, then leave without filling it in.
      const control = page.locator(`[data-form="${id}"] [aria-invalid], [data-form="${id}"] input, [data-form="${id}"] select`).first();
      if (await control.count() > 0) {
        await control.focus().catch(() => undefined);
        await control.blur().catch(() => undefined);
      }
      await page.waitForTimeout(300);

      const seen = await page.evaluate((sel) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        const invalid = Array.from(root.querySelectorAll('[aria-invalid="true"]'));
        if (invalid.length === 0) return { invalid: false };
        // The message, wherever it is on the page: a renderer may place its overlay elsewhere.
        const message = Array.from(document.querySelectorAll("*"))
          .find((each) => each.children.length === 0 && /required/i.test(each.textContent ?? ""));
        const holder = message?.id !== "" && message?.id !== undefined
          ? message
          : message?.parentElement ?? null;
        const referenced = invalid.some((each) => {
          const described = (each.getAttribute("aria-describedby") ?? "").split(/\s+/);
          const errorMessage = (each.getAttribute("aria-errormessage") ?? "").split(/\s+/);
          return holder !== null && holder.id !== "" && [...described, ...errorMessage].includes(holder.id);
        });
        return { invalid: true, hasMessage: message !== undefined, referenced };
      }, `[data-form="${id}"]`);

      if (seen?.invalid === true) {
        invalidSeen += 1;
        if (!seen.hasMessage) silent.push(kind);
        else if (!seen.referenced) unreferenced.push(kind);
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(70);
    }

    // The control: fields did reach the invalid state. A run where none did would report nothing
    // silent and nothing unreferenced, and mean nothing by either.
    expect(invalidSeen, "no field reported itself invalid, so nothing was measured").toBeGreaterThan(10);

    expect(
      { silent, unreferenced },
      "a field reported itself invalid without saying what is wrong, or without pointing at it",
    ).toEqual({ silent: [], unreferenced: [] });
  });
}
