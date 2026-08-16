import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

/**
 * A minimum width the contract declares and the popup it describes does not keep.
 *
 * `capabilities.anchoring` states how a kind's overlay is placed, and two of its numbers pull in
 * different directions. `matchAnchorWidth` says the popup takes the anchor's width; `minWidth` says
 * how narrow it may get. Three kinds declare a minimum — `select` 160, `multiselect` 160, `colors`
 * 280 — and `colors` is the only one that declares a minimum *and* does not follow its anchor, which
 * is the case where the minimum is the only thing stating a width at all.
 *
 * Measured with the contract's own class names, in a viewport with room for either number:
 *
 *   8 default swatches   popup 142px
 *   6 declared presets   popup 110px
 *
 * The width tracks the content exactly, and 280 never appears. `--mdy-overlay-width` is not set on
 * the element — for a kind that does not match its anchor, `anchorOverlay` sizes from the measured
 * content and the declared minimum survives only as an input to whether the popup *fits*, never as
 * the width it takes.
 *
 * The control is the number declared beside it. `maxHeight` comes from the same capabilities, down
 * the same path, and arrives as `--mdy-overlay-max-height` on the very element measured here. One of
 * the two numbers a kind declares about its overlay reaches it.
 *
 * Nothing is asserted about `select`, whose `--mdy-overlay-width` reads as the full viewport width
 * and is not explained by this reading.
 *
 * Claims under attack: UI-010.
 */

const COLORS = MDY_WIDGET_CONTRACTS.colors as unknown as {
  capabilities: { anchoring: { minWidth: number; matchAnchorWidth: boolean } };
  parts: Record<string, { classes: string[] }>;
};

const classOf = (part: string) => COLORS.parts[part].classes.join(".");

test("a colours popup is at least as wide as its contract says it may get", async ({ page }) => {
  test.setTimeout(120_000);
  const { minWidth, matchAnchorWidth } = COLORS.capabilities.anchoring;

  // The control: this is the kind whose declared minimum is the only statement about its width.
  expect(minWidth, "the colours contract no longer declares a minimum width").toBe(280);
  expect(matchAnchorWidth, "the colours popup now follows its anchor, so the minimum is not alone").toBe(false);

  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const mounted = await page.evaluate(() =>
    (window as never as Record<string, { mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string } }>)
      .battle.mountFields("swatches", [{ name: "shade", kind: "colors", label: "Shade" }] as never));
  expect(mounted.mounted, `the colours field did not mount: ${mounted.message ?? ""}`).toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));

  await page.locator(`[data-form="swatches"] .${classOf("toggle")}`).first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  const seen = await page.evaluate(({ popupClass, swatchClass }) => {
    const popup = (Array.from(document.querySelectorAll(`.${popupClass}`)) as HTMLElement[])
      .find((each) => each.getClientRects().length > 0);
    if (popup === undefined) return { open: false };
    const style = getComputedStyle(popup);
    return {
      open: true,
      width: Math.round(popup.getBoundingClientRect().width),
      swatches: popup.querySelectorAll(`.${swatchClass}`).length,
      viewport: window.innerWidth,
      overlayWidth: style.getPropertyValue("--mdy-overlay-width").trim() || "(unset)",
      overlayMaxHeight: style.getPropertyValue("--mdy-overlay-max-height").trim() || "(unset)",
    };
  }, { popupClass: COLORS.parts.popup.classes[0], swatchClass: classOf("swatch") });

  // Controls, in the order that makes the assertion mean something. The popup is open; it holds the
  // swatches the contract names, so a narrow popup is not an empty one; and the page has room for
  // the declared minimum several times over.
  expect(seen.open, "the colours popup did not open").toBe(true);
  expect(seen.swatches, "the popup holds no swatches, so its width is not about its content").toBeGreaterThan(0);
  expect(seen.viewport, "the viewport has no room for the declared minimum").toBeGreaterThan(minWidth + 100);

  // And the number declared beside it, down the same path, on this same element.
  expect(
    seen.overlayMaxHeight,
    "the neighbouring capability does not reach the element either, so the path is not the thing being tested",
  ).not.toBe("(unset)");

  expect(
    seen.width,
    `the popup is ${seen.width}px holding ${seen.swatches} swatches, against a declared minimum of ${minWidth}px (--mdy-overlay-width ${seen.overlayWidth})`,
  ).toBeGreaterThanOrEqual(minWidth);
});

const SELECT = MDY_WIDGET_CONTRACTS.select as unknown as {
  capabilities: { anchoring: { matchAnchorWidth: boolean } };
  parts: Record<string, { classes: string[] }>;
};

test("a popup told to match its anchor takes the width it was given", async ({ page }) => {
  test.setTimeout(120_000);

  // The control: this kind declares that its popup follows its anchor, which is the other half of
  // the same capability — one kind declares a floor, this one declares an equality.
  expect(SELECT.capabilities.anchoring.matchAnchorWidth, "the select popup no longer follows its anchor").toBe(true);

  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  // A long label, so a content-sized popup and an anchor-sized one cannot be the same number by
  // accident. With short options both come out at the trigger's width and the question goes unasked.
  const mounted = await page.evaluate(() =>
    (window as never as Record<string, { mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string } }>)
      .battle.mountFields("matching", [{
        name: "pick",
        kind: "select",
        label: "Pick",
        options: [
          { value: "a", label: "An extremely long option label that will not fit in a narrow box" },
          { value: "b", label: "B" },
        ],
      }] as never));
  expect(mounted.mounted, `the select did not mount: ${mounted.message ?? ""}`).toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));

  await page.locator(`[data-form="matching"] .${SELECT.parts.trigger.classes.join(".")}`).first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  const seen = await page.evaluate(({ popupClass }) => {
    const popup = (Array.from(document.querySelectorAll(`.${popupClass}`)) as HTMLElement[])
      .find((each) => each.getClientRects().length > 0);
    if (popup === undefined) return { open: false };
    const declared = getComputedStyle(popup).getPropertyValue("--mdy-overlay-width").trim();
    return {
      open: true,
      rendered: Math.round(popup.getBoundingClientRect().width),
      given: declared,
      givenPx: declared.endsWith("px") ? Math.round(Number.parseFloat(declared)) : null,
    };
  }, { popupClass: SELECT.parts.popup.classes[0] });

  expect(seen.open, "the select popup did not open").toBe(true);

  // The control that this is a width the machinery computed rather than one nobody asked for: the
  // property is set on the element, in pixels.
  expect(seen.givenPx, `the overlay width property is not a pixel value: ${seen.given}`).not.toBeNull();

  // A popup that follows its anchor is the width the anchoring computed for it. This one is sized by
  // its content instead — the same loss as the declared minimum above, on the other half of the rule.
  expect(
    seen.rendered,
    `the popup renders ${seen.rendered}px while the anchoring gave it ${seen.given}`,
  ).toBe(seen.givenPx);
});
