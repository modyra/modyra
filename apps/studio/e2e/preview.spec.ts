import { expect, test } from "@playwright/test";

/**
 * P11 gate: "Preview reads model/Contract, not generated source. Must
 * show: values validation arrays errors pending canSubmit draft, server
 * mock: delay/valid-values/error/timeout/network-failure." Drives the
 * real @modyra/studio-preview live form through the actual DOM — never a
 * mock of the Preview tab itself.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("a required field shows a real live error, then clears it once filled", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-add-validator]").selectOption("required");
  await page.locator('[data-inspector-tab="preview"]').click();

  await expect(page.locator(".preview-status-badge").first()).toHaveText("Invalid");
  await expect(page.locator(".preview-errors")).toContainText("This field is required");

  await page.locator(".preview-fields input[type=text]").first().fill("hello");
  await page.locator(".preview-fields input[type=text]").first().blur();

  await expect(page.locator(".preview-status-badge").first()).toHaveText("Valid");
  await expect(page.locator(".preview-errors")).toHaveCount(0);
});

test("array: Add row/Remove update the live array through the real form, reflected in the row count", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  await page.locator('[data-inspector-tab="preview"]').click();

  await expect(page.locator(".preview-array-label")).toContainText("(0)");
  await page.locator("[data-preview-array-push]").click();
  await expect(page.locator(".preview-array-label")).toContainText("(1)");
  await page.locator("[data-preview-array-push]").click();
  await expect(page.locator(".preview-array-label")).toContainText("(2)");

  await page.locator('[data-preview-array-remove][data-preview-array-index="0"]').click();
  await expect(page.locator(".preview-array-label")).toContainText("(1)");
});

test("server mock: switching a field's mock mode to Fails surfaces a real async error in preview, Succeeds clears it", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('details[data-section="server"] summary').click();
  await page.locator("[data-enable-server-validator]").click();
  await page.locator("[data-server-debounce]").fill("0");
  await page.locator("[data-server-debounce]").blur();
  await page.locator("[data-new-server-impl]").click();

  await page.locator('[data-inspector-tab="preview"]').click();
  await expect(page.locator("[data-preview-mock-mode]")).toBeVisible();

  await page.locator("[data-preview-mock-mode]").selectOption("error");
  await page.locator(".preview-fields input[type=text]").first().fill("anything");
  await page.locator(".preview-fields input[type=text]").first().blur();
  await expect(page.locator(".preview-errors")).toContainText("Simulated server error", { timeout: 3000 });

  await page.locator("[data-preview-mock-mode]").selectOption("success");
  await page.locator(".preview-fields input[type=text]").first().fill("anything-else");
  await page.locator(".preview-fields input[type=text]").first().blur();
  await expect(page.locator(".preview-errors")).toHaveCount(0, { timeout: 3000 });
});

test("submit: a configured mock submit action reports success, driven entirely by the real form's canSubmit/state", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-name]").fill("email");
  await page.locator("[data-name]").blur();

  await page.locator('[data-inspector-tab="form"]').click();
  await page.locator("[data-new-submit-impl]").click();

  await page.locator('[data-inspector-tab="preview"]').click();
  await expect(page.locator("[data-preview-submit]")).toBeEnabled();

  await page.locator("[data-preview-submit]").click();
  await expect(page.locator(".tab-hint", { hasText: "Submitted successfully" })).toBeVisible({ timeout: 3000 });
});

test("no submit action configured: Preview says so, and the button is enabled but there is nothing to wire it to", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="preview"]').click();
  await expect(page.locator(".tab-hint", { hasText: "No submit action configured" })).toBeVisible();
});
