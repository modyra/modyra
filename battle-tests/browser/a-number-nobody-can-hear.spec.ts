/**
 * The hour a clock is set to, and whether anybody can hear it.
 *
 * `timepicker-field-a11y.ts` declares the hour and minute controls as spinbuttons, and says why in a
 * comment beside them: *the value, the name and the spinbutton semantics belong to the control inside
 * it — a segment that took them would announce a number nobody can reach.* The declaration is four
 * things together:
 *
 *     role: "spinbutton", aria-label: "Hour", aria-valuemin: 1, aria-valuemax: 12, aria-valuenow: …
 *
 * `role="spinbutton"` is what makes the other three mean anything. It tells a screen reader that this
 * is a number with a range and a current value, and that the arrow keys move it. Without the role, a
 * reader announces an edit box; without `aria-valuenow`, it announces one with nothing in it.
 *
 * So the check is the set rather than the role alone: a control declared as a spinbutton carries the
 * role *and* the three values, because any of them alone is a number nobody can hear.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`a clock says what it is set to, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("s", [{ name: "x", kind: "timepicker", label: "X", initialValue: "14:30" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    await page.locator('[data-form="s"] button[aria-label]').first().click();
    await page.waitForTimeout(420);

    const controls = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="number"]'))
        .filter((each) => each.getClientRects().length > 0)
        .map((each) => ({
          named: each.getAttribute("aria-label"),
          role: each.getAttribute("role"),
          now: each.getAttribute("aria-valuenow"),
          min: each.getAttribute("aria-valuemin"),
          max: each.getAttribute("aria-valuemax"),
        })));

    // The premise: the dial is open and has the two number controls on it.
    expect(controls.length, "the clock did not open onto its hour and minute").toBeGreaterThan(1);
    expect(controls.map((each) => each.named), "the two controls are not named as an hour and a minute")
      .toEqual(["Hour", "Minute"]);

    const silent = controls
      .filter((each) => each.role !== "spinbutton" || each.now === null || each.min === null || each.max === null)
      .map((each) => `${each.named}: role=${each.role ?? "none"} now=${each.now ?? "none"} min=${each.min ?? "none"} max=${each.max ?? "none"}`);

    expect(
      silent,
      "a control declared as a spinbutton does not carry the role and the value, so a reader announces an edit box with nothing in it",
    ).toEqual([]);
  });
}
