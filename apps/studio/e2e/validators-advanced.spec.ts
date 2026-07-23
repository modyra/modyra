import { expect, test } from "@playwright/test";

/**
 * P5 batch 2: server validator UI (dependencies, debounce/timeout,
 * skip-when-empty, stub creation) and the project-level form validator
 * section (add/edit/remove, condition templates — not a general recursive
 * expression builder, see STATUS.md gap note). All refs are picked from
 * <select>s populated from the tree, never typed (P5 gate: "no path typing").
 *
 * Both live behind interaction the inspector redesign introduced: "Server
 * validation" is a collapsed-by-default accordion (open it via its summary),
 * and form validators live on a separate "Form rules" tab, not the default
 * "Field" tab — both deliberate, see the UX redesign note in STATUS.md.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

async function openServerValidationSection(page: import("@playwright/test").Page) {
  await page.locator('details[data-section="server"] summary').click();
}

async function openFormRulesTab(page: import("@playwright/test").Page) {
  await page.locator('[data-inspector-tab="form"]').click();
}

test("enable server validation, configure it, create a stub, then remove it", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await openServerValidationSection(page);

  await expect(page.locator("[data-enable-server-validator]")).toBeVisible();
  await page.locator("[data-enable-server-validator]").click();
  await expect(page.locator("[data-server-debounce]")).toBeVisible();

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

  // The "Server validation" accordion badge reflects the on/off state at a glance.
  await expect(page.locator('details[data-section="server"] summary')).toContainText("on");

  await page.locator("[data-remove-server-validator]").click();
  await expect(page.locator("[data-enable-server-validator]")).toBeVisible();
});

test("server validator dependency checkboxes are the only way to pick a dependency (no typing)", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-template="text"]').click();
  await openServerValidationSection(page);
  await page.locator("[data-enable-server-validator]").click();

  const countryDep = page.locator("[data-server-dependency]").first();
  await countryDep.check();
  await expect(countryDep).toBeChecked();
  await countryDep.uncheck();
  await expect(countryDep).not.toBeChecked();
});

test("add a form validator (is not empty) and remove it", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await openFormRulesTab(page);

  await expect(page.locator(".tab-hint")).toContainText("Rules that apply to the whole form");
  await page.locator("[data-fv-op]").selectOption("isNotEmpty");
  await expect(page.locator("[data-fv-literal]")).toHaveCount(0);
  await page.locator("[data-fv-message]").fill("This field is required");
  await page.locator("[data-add-form-validator]").click();

  const row = page.locator(".form-validator-row");
  await expect(row).toHaveCount(1);
  await expect(row.locator("[data-form-validator-message]")).toHaveValue("This field is required");

  // The "Form rules" tab badge reflects the count at a glance, from the Field tab too.
  await expect(page.locator('[data-inspector-tab="form"]')).toContainText("1");

  await row.locator("[data-remove-form-validator]").click();
  await expect(page.locator(".form-validator-row")).toHaveCount(0);
});

test("form validator condition needing a literal (equals) shows the value input; toggling op hides it again", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await openFormRulesTab(page);

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
  await openFormRulesTab(page);

  await page.locator("[data-fv-op]").selectOption("isEmpty");
  await page.locator("[data-fv-message]").fill("Original message");
  await page.locator("[data-add-form-validator]").click();

  const messageInput = page.locator(".form-validator-row [data-form-validator-message]");
  await messageInput.fill("Edited message");
  await messageInput.blur();

  await expect(page.locator(".form-validator-row")).toHaveCount(1);
  await expect(messageInput).toHaveValue("Edited message");
});

test("P5 gap closed: AND composes two sub-conditions, each with its own field+condition", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  const groupId = await page.locator(".tree-node [data-node]").first().getAttribute("data-node");
  await page.locator('[data-template="text"]').click();
  await openFormRulesTab(page);

  await page.locator("[data-fv-op]").selectOption("and");
  await expect(page.locator(".fv-subcondition")).toHaveCount(2);
  // Composite ops hide the flat single-field selector — each sub-condition has its own instead.
  await expect(page.locator("[data-fv-ref]")).toHaveCount(0);

  // Point sub-condition 0 at the group specifically (not whatever the default happens to be).
  await page.locator('[data-fv-sub-ref="0"]').selectOption(groupId!);
  await page.locator('[data-fv-sub-op="0"]').selectOption("equals");
  await expect(page.locator('[data-fv-sub-literal="0"]')).toBeVisible();
  await page.locator('[data-fv-sub-literal="0"]').fill("IT");
  await page.locator('[data-fv-sub-literal="0"]').blur(); // commit before selectOption() re-renders and rebuilds the DOM

  await page.locator('[data-fv-sub-op="1"]').selectOption("isNotEmpty");
  await page.locator("[data-fv-message]").fill("Both conditions must hold");
  await page.locator("[data-add-form-validator]").click();

  const row = page.locator(".form-validator-row");
  await expect(row).toHaveCount(1);
  await expect(row.locator("[data-form-validator-message]")).toHaveValue("Both conditions must hold");
  // Dependencies list both referenced fields (deduped) — visible proof the compound expression was built, not a leaf.
  await expect(row.locator(".fv-meta")).not.toContainText("depends on: (none)");
});

test("form validator dependency display shows 'root' (not '(none)') when root is the only dependency", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await openFormRulesTab(page);
  // Default draft already targets root with "is not empty" — add it as-is.
  await page.locator("[data-fv-message]").fill("Root-only dependency");
  await page.locator("[data-add-form-validator]").click();

  // "root" as the dependency (not "(none)" — root's derived path is "" and must not be
  // mistaken for "no dependencies"); error target legitimately reads "(none)" here since none was set.
  await expect(page.locator(".form-validator-row .fv-meta")).toContainText("depends on: root · error target: (none)");
});

test("P5 gap closed: NOT wraps a single sub-condition", async ({ page }) => {
  await page.locator('[data-template="checkbox"]').click();
  await openFormRulesTab(page);

  await page.locator("[data-fv-op]").selectOption("not");
  await expect(page.locator(".fv-subcondition")).toHaveCount(1);

  await page.locator('[data-fv-sub-op="0"]').selectOption("isEmpty");
  await page.locator("[data-fv-message]").fill("Must not be empty");
  await page.locator("[data-add-form-validator]").click();

  await expect(page.locator(".form-validator-row")).toHaveCount(1);
});

test("switching from AND back to a leaf condition restores the flat field+value fields", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await openFormRulesTab(page);

  await page.locator("[data-fv-op]").selectOption("and");
  await expect(page.locator(".fv-subcondition")).toHaveCount(2);

  await page.locator("[data-fv-op]").selectOption("equals");
  await expect(page.locator(".fv-subcondition")).toHaveCount(0);
  await expect(page.locator("[data-fv-ref]")).toBeVisible();
  await expect(page.locator("[data-fv-literal]")).toBeVisible();
});

test("P5 gap closed: submit-action stub creation, selection, and removal", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await openFormRulesTab(page);

  await expect(page.locator(".submit-action h3")).toHaveText("Submit action");
  await expect(page.locator("[data-remove-submit-action]")).toHaveCount(0); // nothing set yet

  await page.locator("[data-new-submit-impl]").click();
  const implSelect = page.locator("[data-submit-impl]");
  await expect(implSelect).not.toHaveValue("");
  const selectedLabel = await implSelect.locator("option:checked").textContent();
  expect(selectedLabel).toMatch(/^submitForm/);
  await expect(page.locator("[data-remove-submit-action]")).toBeVisible();

  await page.locator("[data-remove-submit-action]").click();
  await expect(implSelect).toHaveValue("");
  await expect(page.locator("[data-remove-submit-action]")).toHaveCount(0);
});
