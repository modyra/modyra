import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * How a popup appears is the foundation's, and the same in every renderer.
 *
 * The three adapters show a popup three different ways — Plain clears `hidden`, Angular calls
 * `showPopover()`, Lit renders the subtree — and each appeared instantly except Angular, which
 * forced itself visible from a component-scoped rule no theme could reach. The shared
 * `.mdy-popup` container now owns one transition for all of them.
 *
 * These assert the computed style rather than a frame-by-frame fade: the timing of a 100ms
 * animation is exactly the kind of assertion that goes flaky on a loaded CI box, while the
 * computed transition is the thing that either reaches the element or does not.
 */

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

/** A select on the canvas, whose popup is a real `.mdy-popup` drawn by @modyra/plain. */
async function addSelect(page: import("@playwright/test").Page) {
  await page.locator('[data-template="select"]').click();
  await expect(page.locator(".mdy-popup").first()).toBeAttached();
}

test("a popup carries the foundation's open/close transition, driven by the motion tokens", async ({ page }) => {
  await addSelect(page);
  const popup = page.locator(".mdy-popup").first();

  const motion = await popup.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      token: getComputedStyle(document.documentElement).getPropertyValue("--mdy-sys-motion-duration-fast").trim(),
    };
  });

  expect(motion.property).toContain("opacity");
  // `display` and `overlay` are what let the fade finish before the popup leaves the layout or the
  // top layer; without them a closing popup cuts to nothing on the first frame.
  expect(motion.property).toContain("display");
  expect(motion.duration.split(",")[0]?.trim()).toBe(motion.token);
});

test("a closed popup is transparent, so there is something to animate from", async ({ page }) => {
  await addSelect(page);
  const popup = page.locator(".mdy-popup").first();

  // Closed is how a freshly-added select starts: hidden, and transparent rather than merely absent.
  await expect(popup).toBeHidden();
  expect(await popup.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
});
