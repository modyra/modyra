/**
 * A field an application has put out of the user's hands.
 *
 * Read-only is not disabled. A disabled field is out of play — not submitted, not announced as wrong,
 * skipped by the keyboard. A read-only one is fully in play: it is submitted, it counts towards
 * validity, it is reachable and readable. The single thing it must not do is change.
 *
 * So there are two promises, and they fail apart. **Holding** is the one with consequences: an
 * application that made a value read-only has decided the user may not set it, and a control that
 * takes the click anyway has overruled that decision silently. **Saying so** is the other: a field
 * that holds its value while looking editable invites the user to try, and tells someone using a
 * screen reader nothing at all.
 *
 * `text-field-a11y.ts` declares `aria-readonly` and the native controls carry `readOnly`, so the
 * vocabulary exists. This asks every kind for both promises.
 *
 * Which kinds owe the second one is not this spec's opinion. `stateCarriers(kind, "readonly")` names
 * the part that exposes the state, per kind, and answers with nothing for a kind that has none —
 * `file`, whose picker is the browser's and whose element has no `aria-readonly` to carry. Both
 * directions are asserted, because an undeclared state asserted is as much a defect as a declared
 * state unchecked: a kind the table names must say it, and a kind it does not must not.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS, stateCarriers } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/**
 * Kinds a click can change without opening anything first, each with the control to click.
 *
 * Named per kind rather than found generically: a field's container also holds the submit button the
 * host puts beside it, and a generic "first input or button" lands on the wrong element often enough
 * to turn a defect into a pass.
 */
const CLICKABLE = Object.freeze([
  { kind: "checkbox", control: 'input[type="checkbox"]' },
  { kind: "toggle", control: 'input[type="checkbox"]' },
  { kind: "radio", control: 'input[type="radio"]' },
  { kind: "segmented", control: 'input[type="radio"]' },
  { kind: "slider", control: 'input[type="range"]' },
]);

for (const host of HOSTS) {
  test(`a read-only field holds its value, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const changed: string[] = [];
    const inert: string[] = [];

    for (const { kind, control } of CLICKABLE) {
      const value = (id: string) => page.evaluate(({ api, mountId }) =>
        JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).x),
        { api: host.api, mountId: id });

      const run = async (id: string, readonly: boolean) => {
        await page.evaluate(({ mountId, k, api }) => {
          (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }]);
        }, { mountId: id, k: kind, api: host.api });
        await page.waitForTimeout(220);
        if (readonly) {
          await page.evaluate(({ mountId, api }) =>
            (window as never as Record<string, { readonly(i: string, p: string): void }>)[api].readonly(mountId, "x"),
            { mountId: id, api: host.api });
          await page.waitForTimeout(240);
        }
        const before = await value(id);
        // The field's own control, named for this kind.
        await page.locator(`[data-form="${id}"] ${control}`).last().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(180);
        // And the keyboard, which is a second way in that a pointer guard alone does not close.
        await page.locator(`[data-form="${id}"] ${control}`).last().focus().catch(() => undefined);
        await page.keyboard.press("ArrowRight").catch(() => undefined);
        await page.waitForTimeout(300);
        const after = await value(id);
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
          { mountId: id, api: host.api });
        await page.waitForTimeout(60);
        return before !== after;
      };

      // The control: the same click on the same kind, left editable, does change it. Without this a
      // control nothing can move would look like a read-only field behaving perfectly.
      if (!(await run(`live-${kind}`, false))) inert.push(kind);
      if (await run(`ro-${kind}`, true)) changed.push(kind);
    }

    expect(inert, "a click changed nothing even while the field was editable, so the holding below proves nothing")
      .toEqual([]);

    expect(changed, "a read-only field took the click and changed, so an application's decision was overruled")
      .toEqual([]);
  });

  test(`a read-only field says it is read-only, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const silent: string[] = [];
    const spoke: string[] = [];

    // Split by what the contract declares rather than by what this spec expects.
    const declares = MDY_WIDGET_KINDS.filter((kind) => stateCarriers(kind, "readonly").length > 0);
    const declaresNone = MDY_WIDGET_KINDS.filter((kind) => stateCarriers(kind, "readonly").length === 0);

    expect(declares.length, "no kind declares a read-only carrier, so there is nothing to ask for").toBeGreaterThan(0);
    expect(declaresNone.length, "every kind declares one, so the second direction below is untested").toBeGreaterThan(0);

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `s-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(200);

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { readonly(i: string, p: string): void }>)[api].readonly(mountId, "x"),
        { mountId: id, api: host.api });
      await page.waitForTimeout(240);

      const says = await page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const controls = Array.from(root?.querySelectorAll('input, textarea, select, [role="combobox"], [role="radiogroup"], [role="group"]') ?? []);
        return controls.some((each) =>
          each.getAttribute("aria-readonly") === "true" || (each as HTMLInputElement).readOnly === true);
      }, `[data-form="${id}"]`);

      if (declares.includes(kind) && !says) silent.push(kind);
      if (declaresNone.includes(kind) && says) spoke.push(kind);

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(50);
    }

    // The control: some kinds do say it, so the silence below is those kinds rather than a state
    // that never arrived.
    expect(silent.length, "no kind reported itself read-only, so the state never reached the page at all")
      .toBeLessThan(declares.length);

    expect(silent, "a read-only field the contract says can announce itself looks editable and says nothing, so a reader is not told and a user is invited to try")
      .toEqual([]);

    // And the other direction: a kind with no carrier must not announce a state its element cannot
    // honestly wear.
    expect(spoke, "a kind the contract gives no read-only carrier announced itself read-only anyway")
      .toEqual([]);
  });
}
