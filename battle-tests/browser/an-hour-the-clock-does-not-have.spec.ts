/**
 * A box that shows what it says it will not take.
 *
 * The hour segment of a time picker declares its own range twice — `min="1" max="12"` for the
 * browser and `aria-valuemax="12"` for a reader — and both are the truth about what an hour on a
 * twelve-hour clock can be.
 *
 * Typing an hour the clock does not have leaves `29` on screen. Nothing objects while the popup is open: the
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
import { SETTLES } from "./bench";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  valueOf(id: string): Record<string, unknown>;
}>;

const HOUR = ".mdy-timepicker-segment-input";

async function openTimePopup(page: import("@playwright/test").Page, id: string) {
  const openers = page.locator(`[data-form="${id}"] button`);
  for (let index = 0; index < await openers.count(); index += 1) {
    await openers.nth(index).click({ timeout: 3000 }).catch(() => {
        // One candidate of several, and most are not the opener. Which one was is decided by the
        // check after this loop, so a press that does not land is a step of the sweep, not a fault.
      });
    await page.waitForTimeout(240);
    if (await page.locator(".mdy-timepicker-dial").count() > 0) return true;
  }
  return false;
}

const shownHour = (page: import("@playwright/test").Page) =>
  page.evaluate((selector) => {
    const box = document.querySelector(selector) as HTMLInputElement | null;
    return box === null ? null : {
      value: box.value,
      max: box.max,
      ariaMax: box.getAttribute("aria-valuemax"),
      invalid: box.getAttribute("aria-invalid"),
      title: box.getAttribute("title"),
    };
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
  await expect.poll(() => openTimePopup(page, "t"), { message: "no time popup opened, so nothing below is a measurement", ...SETTLES }).toBe(true);

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
  // Two digits, not three. A third character is refused at the box now — the width property — so a
  // three-digit probe can no longer reach an out-of-range state on any renderer: it leaves "12",
  // which is a perfectly good hour, and the assertion below then measures nothing. `29` is out of
  // range on both clocks and is what this spec was always about.
  await page.locator(HOUR).first().type("29");
  await page.waitForTimeout(320);

  const shown = await shownHour(page);
  const bound = Number(shown?.max ?? shown?.ariaMax ?? 12);

  // What the box shows is **not** asserted to be inside the bound, and that is a correction: ADR 0063
  // decided that a value a control cannot read stays where it can be corrected, rather than being
  // discarded or truncated under the person's cursor. Asserting the range here would be asking for
  // the behaviour that record removed, with its table of why.
  //
  // What is asserted is the other half of the same decision: a value outside the range is **marked**,
  // and the range is readable beside it. Text left in place with nothing said about it is the failure
  // 0063 replaced one defect with.
  expect(
    { invalid: shown?.invalid, saysRange: (shown?.title ?? "").length > 0 || shown?.ariaMax !== null },
    `the hour box is showing ${JSON.stringify(shown?.value)} against max="${shown?.max}" and says ${JSON.stringify(shown?.title)}`,
  ).toEqual({ invalid: "true", saysRange: true });

  // And the half that decides what leaves the page: an hour the clock does not have is not committed.
  // The display may hold what was typed; the form may not take it.
  await confirm();
  const taken = String(await committed() ?? "");
  const hourTaken = Number(taken.split(":")[0]);
  expect(
    Number.isNaN(hourTaken) ? 0 : hourTaken,
    `the page showed ${JSON.stringify(shown?.value)} as the hour and the form took ${JSON.stringify(taken)}`,
  ).toBeLessThanOrEqual(bound);
});
