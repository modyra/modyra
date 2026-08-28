/**
 * Whether tabbing through a required field and leaving it makes the field call itself wrong.
 *
 * Focus arriving and leaving is an act on attention, not on the value. Tab is how a person reads a
 * form, the way eyes scroll it: somebody who tabs past twenty required fields must not collect
 * twenty announcements of "invalid" for fields they were about to fill in. The test for "this person
 * has been at this field" is whether the value changed while they were there — empty to empty is
 * nothing happening.
 *
 * Two channels carry the verdict and they are read separately, because a renderer can fail in one
 * alone: `aria-invalid` on the control, which only a reader hears, and the drawn error item, which
 * only the eye sees. A field that paints a refusal while announcing itself valid has given two
 * people two different documents.
 *
 * **The control is what makes the silence mean something.** A renderer with nothing to say would
 * pass by never speaking, so the same fields are typed into and emptied first — an act on the value,
 * which must speak. The typing is verified to have moved the control's value; a `fill` a kind
 * ignores would otherwise turn the control into a second copy of the claim.
 *
 * Claims under attack: A11Y-004, UI-009.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
/** Digits and separators, so a date and a time take it as readily as a word-shaped box. */
const TYPED = "12/03/2026";
/** Every way a kind offers a place to stand, in the order a person would reach one. */
const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';

for (const host of HOSTS) {
  test(`a required field a person only read stays silent, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ api, mountId, k, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "f", kind: k, label: "L", validators: { required: true }, options,
        }] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(120);
    };

    /** Both channels, named apart: what a reader is told, and what is drawn. */
    const verdict = (id: string) => page.evaluate((mountId) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const item = root?.querySelector(".mdy-control__error") ?? null;
      return {
        announced: root?.querySelector('[aria-invalid="true"]') !== null && root !== null,
        painted: item !== null && item.getBoundingClientRect().height > 0,
      };
    }, id);

    /** Focus the field's first place to stand, then leave it. Nothing is typed. */
    const readAndLeave = (id: string) => page.evaluate(({ mountId, focusable }) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const control = root?.querySelector<HTMLElement>(focusable) ?? null;
      control?.focus();
      const reached = control !== null && root?.contains(document.activeElement) === true;
      control?.blur();
      return reached;
    }, { mountId: id, focusable: FOCUSABLE });

    const spoke: string[] = [];
    const unreachable: string[] = [];
    const changedThenSpoke: string[] = [];
    const changedThenSilent: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const read = `read_${kind}`;
      await mount(read, kind);
      if (!(await readAndLeave(read))) unreachable.push(kind);
      await page.waitForTimeout(150);
      const after = await verdict(read);
      if (after.announced || after.painted) {
        spoke.push(`${kind}${after.announced ? " announced" : ""}${after.painted ? " painted" : ""}`);
      }

      // The same field, given an act on the value: typed into and emptied again.
      const typed = `typed_${kind}`;
      await mount(typed, kind);
      const box = page.locator(`[data-form="${typed}"] input, [data-form="${typed}"] textarea`).first();
      let moved = false;
      if (await box.count() > 0) {
        const before = await box.inputValue().catch(() => null);
        await box.fill(TYPED).catch(() => undefined);
        const during = await box.inputValue().catch(() => null);
        moved = before !== null && during !== null && during !== before;
        await box.fill("").catch(() => undefined);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      }
      if (moved) {
        await page.waitForTimeout(150);
        const spoken = await verdict(typed);
        (spoken.announced || spoken.painted ? changedThenSpoke : changedThenSilent).push(kind);
      }
    }

    expect(
      changedThenSpoke.length,
      `${host.name} says nothing on any kind even after a value was typed and taken away again `
      + `(${changedThenSilent.length} kinds took a value and stayed silent), so this run cannot tell `
      + "a renderer that waits for an act on the value from one that never speaks at all",
    ).toBeGreaterThan(2);

    expect(
      spoke,
      `${host.name} calls ${spoke.length} of ${MDY_WIDGET_KINDS.length} kinds wrong after focus `
      + `arrived and left with the value untouched: ${JSON.stringify(spoke)}. Reading a form is not `
      + "declining it — the same fields speak correctly once a value has been typed and removed, so "
      + "the verdict is keyed to focus having been here rather than to the value having changed. "
      + (unreachable.length > 0
        ? `Offered no place to stand, so untested here: ${JSON.stringify(unreachable)}.`
        : "Every kind offered a place to stand."),
    ).toEqual([]);
  });
}
