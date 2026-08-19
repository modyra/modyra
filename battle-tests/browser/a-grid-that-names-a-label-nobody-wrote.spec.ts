/**
 * A calendar's grids, and the name one of them points at.
 *
 * `projectCalendarViewA11y(mode, options)` is published and says what the months and years views must
 * be: `role="grid"`, with `aria-labelledby` naming the field's label. The days grid is projected
 * elsewhere and carries the same pairing.
 *
 * A grid is one of the few roles where the name is not a nicety. A screen reader entering one
 * announces "grid" and then what it is a grid *of*; without a name it announces a grid of nothing,
 * inside a popup the user opened from a field whose own name they can no longer hear.
 *
 * Two ways to get it wrong, and one renderer has both. A grid with no `aria-labelledby` is unnamed.
 * A grid whose `aria-labelledby` names an id that is not on the page is *also* unnamed — and worse to
 * find, because the attribute is right there in the markup and every review of the element passes.
 *
 * The check is not that the label carries a particular id: it is that whatever the grid points at
 * exists and has words in it.
 *
 * Claims under attack: A11Y-001, A11Y-004.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`every grid a calendar shows is named, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("cg", [{ name: "x", kind: "datepicker", label: "Appointment", initialValue: "2026-04-03" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    for (const selector of ['[data-form="cg"] [aria-haspopup]', '[data-form="cg"] button', '[data-form="cg"] input']) {
      const candidate = page.locator(selector).first();
      if (await candidate.count() === 0) continue;
      await candidate.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      const open = await page.evaluate(() =>
        document.querySelector('[data-form="cg"] [aria-expanded="true"]') !== null);
      if (open) break;
    }

    /** Every grid on screen, and whether a reader would be told what it is a grid of. */
    const grids = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="grid"]'))
        .filter((each) => each.getClientRects().length > 0)
        .map((each) => {
          const named = each.getAttribute("aria-labelledby");
          const label = each.getAttribute("aria-label");
          const target = named === null ? null : document.getElementById(named);
          return {
            id: each.id || "(no id)",
            names: named,
            named: (label ?? "").trim() !== "" || (target?.textContent ?? "").trim() !== "",
          };
        }));

    const inDays = await grids();
    expect(inDays.length, "no grid was on screen after opening the calendar").toBeGreaterThan(0);

    const unnamedInDays = inDays.filter((each) => !each.named);
    expect(unnamedInDays, "the days grid is announced as a grid of nothing").toEqual([]);

    // The other views, which the projection names explicitly.
    await page.locator("button").filter({ hasText: /\w+\s+\d{4}/ }).first().click();
    await page.waitForTimeout(360);

    const inYears = await grids();
    expect(inYears.length, "no grid was on screen after leaving the days").toBeGreaterThan(0);

    // The premise: this is a different view from the one above, so the check is not the same grid
    // twice.
    expect(inYears.map((each) => each.id), "the calendar did not change view").not.toEqual(inDays.map((each) => each.id));

    const unnamedInYears = inYears.filter((each) => !each.named);
    expect(
      unnamedInYears,
      "a grid names a label that is not on the page, so it is announced as a grid of nothing while the markup looks right",
    ).toEqual([]);
  });
}
