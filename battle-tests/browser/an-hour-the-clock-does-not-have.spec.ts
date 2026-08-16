/**
 * A box that shows what it says it will not take.
 *
 * The hour segment of a time picker declares its own range twice — `min="1" max="12"` for the
 * browser and `aria-valuemax="12"` for a reader — and both are the truth about what an hour on a
 * twelve-hour clock can be.
 *
 * Typing three digits into it leaves `129` on screen. Nothing objects while the popup is open: the
 * number is shown, the dial is drawn, and the field looks like it holds an hour of one hundred and
 * twenty-nine. Confirming commits `12`.
 *
 * So the value is safe and the screen is not, which is the worse half to get wrong: the user is told
 * their input was taken, and something else was. A control that refused the third digit, or that
 * clamped where the user could see it happen, would be telling the truth at the moment the decision
 * is made.
 *
 * Asked of the renderer whose segments accept typing at all — lit's are `readonly`, so its hour is
 * set with the arrows or the dial and this input never happens there. That difference is recorded in
 * the register rather than asserted here.
 *
 * Claims under attack: UI-006, VAL-004.
 */

import { expect, test } from "@playwright/test";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  valueOf(id: string): Record<string, unknown>;
}>;

const HOUR = ".mdy-timepicker-segment-input";

async function openTimePopup(page: import("@playwright/test").Page, id: string) {
  const openers = page.locator(`[data-form="${id}"] button`);
  for (let index = 0; index < await openers.count(); index += 1) {
    await openers.nth(index).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(240);
    if (await page.locator(".mdy-timepicker-dial").count() > 0) return true;
  }
  return false;
}

const shownHour = (page: import("@playwright/test").Page) =>
  page.evaluate((selector) => {
    const box = document.querySelector(selector) as HTMLInputElement | null;
    return box === null ? null : { value: box.value, max: box.max, ariaMax: box.getAttribute("aria-valuemax") };
  }, HOUR);

test("an hour the clock does not have, plain", async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const mount = () => page.evaluate(() => {
    (window as never as Api).battle.mountFields("t", [{ name: "x", kind: "timepicker", label: "X" }]);
  });
  const committed = () => page.evaluate(() => (window as never as Api).battle.valueOf("t").x);
  const confirm = async () => {
    await page.locator("button").filter({ hasText: /^OK$/ }).first().click({ timeout: 4000 });
    await page.waitForTimeout(360);
  };

  await mount();
  await page.waitForTimeout(320);
  expect(await openTimePopup(page, "t"), "no time popup opened, so nothing below is a measurement").toBe(true);

  // The control: an hour the clock does have is shown and committed as itself. Without this, a box
  // that shows nothing and a box that shows too much are the same measurement.
  await page.locator(HOUR).first().fill("");
  await page.locator(HOUR).first().type("4");
  await page.waitForTimeout(300);
  expect((await shownHour(page))?.value, "an ordinary hour was not taken by the box that takes hours").toBe("4");
  await confirm();
  expect(String(await committed()), "an ordinary hour was not committed as itself").toContain("04");

  // And an hour it does not have, typed into the same box.
  expect(await openTimePopup(page, "t"), "the popup did not open a second time").toBe(true);
  await page.locator(HOUR).first().fill("");
  await page.locator(HOUR).first().type("129");
  await page.waitForTimeout(320);

  const shown = await shownHour(page);
  const bound = Number(shown?.max ?? shown?.ariaMax ?? 12);

  // The box states its own range, and this is the assertion: what it shows is inside it.
  expect(
    Number(shown?.value),
    `the hour box declares max="${shown?.max}" and aria-valuemax="${shown?.ariaMax}" and is showing ${JSON.stringify(shown?.value)}`,
  ).toBeLessThanOrEqual(bound);

  // The second half, in case the display is ever fixed by clamping silently at confirmation time:
  // what is committed is what the user was shown.
  await confirm();
  expect(
    String(await committed()),
    `the page showed ${JSON.stringify(shown?.value)} as the hour and the form took ${JSON.stringify(await committed())}`,
  ).toContain(String(shown?.value).padStart(2, "0"));
});
