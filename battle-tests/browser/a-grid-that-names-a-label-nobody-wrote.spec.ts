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

// **Every renderer, from the shared list.** This file kept one of its own with plain and lit
// in it. That was never a scope decision: the angular host published six of the twenty-two
// doors these specs need, so a spec that wanted one it lacked left the renderer out, and the
// next reader copied the list. Sixty-eight files came to exclude it that way. The doors are
// open now.
import { HOSTS, announcedName } from "./bench";

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

    /**
     * Every grid on screen, and the name a reader is actually told.
     *
     * The name is asked of the platform rather than rebuilt from the attributes. The rule this file
     * used to carry — a non-empty `aria-label`, or an `aria-labelledby` whose target has text —
     * missed two things at once. It resolved the whole attribute as a single id, so a reference
     * naming two elements found none; and it counted a reference whose target carries text without
     * asking what that text contributes, which is how a grid pointed at an embedded control reads
     * as named while announcing nothing.
     *
     * `:visible` rather than a rectangle count, and it matters here: a calendar keeps the views it
     * is not showing in the document, and a grid outside the accessibility tree has no announced
     * name to read — the reader refuses it rather than calling it unnamed.
     */
    const grids = async () => {
      const nodes = page.locator('[role="grid"]:visible');
      const out: Array<{ id: string; name: string | null; named: boolean }> = [];
      for (let at = 0, total = await nodes.count(); at < total; at += 1) {
        const one = nodes.nth(at);
        const id = await one.evaluate((each) => each.id || "(no id)");
        const name = await announcedName(one);
        out.push({ id, name, named: name !== null && name.trim() !== "" });
      }
      return out;
    };

    const inDays = await grids();
    expect(inDays.length, "no grid was on screen after opening the calendar").toBeGreaterThan(0);

    const unnamedInDays = inDays.filter((each) => !each.named);
    expect(unnamedInDays, "the days grid is announced as a grid of nothing").toEqual([]);

    // The other views, which the projection names explicitly.
    //
    // **Reached with a stated timeout, and named when it is not there.** A renderer without this
    // control used to hold the whole spec until the suite's own limit expired — three minutes, then
    // a stack trace about a locator, for a subject the file never reached. The second half of this
    // check has therefore never run against such a renderer, and nothing said so: the row read as
    // "the grid is unnamed" when the truth is that the view was never left.
    const switcher = page.locator("button").filter({ hasText: /\w+\s+\d{4}/ }).first();
    await expect(
      switcher,
      "no control on this calendar shows a month and a year, so the view cannot be changed and "
        + "everything below is about a view this renderer never left — the grids of the other views "
        + "are unmeasured here rather than unnamed",
    ).toBeVisible({ timeout: 5_000 });
    await switcher.click();
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
