/**
 * A value you set with the arrow keys, announced as text you cannot edit.
 *
 * `projectTimepickerFieldA11y` declares what the hour and minute segments are, and it is not a
 * guess — the projection is the published answer to "what does this part carry":
 *
 *   role="spinbutton", aria-label, aria-valuemin, aria-valuemax, aria-valuenow
 *
 * That is the vocabulary for a number a user walks up and down, and the arrow keys do walk it: Up on
 * the hour segment moves eleven to twelve in both renderers. One of them says so and one does not.
 *
 * What a reader is told matters more here than usual, because the segment is `readonly` in the
 * renderer that omits the role: a plain read-only text box announces as something there is no point
 * putting the cursor in, and the arrows that do work are not discoverable from anything announced.
 *
 * The attributes asserted are the ones that do not depend on what time it is. `aria-valuenow` is
 * checked for presence only — the live form's clock is not this spec's business, and comparing it
 * against a synthetic state is how an earlier version of this measurement produced three false
 * differences.
 */

import { expect, test } from "@playwright/test";

import { projectTimepickerFieldA11y } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

/** A state the projection can answer for, used only to read what it declares. */
const STATE = {
  label: "X", open: true, format: "12h",
  draft: { hour: 10, minute: 30, period: "AM" },
  value: "10:30 AM",
  disabled: false, readonly: false, required: false, invalid: false, touched: false, dirty: false,
};

const SEGMENT = ".mdy-timepicker-segment-input";

for (const host of HOSTS) {
  test(`the hour and minute segments carry what the contract declares, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const declared = projectTimepickerFieldA11y(STATE as never, [], { widgetId: "w" }) as never as
      Record<string, { attributes?: Record<string, unknown> }>;
    const hour = declared.hourControl.attributes ?? {};

    // The premise: the projection declares a spinbutton at all. If this table is ever rewritten, this
    // spec should stop asking rather than keep asking for something nobody publishes.
    expect(hour.role, "the published projection no longer declares a spinbutton for the hour segment").toBe("spinbutton");

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(id: string, fields: unknown[]): unknown }>)[api]
        .mountFields("t", [{ name: "x", kind: "timepicker", label: "Meeting time" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    const openers = page.locator('[data-form="t"] button');
    let opened = false;
    for (let index = 0; index < await openers.count(); index += 1) {
      await openers.nth(index).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(220);
      if (await page.locator(".mdy-timepicker-dial").count() > 0) { opened = true; break; }
    }
    expect(opened, "no time popup opened, so nothing below is a measurement").toBe(true);

    const segments = await page.evaluate((selector) =>
      Array.from(document.querySelectorAll(selector)).map((each) => {
        const element = each as HTMLInputElement;
        return {
          role: element.getAttribute("role"),
          min: element.getAttribute("aria-valuemin"),
          max: element.getAttribute("aria-valuemax"),
          hasNow: element.getAttribute("aria-valuenow") !== null,
          label: element.getAttribute("aria-label"),
        };
      }), SEGMENT);

    expect(segments.length, "the popup has no hour and minute segments, so nothing below is a measurement").toBe(2);

    // The control, in the same run: the arrows do change the value, so this is a number a user walks
    // rather than a label that happens to be a number.
    const shown = () => page.evaluate((selector) =>
      Array.from(document.querySelectorAll(selector)).map((each) => (each as HTMLInputElement).value).join(":"), SEGMENT);
    const before = await shown();
    await page.locator(SEGMENT).first().focus();
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(280);
    expect(await shown(), "the arrow keys do not move the hour, so the spinbutton vocabulary is not what this part needs").not.toBe(before);

    // Every segment says what it is, what it may hold, and where it is now.
    expect(
      segments.map((each) => each.role),
      `the segments a user changes with the arrow keys carry ${JSON.stringify(segments.map((each) => each.role))} where the projection declares "spinbutton"`,
    ).toEqual(["spinbutton", "spinbutton"]);

    expect(
      segments.every((each) => each.min !== null && each.max !== null && each.hasNow),
      `a segment announces no range and no position: ${JSON.stringify(segments)}`,
    ).toBe(true);
  });
}
