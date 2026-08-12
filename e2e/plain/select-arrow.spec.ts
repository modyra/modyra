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
  // Waited *for the angle*, not for a duration: a fixed sleep is a guess about how long a transition
  // takes on a loaded machine, and the guess is what made this suite red on webkit — an angle read
  // two thirds of the way through a turn. Polling asks the same question until the answer settles.
  await expect.poll(() => caretAngle(page)).toBe(rest + 180);
});

test("selecting an option returns the caret to its resting angle", async ({ page }) => {
  // The regression: focus is restored to the trigger on selection, and a theme keying the caret on
  // `:focus-within` turned it *then* — pointing up at a list that had just closed.
  const rest = await caretAngle(page);

  await page.locator(TRIGGER).first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "true");
  await page.locator(".mdy-select__option").first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "false");

  // The regression this test exists for is a caret that *settles* pointing the wrong way, so waiting
  // for it to settle is the honest way to read it — and it cannot hide the defect: a caret turned by
  // `:focus-within` stays turned, and the poll would time out on it rather than pass.
  await expect.poll(() => caretAngle(page)).toBe(rest);
});
