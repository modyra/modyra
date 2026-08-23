/**
 * What the rest of the form does when one value is removed.
 *
 * Undoing a removal has to be offered somewhere, and today it is offered on a row that appears
 * beneath the field. The field keeps its own height — and everything under it moves down by the
 * height of that row.
 *
 * **A form that reflows when a value is removed is a form nobody can use quickly.** The next control
 * is not where it was a moment ago: a person reaching for it with a pointer misses, a person who had
 * just read it has to find it again, and anyone removing several values in a row watches the page
 * step down each time. It is worse than a control that is permanently taller, because a fixed cost is
 * something the eye learns and a moving one is not.
 *
 * The same appearance also takes the region a validation message uses, so an error and a way back
 * cannot both be shown — and the one that loses is the error.
 *
 * **Two things are asserted, and the second is the one a naive repair fails.** Nothing below the field
 * may move; and the controls at the field's own trailing edge may not move sideways either. An undo
 * that materialises in the row rather than beneath it fixes the first and breaks the second — the box
 * stops growing downward and starts shifting along, which is the same defect on a different axis. A
 * slot that is always there, empty at rest, satisfies both.
 *
 * Measured on the model rather than assumed: the removal is driven through the control a person would
 * press, and the reading is taken after the page has settled, so a row that appears and then collapses
 * is not reported as a shift that stayed.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`removing a value moves nothing else, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("settled", [
        {
          name: "m", kind: "multiselect", label: "Scelte", clearable: true,
          options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }],
          // Two, so removing one leaves the strip populated and the field's own height unchanged.
          initialValue: ["a", "b"],
        },
        // Something after it, because "nothing moves" is a claim about the form and not the field.
        { name: "after", kind: "text", label: "Dopo" },
      ] as never);
    }, { api: host.api });

    await page.locator('[data-form="settled"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const geometry = () => page.evaluate(() => {
      const at = (selector: string) => {
        const element = document.querySelector(`[data-form="settled"] ${selector}`);
        if (element === null) return null;
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), height: Math.round(box.height) };
      };
      return {
        field: at(".mdy-renderer--multiselect .mdy-input-wrapper"),
        below: at(".mdy-renderer--text"),
        clearAll: at(".mdy-multiselect__clear-all"),
        arrow: at(".mdy-multiselect__arrow"),
      };
    });

    const before = await geometry();
    expect(before.field, `${host.name} drew no field to measure`).not.toBeNull();
    expect(before.below, `${host.name} drew nothing below the field, so nothing could move`).not.toBeNull();

    await page.locator('[data-form="settled"] .mdy-chip__remove').first().click({ force: true, timeout: 5_000 });
    await page.waitForTimeout(600);
    const after = await geometry();

    const moved: string[] = [];
    if (after.below !== null && before.below !== null && after.below.y !== before.below.y) {
      moved.push(`the field below moved from y=${before.below.y} to y=${after.below.y}`);
    }
    if (after.field !== null && before.field !== null && after.field.height !== before.field.height) {
      moved.push(`the field's own height went from ${before.field.height} to ${after.field.height}`);
    }
    for (const part of ["clearAll", "arrow"] as const) {
      const was = before[part];
      const now = after[part];
      if (was !== null && now !== null && now.x !== was.x) {
        moved.push(`${part} slid from x=${was.x} to x=${now.x}`);
      }
    }

    expect(
      moved,
      `${host.name}: removing one value moved the rest of the form — ${moved.join("; ")}. `
      + "A person reaching for the next control finds it somewhere else, and anyone removing several "
      + "watches the page step down each time.",
    ).toEqual([]);
  });
}
