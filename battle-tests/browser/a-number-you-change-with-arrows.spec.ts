/**
 * A value you set with the arrow keys, announced as text you cannot edit.
 *
 * `projectTimepickerFieldA11y` declares what the hour and minute segments carry:
 *
 *   role="spinbutton", aria-label, aria-valuemin, aria-valuemax, aria-valuenow
 *
 * The **role** is not what this asks for. Both renderers use `<input type="number">`, whose implicit
 * role is already `spinbutton`, so declaring it again is belt-and-braces and omitting it costs
 * nothing. An earlier version of this spec asserted the role and was over-claiming.
 *
 * What the range is asked for, because nothing else provides it. An hour runs 1 to 12 and a minute 0
 * to 59, and a segment can say so twice over — `aria-valuemin`/`aria-valuemax` for a reader, `min`
 * and `max` for the browser. Either satisfies this. Neither is present in one of the two renderers,
 * so the bounds exist nowhere: not announced, and not enforced by the control.
 *
 * The arrows are asserted to work first, because that is what makes the range meaningful — this is a
 * number a user walks up and down, not a label that happens to hold one.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { projectTimepickerFieldA11y } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS , SETTLES} from "./bench";

/** A state the projection can answer for, used only to read what it declares. */
const STATE = {
  label: "X", open: true, format: "12h",
  draft: { hour: 10, minute: 30, period: "AM" },
  value: "10:30",
  disabled: false, readonly: false, required: false, invalid: false, touched: false, dirty: false,
};

const SEGMENT = ".mdy-timepicker-segment-input";

for (const host of HOSTS) {
  test(`the hour and minute segments carry what the contract declares, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const declared = projectTimepickerFieldA11y(STATE as never, [], { widgetId: "w" }) as never as
      Record<string, { attributes?: Record<string, unknown> }>;
    const hour = declared.hourControl.attributes ?? {};

    // The premise: the projection declares bounds for this part at all. If it ever stops, this spec
    // should stop asking rather than keep asking for something nobody publishes.
    expect(
      [hour["aria-valuemin"], hour["aria-valuemax"]],
      "the published projection no longer declares bounds for the hour segment",
    ).toEqual([1, 12]);

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
          // Either way of stating the bounds counts: one is for a reader, the other for the browser.
          min: element.getAttribute("aria-valuemin") ?? element.getAttribute("min"),
          max: element.getAttribute("aria-valuemax") ?? element.getAttribute("max"),
          label: element.getAttribute("aria-label"),
          readOnly: element.readOnly,
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
    await expect.poll(() => shown(), { message: "the arrow keys do not move the hour, so the spinbutton vocabulary is not what this part needs", ...SETTLES }).not.toBe(before);

    // Every segment states the range it will take, in one of the two ways there are.
    expect(
      segments.every((each) => each.min !== null && each.max !== null),
      `a segment a user walks with the arrow keys states no bounds, neither for a reader nor for the browser: ${JSON.stringify(segments)}`,
    ).toBe(true);
  });
}
