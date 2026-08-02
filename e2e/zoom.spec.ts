import { expect, test } from "@playwright/test";

/**
 * The form at 200% text, which is what WCAG 1.4.4 asks of it.
 *
 * Text resize is not page zoom: the viewport keeps its pixel size and only the type grows, so
 * anything sized in `px` stays put while everything around it doubles. That is the condition a
 * layout built in one text size has never been measured in, and the failure is not an exception —
 * it is a control clipped out of its own field, or a popup positioned against metrics that were
 * true before the text grew.
 *
 * `anchorOverlay` decides placement from measured space. These tests are the check that it is
 * measuring at the moment it places, rather than reusing numbers taken when the page loaded.
 */

/**
 * Not every `.mdy-renderer--select` on the demo page has a trigger — some are variants that render
 * a different control. Naming the trigger in the selector picks a widget that has one, rather than
 * whichever came first in the document: `.first()` answers a question about document order, and a
 * test that asks it gets a true answer to the wrong question.
 */
const SELECT = ".mdy-renderer--select:has(.mdy-select__trigger)";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

/** WCAG 1.4.4: text to 200%, viewport unchanged. */
async function doubleTextSize(page: import("@playwright/test").Page): Promise<void> {
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  // A resize the layout has not settled is a measurement of the frame before it.
  await page.waitForTimeout(150);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(TRIGGER).first()).toBeVisible();
});

test("no Modyra element pushes the page sideways at 200% text", async ({ page }) => {
  await doubleTextSize(page);

  // Scoped to the fields Modyra renders, not to every element carrying an `mdy-` class. The shared
  // vocabulary is deliberately available to host markup — the demo styles its own buttons with
  // `mdy-button` — so "has a Modyra class" does not mean "Modyra laid this out", and asserting on
  // the wider set reports the host's layout as a framework defect.
  const offenders = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    return [...document.querySelectorAll(".mdy-renderer")]
      .flatMap((field) => [field, ...field.querySelectorAll("*")])
      .filter((element) => element.getBoundingClientRect().right > limit + 2)
      .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`)
      .slice(0, 8);
  });
  expect(offenders).toEqual([]);

  // And the page as a whole, which is a weaker claim about Modyra and a stronger one about the
  // demo: WCAG 1.4.10's failure is having to scroll sideways to read. It is asserted second because
  // when it broke, the cause was the demo's own non-wrapping action row rather than any field —
  // separating the two is what stopped that being reported as a framework defect.
  const documentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(documentOverflow).toBeLessThanOrEqual(2);
});

test("the select still opens at 200% text, and its popup is on screen", async ({ page }) => {
  await doubleTextSize(page);

  await page.locator(TRIGGER).first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "true");

  const popup = page.locator(`${SELECT} .mdy-select__dropdown`).first();
  await expect(popup).toBeVisible();

  const box = await popup.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  // A popup placed off the viewport is unreachable, and it looks identical to a working one in
  // every assertion that only asks whether it is open.
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
});

test("a label and its control stay in the same field at 200% text", async ({ page }) => {
  await doubleTextSize(page);

  // The relationship is an id reference, so it survives any layout. What can break is the visual
  // one: a label that no longer sits with the control it names is a field the user has to guess at.
  const field = page.locator(SELECT).first();
  const label = field.locator(".mdy-label").first();
  const trigger = field.locator(".mdy-select__trigger").first();

  const [labelBox, triggerBox] = await Promise.all([label.boundingBox(), trigger.boundingBox()]);
  expect(labelBox).not.toBeNull();
  expect(triggerBox).not.toBeNull();
  if (!labelBox || !triggerBox) return;

  expect(labelBox.width).toBeGreaterThan(0);
  expect(triggerBox.width).toBeGreaterThan(0);
  // The label sits above its control, and they overlap horizontally rather than having drifted
  // into separate columns.
  expect(labelBox.y).toBeLessThanOrEqual(triggerBox.y + triggerBox.height);
  expect(labelBox.x).toBeLessThan(triggerBox.x + triggerBox.width);
});
