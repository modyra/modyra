import { expect, test } from "@playwright/test";

/**
 * P5 batch 2: server validator UI (dependencies, debounce/timeout,
 * skip-when-empty, stub creation) and the project-level form validator
 * section (add/edit/remove, condition templates — not a general recursive
 * expression builder, see STATUS.md gap note). All refs are picked from
 * <select>s populated from the tree, never typed (P5 gate: "no path typing").
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("enable server validation, configure it, create a stub, then remove it", async ({ page }) => {
  await page.locator('[data-template="text"]').click();

  await expect(page.locator("[data-enable-server-validator]")).toBeVisible();
  await page.locator("[data-enable-server-validator]").click();
  await expect(page.locator(".server-validator h3")).toHaveText("Server validation");

  await page.locator("[data-server-debounce]").fill("500");
  await page.locator("[data-server-debounce]").blur();
  await page.locator("[data-server-timeout]").fill("8000");
  await page.locator("[data-server-timeout]").blur();
  await page.locator("[data-server-skip-empty]").check();
  await page.locator("[data-server-message]").fill("Not available");
  await page.locator("[data-server-message]").blur();

  await expect(page.locator("[data-server-debounce]")).toHaveValue("500");
  await expect(page.locator("[data-server-timeout]")).toHaveValue("8000");
  await expect(page.locator("[data-server-skip-empty]")).toBeChecked();
  await expect(page.locator("[data-server-message]")).toHaveValue("Not available");

  // No implementation chosen yet — creating a stub must both register it and select it.
  await page.locator("[data-new-server-impl]").click();
  const implSelect = page.locator("[data-server-impl]");
  await expect(implSelect).not.toHaveValue("");
  const selectedLabel = await implSelect.locator("option:checked").textContent();
  expect(selectedLabel).toMatch(/^validate/);

  await page.locator("[data-remove-server-validator]").click();
  await expect(page.locator("[data-enable-server-validator]")).toBeVisible();
});

test("server validator dependency checkboxes are the only way to pick a dependency (no typing)", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-enable-server-validator]").click();

  const countryDep = page.locator('[data-server-dependency]').first();
  await countryDep.check();
  await expect(countryDep).toBeChecked();
  await countryDep.uncheck();
  await expect(countryDep).not.toBeChecked();
});

test("add a form validator (is not empty) and remove it", async ({ page }) => {
  await page.locator('[data-template="text"]').click();

  await expect(page.locator(".form-validators h2")).toHaveText("Form validators");
  await page.locator("[data-fv-op]").selectOption("isNotEmpty");
  await expect(page.locator("[data-fv-literal]")).toHaveCount(0);
  await page.locator("[data-fv-message]").fill("This field is required");
  await page.locator("[data-add-form-validator]").click();

  const row = page.locator(".form-validator-row");
  await expect(row).toHaveCount(1);
  await expect(row.locator("[data-form-validator-message]")).toHaveValue("This field is required");

  await row.locator("[data-remove-form-validator]").click();
  await expect(page.locator(".form-validator-row")).toHaveCount(0);
});

test("form validator condition needing a literal (equals) shows the value input; toggling op hides it again", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-fv-op]").selectOption("equals");
  await expect(page.locator("[data-fv-literal]")).toBeVisible();

  await page.locator("[data-fv-literal]").fill("expected-value");
  await page.locator("[data-fv-message]").fill("Must equal expected-value");
  await page.locator("[data-add-form-validator]").click();

  await expect(page.locator(".form-validator-row")).toHaveCount(1);
  await expect(page.locator(".form-validator-row .fv-meta")).toContainText("depends on:");

  await page.locator("[data-fv-op]").selectOption("isEmpty");
  await expect(page.locator("[data-fv-literal]")).toHaveCount(0);
});

test("inline-editing an existing form validator's message commits without recreating it", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-fv-op]").selectOption("isEmpty");
  await page.locator("[data-fv-message]").fill("Original message");
  await page.locator("[data-add-form-validator]").click();

  const messageInput = page.locator(".form-validator-row [data-form-validator-message]");
  await messageInput.fill("Edited message");
  await messageInput.blur();

  await expect(page.locator(".form-validator-row")).toHaveCount(1);
  await expect(messageInput).toHaveValue("Edited message");
});
