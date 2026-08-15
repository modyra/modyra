/**
 * A form that tells the user off before they have started.
 *
 * `@modyra/widgets` publishes two rules for showing a verdict. `shownErrors` answers whether a field
 * is being asked about at all — out of play, no verdict. `errorsVisible` adds the second condition
 * and says why in its own words: *a field is failing, **and** the person has been given the chance
 * to fill it. An invalid untouched field is the ordinary state of an empty form — every required
 * field holds an error before anyone has typed — so painting those errors on arrival tells a user
 * off for a form they have not started.*
 *
 * Angular calls `errorsVisible`. Lit calls it in five places. The Plain renderer never does: its
 * fields render `shownErrorsOf(handle)`, which knows about `disabled` and not about `touched`.
 *
 * So a Plain form with one required field, freshly mounted and never touched, paints "This field is
 * required" in a visible block eighteen pixels tall, and marks the control `aria-invalid="true"`. A
 * screen reader reaching that form announces every required field as invalid before the user has
 * reached any of them.
 *
 * Measured in a real DOM because that is the only place it is visible: the handle is failing either
 * way, and every check that reads the engine agrees with the engine.
 */

import { expect, test } from "@playwright/test";

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** What the first control of a mounted form says about itself. */
const readVerdict = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const input = document.querySelector('[data-form="main"] input') as HTMLInputElement;
    const described = input.getAttribute("aria-describedby");
    const target = described ? document.getElementById(described.split(" ")[0]) : null;
    const style = target ? getComputedStyle(target) : null;
    const box = target?.getBoundingClientRect();
    return {
      ariaInvalid: input.getAttribute("aria-invalid"),
      message: target?.textContent?.trim() ?? "",
      shown: style !== null && style.display !== "none" && style.visibility !== "hidden" && (box?.height ?? 0) > 0,
    };
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
  await page.evaluate(() => (window as never as { battle: { mount(id: string): void } }).battle.mount("main"));
  await settled(page);
});

test("a required field nobody has reached is not painted as failing", async ({ page }) => {
  const verdict = await readVerdict(page);

  expect(verdict.shown && verdict.message.length > 0).toBe(false);
  expect(verdict.ariaInvalid).not.toBe("true");
});

test("the same field says so once the user has been there", async ({ page }) => {
  // The control: the verdict is not missing, it is waiting. A renderer that never showed an error
  // would pass the battle above and fail this one.
  const input = page.locator('[data-form="main"] input').first();
  await input.click();
  await input.fill("x");
  await input.fill("");
  await input.blur();
  await settled(page);

  const verdict = await readVerdict(page);
  expect(verdict.message).toContain("required");
  expect(verdict.shown).toBe(true);
  expect(verdict.ariaInvalid).toBe("true");
});
