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

test("a popup inside the form is in the top layer and still lands on its control", async ({ page }) => {
  // A datepicker deliberately, not a select: the select and the multiselect portal their popup to
  // `document.body`, so nothing in the form could ever contain them. The four picker-style popups
  // stay in the field's own subtree, which is where it matters — the canvas mounts a real
  // `.mdy-dynamic-form`, and the foundation makes that a layout container so a row can ask how wide
  // the *form* is. `container-type` implies `contain: layout`, and a containing block for fixed
  // descendants is exactly what turns viewport coordinates into the wrong place. The top layer takes
  // the popup out of that question; this is the proof it stays on its control regardless.
  await page.locator('[data-template="date"]').click();
  const trigger = page.locator(".mdy-datepicker__trigger").first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const geometry = await page.evaluate(() => {
    const el = document.querySelector(".mdy-datepicker__popup") as HTMLElement;
    // `positionOverlay` anchors this popup to the field's input wrapper, so that is what it lines up
    // with — the trigger is only the button inside it.
    const anchor = document
      .querySelector(".mdy-renderer--datepicker .mdy-input-wrapper") as HTMLElement;
    const form = el.closest(".mdy-dynamic-form") as HTMLElement | null;
    const popupBox = el.getBoundingClientRect();
    const anchorBox = anchor.getBoundingClientRect();
    return {
      inTopLayer: el.matches(":popover-open"),
      insideAForm: form !== null,
      formLeft: form ? Math.round(form.getBoundingClientRect().left) : 0,
      // How much of the anchor's width the popup covers. Alignment and clamping are
      // `anchorOverlay`'s business and have their own tests; what matters here is that the popup is
      // still *over its control* rather than displaced by the form's own offset.
      overlap: Math.round(
        Math.min(popupBox.right, anchorBox.right) - Math.max(popupBox.left, anchorBox.left),
      ),
      anchorWidth: Math.round(anchorBox.width),
      dy: Math.round(popupBox.top - anchorBox.bottom),
      position: getComputedStyle(el).position,
    };
  });

  // It really is inside the form — otherwise this test would prove nothing about containment.
  expect(geometry.insideAForm).toBe(true);
  expect(geometry.formLeft).toBeGreaterThan(0);
  expect(geometry.inTopLayer).toBe(true);
  expect(geometry.position).toBe("fixed");
  // Over its control, and just below it. Laid out against the form instead of the viewport it would
  // be displaced by the form's own offset — which the assertion above proves is far wider than the
  // control, so any such error leaves no overlap at all.
  expect(geometry.overlap).toBeGreaterThan(geometry.anchorWidth / 2);
  expect(geometry.dy).toBeGreaterThanOrEqual(0);
  expect(geometry.dy).toBeLessThanOrEqual(12);
});
