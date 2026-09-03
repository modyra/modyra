/**
 * A calendar still on the screen for a field that is no longer in play.
 *
 * A field can leave play while its popup is open, and it does not need anybody to click anything: a
 * document's rule takes it out when another field changes, so a value arriving from a fetch can do it
 * while the user is looking at the calendar.
 *
 * What happens then is that nothing happens. The overlay stays where it was, the opener still says
 * `aria-expanded="true"`, and every cell in it still looks like a date somebody could pick. Clicking
 * one does nothing — correctly, the field is out of play — so what the user has is a control that
 * looks live and answers nothing.
 *
 * The right outcome is not that the click should work. It is that the calendar should not still be
 * there offering it.
 *
 * Measured through `disable` rather than through a rule because both renderers can be driven that way
 * and the field leaves play identically; the rule path is the one that reaches it without the user
 * doing anything, and is recorded in the register beside this.
 *
 * Claims under attack: UI-005, VAL-002.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  disable(id: string, path: string): void;
  valueOf(id: string): Record<string, unknown>;
}>;

for (const host of HOSTS) {
  test(`a calendar that outlived its field, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("p", [{ name: "when", kind: "datepicker", label: "When" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const openers = page.locator('[data-form="p"] button');
    let opened = false;
    for (let index = 0; index < await openers.count(); index += 1) {
      await openers.nth(index).click({ timeout: 3000 }).catch(() => {
        // One candidate of several, and most are not the opener. Which one was is decided by the
        // check after this loop, so a press that does not land is a step of the sweep, not a fault.
      });
      await page.waitForTimeout(230);
      if (await page.locator('[role="gridcell"]').count() > 6) { opened = true; break; }
    }

    const onScreen = () => page.evaluate(() => ({
      cells: document.querySelectorAll('[role="gridcell"]').length,
      expanded: document.querySelector('[aria-expanded]')?.getAttribute("aria-expanded") ?? null,
    }));

    // The premise: a calendar is open and the page says so.
    const before = await onScreen();
    expect(opened, "no calendar opened, so nothing below is a measurement").toBe(true);
    expect(before.expanded, "the opener does not report the calendar it just opened").toBe("true");

    await page.evaluate(({ api }) => (window as never as Api)[api].disable("p", "when"), { api: host.api });
    await page.waitForTimeout(420);

    const after = await onScreen();

    // The control that this is not about clicks: a cell in the still-open calendar does nothing,
    // which is right — the field is out of play. What is wrong is that it is still there to click.
    const cell = page.locator('[role="gridcell"] button, button[role="gridcell"]').nth(10);
    if (await cell.count() > 0) {
      await cell.click({ timeout: 3000, force: true }).catch(() => {
        // The cell may not be reachable in the month on show. What the page holds afterwards is
        // read either way, and that reading is the finding rather than this press.
      });
      await page.waitForTimeout(300);
    }
    const held = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("p").when, { api: host.api });
    expect(held, "a field out of play took a value from its own calendar, which is a larger finding than this one").toBeNull();

    expect(
      after,
      `the field left play and its calendar is still open with ${after.cells} cells, still reported as expanded — a control that looks live and answers nothing`,
    ).toEqual({ cells: 0, expanded: "false" });
  });
}
