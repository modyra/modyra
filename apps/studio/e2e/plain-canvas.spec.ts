import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
  // Studio restores its last IndexedDB session. Each canvas scenario needs
  // a deterministic blank project instead of inheriting fields or blocking
  // diagnostics created by the preceding test in the same browser context.
  await page.locator("[data-new]").click();
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

test("live canvas fields expose stable node IDs and select the matching Inspector node", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  const nodeId = await page.locator('[data-node]').getAttribute('data-node');
  await page.locator('[data-name]').fill('customerName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-label]').fill('Customer name');
  await page.locator('[data-label]').blur();

  await page.locator('[data-canvas-mode="form"]').click();
  const field = page.locator('.plain-canvas-field');
  await expect(field).toHaveAttribute('data-node', nodeId!);
  await expect(field).toHaveAttribute('data-field-path', 'customerName');

  await page.locator('[data-plain-select]').click();
  await expect(page.locator('.plain-canvas-field.selected')).toHaveAttribute('data-node', nodeId!);
  await expect(page.locator('[data-inspector-tab="node"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-name]')).toHaveValue('customerName');
  await expect(page.locator('[data-plain-select]')).toBeFocused();
});


test("live canvas duplicate and delete actions use the existing command history", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('customerName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);
  await page.locator('.plain-canvas-field [data-duplicate]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);

  await page.locator('.plain-canvas-field').first().locator('[data-delete]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);

  await page.locator('[data-undo]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);
  await page.locator('[data-undo]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);
});


test("live canvas insertion points add fields before, between, and after existing fields", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('firstName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="email"]').click();
  await page.locator('[data-name]').fill('email');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);
  await expect(page.locator('[data-plain-insert="before"]')).toHaveCount(2);
  await expect(page.locator('[data-plain-insert="after"]')).toHaveCount(1);

  await page.locator('[data-plain-insert="before"]').nth(1).click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(3);
  await expect(page.locator('.plain-canvas-field').nth(1)).toHaveAttribute('data-field-path', /^text/);
  await expect(page.locator('.plain-canvas-field').nth(1).locator('[data-plain-select]')).toBeFocused();

  await page.locator('[data-plain-insert="after"]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(4);
  await expect(page.locator('.plain-canvas-field').last()).toHaveAttribute('data-field-path', /^text/);
});
