import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * The three columns. Studio's shell used to hide the inspector below 1000px and the outline below
 * 760px, so on anything narrower than a laptop the properties panel, form rules, diagnostics,
 * export and preview were not small — they were gone, with nothing to open them.
 */
test("every column is reachable at every width", async ({ page }) => {
  for (const width of [1400, 1100, 990, 900, 700, 500]) {
    await page.setViewportSize({ width, height: 900 });
    await openStudio(page);
    for (const selector of [".outline", ".inspector"]) {
      const display = await page.locator(selector).evaluate((el) => getComputedStyle(el).display);
      expect(display, `${selector} at ${width}px`).not.toBe("none");
    }
  }
});

test("a rail sizes its column, and the width is remembered", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openStudio(page);

  const outline = page.locator(".outline");
  const before = (await outline.boundingBox())!.width;
  const rail = (await page.locator('[data-resize="outline"]').boundingBox())!;
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 200);
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width / 2 + 90, rail.y + 200, { steps: 8 });
  await page.mouse.up();

  const after = (await outline.boundingBox())!.width;
  expect(after).toBeGreaterThan(before + 60);

  // A column width is a preference, so it survives the reload that loses everything else.
  await page.reload();
  await page.waitForSelector(".studio");
  expect((await page.locator(".outline").boundingBox())!.width).toBeCloseTo(after, 0);
});

test("a rail can be moved from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openStudio(page);

  const inspector = page.locator(".inspector");
  const before = (await inspector.boundingBox())!.width;
  await page.locator('[data-resize="inspector"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect((await inspector.boundingBox())!.width).toBeGreaterThan(before);
});

test("a narrow window turns the rail into the tab that opens its panel", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await openStudio(page);

  const inspector = page.locator(".inspector");
  const viewport = page.viewportSize()!.width;
  expect((await inspector.boundingBox())!.x).toBeGreaterThanOrEqual(viewport - 8);

  await page.locator('[data-resize="inspector"]').click();
  await expect
    .poll(async () => (await inspector.boundingBox())!.x)
    .toBeLessThan(viewport - 100);
});
