/**
 * A widget that has been turned off, asked to open anyway.
 *
 * `MDY_DISABLED_BLOCKS_TRANSITIONS` is published as `true`: a disabled widget makes none of the moves
 * its transition table declares. It is one line of contract with a large consequence — a disabled
 * date field whose calendar still opens is a value the application decided the user may not change,
 * offered to them behind a control that looks inert.
 *
 * The constant was named nowhere in this suite, and neither was the behaviour. So each kind that
 * declares transitions is turned off and then pointed at, everywhere it could be opened from: the
 * part the table names, the toggle beside it, the control itself.
 *
 * The control is the same field left alone, which must open. Without it a renderer that had simply
 * stopped opening anything would pass this as a disabled field behaving perfectly.
 */

import { expect, test } from "@playwright/test";
import { MDY_DISABLED_BLOCKS_TRANSITIONS, MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** Every kind with a state to be blocked from reaching. */
const KINDS = Object.entries(MDY_WIDGET_TRANSITIONS)
  .filter(([, transitions]) => transitions.length > 0)
  .map(([kind]) => kind);

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`a disabled widget makes none of its moves, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise: the contract still says a disabled widget stays put. If this became false, this
    // spec would be asserting a rule nobody makes.
    expect(MDY_DISABLED_BLOCKS_TRANSITIONS, "the contract no longer blocks transitions when disabled").toBe(true);
    expect(KINDS.length, "no kind declares a transition to block").toBeGreaterThan(0);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ mountId, k, api, options }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options }]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS });
      await page.waitForTimeout(280);
    };
    const expanded = (id: string) => page.evaluate((sel) =>
      document.querySelector(`${sel} [aria-expanded="true"]`) !== null, `[data-form="${id}"]`);
    /** Point at everything this field could be opened from. */
    const pointAtEverything = async (id: string) => {
      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(220);
        if (await expanded(id)) return true;
      }
      return false;
    };
    const dispose = (id: string) => page.evaluate(({ mountId, api }) =>
      (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
      { mountId: id, api: host.api });

    const openedWhileDisabled: string[] = [];
    const refusedWhileEnabled: string[] = [];

    for (const kind of KINDS) {
      // The control first: left alone, this field opens.
      const live = `on-${kind}`;
      await mount(live, kind);
      const native = await page.evaluate((sel) =>
        document.querySelector(`${sel} [aria-expanded]`) === null, `[data-form="${live}"]`);
      if (!native && !(await pointAtEverything(live))) refusedWhileEnabled.push(kind);
      await dispose(live);

      // And the same field, switched off.
      const off = `off-${kind}`;
      await mount(off, kind);
      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { disable(i: string, p: string): void }>)[api].disable(mountId, "x"),
        { mountId: off, api: host.api });
      await page.waitForTimeout(280);

      if (await pointAtEverything(off)) openedWhileDisabled.push(kind);
      await dispose(off);
      await page.waitForTimeout(80);
    }

    // A renderer that stopped opening anything would otherwise pass this file perfectly.
    expect(refusedWhileEnabled, "a field that was not disabled refused to open, so the refusals below prove nothing")
      .toEqual([]);

    expect(openedWhileDisabled, "a disabled widget opened when it was pointed at").toEqual([]);
  });
}
