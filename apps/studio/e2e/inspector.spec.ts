import { expect, test } from "@playwright/test";

/**
 * P5 gate: "all checkout validators visual" (add/edit/remove field
 * validators + options through the inspector, not the raw model) and
 * "bad compatibility diagnosed" (the add-validator dropdown only ever
 * offers kinds the registry says are compatible with the field's value
 * type — enforced both here in the UI and, authoritatively, by
 * studio-editor's createAddValidatorCommand).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("add, configure, and remove a pattern validator on a text field", async ({ page }) => {
  await page.locator('[data-template="text"]').click();

  const addValidator = page.locator("[data-add-validator]");
  await expect(addValidator).toBeVisible();
  await addValidator.selectOption("pattern");

  const row = page.locator(".validator-row", { hasText: "Pattern (regex)" });
  await expect(row).toHaveCount(1);

  await row.locator("[data-validator-pattern]").fill("^[A-Z]{2}$");
  await row.locator("[data-validator-pattern]").blur();
  await row.locator("[data-validator-message]").fill("Two uppercase letters");
  await row.locator("[data-validator-message]").blur();

  // Re-select the field (inspector rebuilds on every render) and confirm the edit stuck.
  await expect(page.locator('[data-validator-pattern]')).toHaveValue("^[A-Z]{2}$");
  await expect(page.locator('[data-validator-message]')).toHaveValue("Two uppercase letters");

  await row.locator("[data-remove-validator]").click();
  await expect(page.locator(".validator-row")).toHaveCount(0);
});

test("required validator cannot be added twice (registry: no duplicates)", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-add-validator]").selectOption("required");
  await expect(page.locator(".validator-row")).toHaveCount(1);

  // "required" must no longer be offered once already present.
  const remainingOptions = await page.locator("[data-add-validator] option").allTextContents();
  expect(remainingOptions).not.toContain("Required");
});

test("number field's add-validator list never offers email/pattern (incompatible value type)", async ({ page }) => {
  await page.locator('[data-template="number"]').click();
  const options = await page.locator("[data-add-validator] option").allTextContents();
  expect(options).toContain("Minimum value");
  expect(options).toContain("Maximum value");
  expect(options).not.toContain("Email format");
  expect(options).not.toContain("Pattern (regex)");
});

test("select field: add/edit/remove options through the inspector", async ({ page }) => {
  await page.locator('[data-template="select"]').click();

  const optionsSection = page.locator('details[data-section="options"]');
  await expect(optionsSection.locator("summary")).toContainText("Options");
  await optionsSection.locator("summary").click();
  // createNodeFromTemplate seeds one default option.
  await expect(page.locator(".option-row")).toHaveCount(1);

  await page.locator("[data-add-option]").click();
  await expect(page.locator(".option-row")).toHaveCount(2);

  const secondRow = page.locator(".option-row").nth(1);
  await secondRow.locator("[data-option-value]").fill("XL");
  await secondRow.locator("[data-option-value]").blur();
  await secondRow.locator("[data-option-label]").fill("Extra Large");
  await secondRow.locator("[data-option-label]").blur();

  await expect(page.locator(".option-row").nth(1).locator("[data-option-value]")).toHaveValue("XL");
  await expect(page.locator(".option-row").nth(1).locator("[data-option-label]")).toHaveValue("Extra Large");

  await page.locator(".option-row").first().locator("[data-remove-option]").click();
  await expect(page.locator(".option-row")).toHaveCount(1);
  await expect(page.locator(".option-row").first().locator("[data-option-value]")).toHaveValue("XL");
});

test("a group node shows no Validation/Options/Server validation sections (not a field)", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await expect(page.locator('details[data-section="validation"]')).toHaveCount(0);
  await expect(page.locator('details[data-section="options"]')).toHaveCount(0);
  await expect(page.locator('details[data-section="server"]')).toHaveCount(0);
});
