/**
 * What a person hears while stepping a quantity down.
 *
 * A counter chip holds a quantity and two controls that change it. Stepping down removes one, and
 * stepping down from one removes the value itself. Every step is the same key on the same control,
 * and the last one is a different operation with a different blast radius.
 *
 * **Only the last one says anything.** The steps before it are silent — the chip's accessible name
 * changes, which a screen reader does not announce on its own, and the live region stays empty. Then
 * the step that deletes announces a removal. So a person stepping down hears nothing, nothing, and
 * then that their value is gone.
 *
 * That is the asymmetric-consequence problem this control has already met with a pointer, arriving in
 * the keyboard: there, a small destructive target sat inside a large benign one; here a destructive
 * operation sits inside a benign key, and the boundary that switches them is imperceptible until it
 * is crossed. Someone holding the key down to reach a small number overshoots into deletion, which is
 * what a floor exists to prevent.
 *
 * **The range has to be stated, and this file does not say by what mechanism.** A first version asked
 * for `aria-valuemin` — which is the `spinbutton` vocabulary ADR 0138 removed on purpose, because a
 * role that carries a value cannot also carry a position, and a chip needs to say where it stands in
 * the strip. Asserting the attribute back would have been a spec demanding the arrangement a decision
 * record had replaced: the same shape as a fixture built against an anatomy that has moved, and no
 * more correct for being written afterwards.
 *
 * So the property is asserted where it now lives — the control says it has reached the floor, in the
 * words it says everything else in. **Announced on arrival, not on crossing**: warning at the moment
 * of deletion is too late, because the value is already gone and the person is being told rather than
 * asked. Reaching the minimum speaks, so the next step down is a known destructive act.
 *
 * Two things are asserted and they fail independently: **every step that changes the value says so**,
 * and **arriving at the floor says that too**. A control that announced only its steps would still
 * let someone walk off the edge without warning.
 *
 * Whether stepping to zero *should* remove at all is a product question and this file does not decide
 * it. Under every answer to it, a step that changes a value silently is a defect.
 *
 * Claims under attack: A11Y-004, UI-007.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`every step of a quantity is announced, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 500 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("steps", [{
        name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        // Three of one and one of another: enough steps that a decrement which is not the last one
        // exists to be measured. With a quantity of one, every step is the deleting step.
        initialValue: ["a", "a", "a", "b"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="steps"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const chip = page.locator('[data-form="steps"] .mdy-chip').first();
    await chip.focus();

    const state = () => page.evaluate(({ api }) => ({
      held: JSON.stringify((window as never as Api)[api].valueOf("steps" as never)),
      said: Array.from(document.querySelectorAll('[data-form="steps"] [role="status"], [data-form="steps"] [aria-live]'))
        .map((element) => (element.textContent ?? "").trim()).filter((text) => text !== ""),
      min: document.querySelector('[data-form="steps"] .mdy-chip')?.getAttribute("aria-valuemin") ?? null,
    }), { api: host.api });

    const before = await state();
    // Without a quantity above one there is no non-deleting step, and the silence this file is about
    // could not occur.
    expect(before.held, `${host.name} did not take a repeated value, so no step here is a step`).toContain('"a","a"');

    const silent: string[] = [];
    for (let step = 1; step <= 2; step += 1) {
      const was = await state();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(450);
      const now = await state();
      if (now.held === was.held) continue;
      if (now.said.join(" ") === was.said.join(" ")) silent.push(`step ${step}: ${was.held} → ${now.held}, and nothing was said`);
    }

    expect(
      silent,
      `${host.name}: ${silent.length} step(s) changed the value without announcing it — ${silent.join("; ")}. `
      + "The step that deletes does announce, so a person stepping down hears nothing until their value is gone.",
    ).toEqual([]);

    // Down to the floor, then read what the control says about being there. The wording is the
    // renderer's own; what this asserts is that arriving at the boundary is said at all.
    let guard = 0;
    while (guard < 6) {
      const was = await state();
      if (!was.held.includes('"a","a"')) break;
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(450);
      guard += 1;
    }
    const atFloor = await state();

    expect(
      atFloor.said.join(" ").toLowerCase(),
      `${host.name}: the quantity is at its floor and the control says "${atFloor.said.join(" ")}" — `
      + "nothing marks the boundary, so the last step before deletion is indistinguishable from every "
      + "step before it, and a person holding the key walks off the edge.",
    ).toMatch(/min|floor|last|1$|, 1\b/);
  });
}
