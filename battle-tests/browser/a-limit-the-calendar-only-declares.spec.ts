/**
 * A calendar told where its range starts refuses the days outside it.
 *
 * `minDate` and `maxDate` are declared on a document, kept by the parser, read by every renderer.
 * That chain was verified as *bindings* — the value reaches the component — and that is a different
 * claim from the one a person cares about: **a day outside the range cannot be chosen.**
 *
 * The gap between those two is where this kind of defect lives. A limit that arrives and is not
 * applied looks identical from the outside to one that never arrived, and every check upstream of
 * the calendar is green either way. So this presses the day and reads the value, rather than
 * reading the attribute that says it should not have worked.
 *
 * Two properties, and the second is the one that survives a renderer deciding to paint differently:
 *
 *   - a day before the limit is **not offered** — disabled, or not a control at all;
 *   - pressing it anyway leaves the value where it was.
 *
 * The first can be satisfied by a renderer that greys a cell and still answers it. The second cannot
 * be satisfied by anything except refusing the choice, which is why both are here.
 *
 * Claims under attack: DYN-001, UI-011, A11Y-006.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** A month with room on both sides of the limit, so "outside" is reachable without changing month. */
const MIN = "2026-06-10";
const INSIDE = 20;
const OUTSIDE = 3;

for (const host of HOSTS) {
  test(`a day before the limit cannot be chosen, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, min }) => {
      (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
        .mountFields("lim", [{
          name: "d", kind: "datepicker", label: "D",
          // Inside the declared range, so the control opens on a month the limit divides.
          initialValue: "2026-06-15",
          minDate: min,
        }] as never);
    }, { api: host.api, min: MIN });
    await page.waitForTimeout(400);

    const opener = page.locator('[data-form="lim"] button[aria-label="Toggle calendar"], [data-form="lim"] [aria-haspopup]').first();
    await expect(opener, "no calendar opener was drawn, so the limit cannot be exercised").toHaveCount(1, { timeout: 5_000 });
    await opener.click();
    // Wait for the days, not for the grid to be "visible". One renderer keeps its calendar in the
    // document from the start and reveals it, so the grid element exists before the press and its
    // visibility is a property of an ancestor this spec has no business knowing about. The cells
    // being there is what makes the question askable.
    await expect(
      page.locator('[role="gridcell"]').first(),
      "the calendar opened without drawing any days",
    ).toBeAttached({ timeout: 5_000 });

    const held = () => page.evaluate(({ api }) =>
      JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("lim")),
      { api: host.api });

    const before = await held();

    const cell = (day: number) => page.locator('[role="gridcell"], [role="grid"] button')
      .filter({ hasText: new RegExp(`^\\s*${day}\\s*$`) }).first();

    // The premise: the month really does hold both days, or the test is measuring an empty grid.
    await expect(cell(INSIDE), `the open month drew no day ${INSIDE}`).toHaveCount(1, { timeout: 5_000 });
    await expect(cell(OUTSIDE), `the open month drew no day ${OUTSIDE}`).toHaveCount(1, { timeout: 5_000 });

    const offered = await cell(OUTSIDE).evaluate((element) => ({
      ariaDisabled: element.getAttribute("aria-disabled"),
      disabled: (element as HTMLButtonElement).disabled ?? null,
      tag: element.tagName.toLowerCase(),
    }));

    // Pressed regardless of how it is painted: `force`, because a renderer that refuses the pointer
    // is already answering the second property and must not make the press unobservable.
    await cell(OUTSIDE).click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
    const afterOutside = await held();

    expect(
      afterOutside,
      `pressing day ${OUTSIDE} — before the declared minimum ${MIN} — changed the value from ` +
        `${before} to ${afterOutside}. The limit was declared, the parser kept it, and the calendar ` +
        `offered the day anyway (${JSON.stringify(offered)})`,
    ).toBe(before);

    expect(
      offered.ariaDisabled === "true" || offered.disabled === true,
      `day ${OUTSIDE} is before the declared minimum and is offered as an ordinary choice ` +
        `(${JSON.stringify(offered)}) — a person is invited to press something that cannot work`,
    ).toBe(true);
  });
}
