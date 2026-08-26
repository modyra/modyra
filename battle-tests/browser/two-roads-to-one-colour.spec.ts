/**
 * Whether the two ways of naming a colour leave the field in the same state.
 *
 * A colour can be typed, as six characters, or chosen from something that shows colours. Those are
 * different acts for a person — one is spelling, the other is looking — and they are the same act for
 * the field: at the end of either, it holds a colour. A person who typed and a person who pointed have
 * done the same thing, and what the form sends must not remember which.
 *
 * **This says nothing about how many roads there should be.** How a colour that is not among the
 * offered ones is reached is a product decision, and one is being taken: a way through to the
 * platform's own picker is being added, and the panel will show what a typed colour looks like. This
 * file has no opinion on any of that. It fixes the one thing the decision cannot change without
 * changing what a colour field is — **that the roads meet.**
 *
 * That is worth holding now rather than after, because it is exactly what a new road can break. A
 * third way in that produced a colour the other two spell differently, or that left some mark of how
 * it was chosen, would give the same field two states for one value; and the difference would show up
 * far from here, in what a form sends or in whether two people's answers compare equal.
 *
 * **Both roads are asserted to have moved the value**, because two roads that do nothing agree
 * perfectly. And the colour used is not one of the offered ones, so neither road can be satisfied by
 * a shortcut that only knows about those.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .colors.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

/** Not a colour anything offers, so neither road can be satisfied by knowing the offered ones. */
const WANTED = "#3d7a52";

for (const host of HOSTS) {
  test(`a colour typed and a colour chosen leave the same field, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const mount = async (id: string) => {
      await page.setViewportSize({ width: 1_200, height: 700 });
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, mountId }) => {
        (window as never as Api)[api].mountFields(mountId, [{ name: "c", kind: "colors", label: "Colore" }] as never);
      }, { api: host.api, mountId: id });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);
    };

    const held = (id: string) => page.evaluate(({ api, mountId }) =>
      JSON.stringify(((window as never as Api)[api].valueOf as unknown as (one: string) => Record<string, unknown>)(mountId)?.c),
      { api: host.api, mountId: id });

    // Spelled: the box a person types six characters into.
    await mount("typed");
    const beforeTyped = await held("typed");
    const box = page.locator(`[data-form="typed"] .${classOf("hexInput")}`).first();
    expect(await box.count(), `${host.name} draws no box to type a colour into`).toBeGreaterThan(0);
    await box.fill(WANTED);
    await box.blur().catch(() => undefined);
    await page.waitForTimeout(500);
    const typed = await held("typed");

    // Chosen: the control that carries a colour, told a colour the way anything that shows colours
    // tells it. What opens that control is the product decision; that it exists and answers is not.
    await mount("chosen");
    const beforeChosen = await held("chosen");
    const answered = await page.evaluate(({ mountId, control, wanted }) => {
      const native = document.querySelector(`[data-form="${mountId}"] .${control}`) as HTMLInputElement | null;
      if (native === null) return false;
      native.value = wanted;
      native.dispatchEvent(new Event("input", { bubbles: true }));
      native.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { mountId: "chosen", control: classOf("control"), wanted: WANTED });
    expect(answered, `${host.name} draws no control that carries a colour`).toBe(true);
    await page.waitForTimeout(500);
    const chosen = await held("chosen");

    // Both roads did something. Two roads that leave the field untouched agree about nothing.
    expect(
      typed,
      `${host.name}: typing a colour left the field holding ${typed}, which is what it held before, so `
      + "that road did nothing and the agreement below would be about a field nobody changed",
    ).not.toBe(beforeTyped);
    expect(
      chosen,
      `${host.name}: choosing a colour left the field holding ${chosen}, which is what it held before, `
      + "so that road did nothing and the agreement below would be about a field nobody changed",
    ).not.toBe(beforeChosen);

    expect(
      typed,
      `${host.name}: a colour typed leaves the field holding ${typed} and the same colour chosen `
      + `leaves it holding ${chosen}. They are the same colour and the same act, and the field is `
      + "remembering which road it came by — so what a form sends, and whether two people's answers "
      + "compare equal, depends on how each of them happened to name it.",
    ).toBe(chosen);
  });
}
