import { expect, test } from "@playwright/test";
import { openStudio, showStructure } from "./support/studio.js";

/** Navigation and quick-fix behavior for project diagnostics. */

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

test("a select field with no options: tree shows the issue marker, tab badge is red, Go to selects the field", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();

  // An uncompilable Contract blocks the live form outright — the canvas says so instead of
  // silently rendering a form that does not match the project.
  await expect(page.locator(".plain-canvas-unavailable")).toBeVisible();
  await showStructure(page);
  await expect(page.locator(".outline .tree-node .indicator.issue")).toHaveCount(1);
  await expect(page.locator('[data-inspector-tab="diagnostics"] .badge')).toHaveClass(/badge-error/);

  await page.locator('[data-template="text"]').click(); // select a different node first
  await page.locator('[data-inspector-tab="diagnostics"]').click();
  // Same root cause reported twice: studio-model's own SELECT_WITHOUT_OPTIONS plus
  // studio-contract's UNCOMPILABLE_FIELD (it also blocks Contract export specifically).
  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(2);

  await page.locator('.inspector-body [data-goto-node]').first().click();
  // "Go to" must switch back to the Field tab and select the offending node.
  await expect(page.locator('[data-inspector-tab="node"][aria-selected="true"]')).toHaveCount(1);
  await expect(page.locator("[data-name]")).not.toHaveValue("Text");
});

test("quick-fix: 'Add a default option' resolves the select-without-options error", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();
  await page.locator('[data-inspector-tab="diagnostics"]').click();

  await page.locator(".inspector-body [data-fix-add-option]").click();

  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(0);
  await expect(page.locator(".tab-hint")).toContainText("No issues found");
  await showStructure(page);
  await expect(page.locator(".outline .tree-node .indicator.issue")).toHaveCount(0);
});

test("quick-fix: 'Clear pattern' resolves an invalid regex", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-add-validator]").selectOption("pattern");
  await page.locator("[data-validator-pattern]").fill("([unclosed");
  await page.locator("[data-validator-pattern]").blur();

  await page.locator('[data-inspector-tab="diagnostics"]').click();
  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(1);
  await expect(page.locator(".inspector-body .diagnostic-row")).toContainText("Invalid regular expression");

  await page.locator(".inspector-body [data-fix-clear-pattern]").click();
  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(0);
});

test("quick-fix: 'Exclude from draft' resolves a sensitive-field warning without touching other draft config", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-name]").fill("password");
  await page.locator("[data-name]").blur();

  await page.locator('[data-inspector-tab="diagnostics"]').click();
  await expect(page.locator(".diagnostic-row.severity-warning")).toHaveCount(1);
  await expect(page.locator(".inspector-body .diagnostic-row")).toContainText("looks sensitive");

  await page.locator(".inspector-body [data-fix-exclude-draft]").click();
  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(0);
});

test("undo after a quick-fix brings the diagnostic back", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();
  await page.locator('[data-inspector-tab="diagnostics"]').click();

  await page.locator(".inspector-body [data-fix-add-option]").click();
  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(0);

  await page.locator("[data-undo]").focus();
  await page.keyboard.press("Enter");

  await page.locator('[data-inspector-tab="diagnostics"]').click();
  // Both SELECT_WITHOUT_OPTIONS and UNCOMPILABLE_FIELD reappear once the fix is undone.
  await expect(page.locator(".inspector-body .diagnostic-row")).toHaveCount(2);
});
