import { expect, test } from "@playwright/test";

/**
 * The keyboard shortcut a decision record promises actually reaches the way back, and using it
 * leaves the person somewhere.
 *
 * ADR 0147 states that `Ctrl`/`Cmd`+Z reaches the undo from the keyboard. A record is read by people
 * who then tell their own users, and **a shortcut that does nothing is indistinguishable from a
 * shortcut nobody pressed** — so a promise made there and not kept in code is worse than one never
 * made.
 *
 * Pressed from where the removal actually leaves a person, not from the button that offers the undo.
 * A shortcut reachable only from the control at the far trailing edge is a shortcut for somebody who
 * has already walked there, and they could have pressed it.
 *
 * The second half is the same act seen afterwards: **the offer is withdrawn by using it**, so
 * whatever held focus is gone from the page the moment it works. A reading position on nothing sends
 * a keyboard back to the top of the document — so undoing a removal would cost finding the field
 * again, which is the cost the undo exists to save.
 *
 * The control is the button, in the same run. If the offer itself did not work, the finding would be
 * a different one and this file says so rather than blaming the shortcut.
 */

/** The gesture, on either spelling of the platform's accelerator. */
const UNDO = process.platform === "darwin" ? "Meta+z" : "Control+z";

test("the way back answers its shortcut, and leaves the reading position somewhere", async ({ page }) => {
  await page.goto("/");
  const field = page.locator(".mdy-renderer--multiselect:visible").first();
  await field.waitFor({ state: "visible" });

  const held = () => field.locator(".mdy-multiselect__chips .mdy-chip").count();
  const opener = field.locator("[aria-expanded]").first();

  const fill = async (): Promise<void> => {
    if (await held() > 0) return;
    await opener.click();
    await page.waitForTimeout(250);
    const option = page.locator('.mdy-multiselect__options .mdy-chip, [class*="overlay"] .mdy-chip').first();
    if (await option.count() > 0) await option.click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    expect(await held(), "this file could not leave the field holding a value").toBeGreaterThan(0);
  };

  await fill();

  // The control: the offer works when it is pressed. Asserted first, so a broken undo is reported as
  // a broken undo rather than as a shortcut that does not arrive.
  const before = await held();
  await field.locator(".mdy-chip__remove").first().click();
  await page.waitForTimeout(250);
  expect(await held(), "removing a value did nothing, so there is no way back to reach").toBe(before - 1);
  const offer = field.locator(".mdy-multiselect__way-back-action");
  await expect(offer, "no way back is offered after a removal").not.toHaveAttribute("hidden", "");
  await offer.click();
  await page.waitForTimeout(250);
  expect(await held(), "the way back does not put the value back when pressed").toBe(before);

  // Where the person is left after using it. The offer has gone, so something must have taken its
  // place — anything inside the field will do, and the body will not.
  const landedInside = await page.evaluate(() => {
    const active = document.activeElement;
    return active !== null && active !== document.body
      && active.closest(".mdy-renderer--multiselect") !== null;
  });
  expect(
    landedInside,
    "using the way back left the reading position on nothing: the control was withdrawn as it was "
    + "used and took the person's place with it, so a keyboard starts again at the top of the page.",
  ).toBe(true);

  // The shortcut, pressed from where a removal leaves a person rather than from the offer.
  await field.locator(".mdy-chip__remove").first().click();
  await page.waitForTimeout(250);
  const afterRemoval = await held();
  // A key that is not the gesture, first. Without it "the value came back" is satisfied by anything
  // that restores it — and a shortcut that fires on every key is not the one the record promises.
  await page.keyboard.press("q");
  await page.waitForTimeout(300);
  expect(
    await held(),
    "a key that is not the shortcut put the value back, so what the next press proves is that "
    + "something restores it, not that this gesture does",
  ).toBe(afterRemoval);

  await page.keyboard.press(UNDO);
  await page.waitForTimeout(300);
  expect(
    await held(),
    `${UNDO} did not reach the way back. ADR 0147 promises this shortcut, and a shortcut that does `
    + "nothing cannot be told apart from one nobody pressed.",
  ).toBe(afterRemoval + 1);
});
