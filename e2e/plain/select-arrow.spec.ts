import { expect, test } from "@playwright/test";

/**
 * Which way the select's caret points, measured as an angle.
 *
 * The caret is drawn as a rotated corner and lives in a box the foundation rotates by
 * `mdy-select__arrow--open`. Two rotations therefore compose, and a theme that turns the caret on
 * its own adds to the box rather than replacing it — which is how the caret came to point *up at a
 * closed list*, reaching that angle by winding forward 180° while the box unwound 180° behind it.
 *
 * Asserted in degrees rather than by eye because that is what went wrong: every individual rule
 * looked reasonable, and only the sum was absurd.
 */

const SELECT = ".mdy-renderer--select";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

/** The rotation a computed `matrix()` encodes, in whole degrees. */
function degrees(transform: string): number {
  if (!transform || transform === "none") return 0;
  const m = transform.match(/matrix\(([-\d.eE]+),\s*([-\d.eE]+)/);
  if (!m) return Number.NaN;
  return Math.round((Math.atan2(parseFloat(m[2]), parseFloat(m[1])) * 180) / Math.PI);
}

/** Box angle plus caret angle: what the eye actually sees, since one nests in the other. */
async function caretAngle(page: import("@playwright/test").Page): Promise<number> {
  const t = await page.evaluate((sel) => {
    const box = document.querySelector(`${sel} .mdy-select__arrow`);
    if (!(box instanceof HTMLElement)) return null;
    return { box: getComputedStyle(box).transform, after: getComputedStyle(box, "::after").transform };
  }, SELECT);
  expect(t).not.toBeNull();
  if (!t) return Number.NaN;
  return degrees(t.box) + degrees(t.after);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(TRIGGER).first()).toBeVisible();
});

test("the caret turns 180 degrees to open, and back again", async ({ page }) => {
  // **This one does not discriminate**, and saying so is worth more than letting it look like
  // coverage: restoring the theme rule that caused the regression leaves it green. The popup is
  // portalled, so focus while open lands outside the wrapper and `:focus-within` never matched here.
  // It pins the correct angle; the test below is the one that catches the defect.
  const rest = await caretAngle(page);

  await page.locator(TRIGGER).first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "true");
  // Past the transition, so the resting angle is read rather than a frame of the animation.
  await page.waitForTimeout(350);
  const open = await caretAngle(page);

  expect(open - rest).toBe(180);
});

test("selecting an option returns the caret to its resting angle", async ({ page }) => {
  // The regression: focus is restored to the trigger on selection, and a theme keying the caret on
  // `:focus-within` turned it *then* — pointing up at a list that had just closed.
  const rest = await caretAngle(page);

  await page.locator(TRIGGER).first().click();
  await page.waitForTimeout(350);
  await page.locator(".mdy-select__option").first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(350);

  expect(await caretAngle(page)).toBe(rest);
});
