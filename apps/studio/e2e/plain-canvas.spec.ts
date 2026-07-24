import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("Live form mounts @modyra/plain while Structure remains the authoring fallback", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill("customerName");
  await page.locator('[data-name]').blur();

  await page.locator('[data-canvas-mode="form"]').click();
  await expect(page.locator('[data-canvas-surface="form"]')).toBeVisible();
  const input = page.locator('[data-plain-canvas] input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.fill("Ada");
  await expect(input).toHaveValue("Ada");
  await expect(input).toBeFocused();

  await page.locator('[data-canvas-mode="structure"]').click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await expect(page.locator('[data-name]')).toHaveValue("customerName");
});

test("blocking Contract diagnostics produce an editor-safe live-form placeholder", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();
  await page.locator('[data-canvas-mode="form"]').click();

  await expect(page.locator('.plain-canvas-unavailable')).toContainText("blocking Contract diagnostics");
  await expect(page.locator('[data-plain-canvas]')).toHaveCount(0);

  await page.locator('[data-canvas-mode="structure"]').click();
  await expect(page.locator('.tree-node .indicator.issue')).toHaveCount(1);
});
