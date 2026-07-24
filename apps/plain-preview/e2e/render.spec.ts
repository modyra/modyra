import { expect, test } from "@playwright/test";
import { createCheckoutProject } from "../../../packages/studio-model/test/fixtures/checkout.fixture.mjs";

/**
 * Closes the loop back to Studio for real: a project shaped exactly like
 * what Studio's own Export tab (JSON target) produces, run through the
 * real loadProject -> compileToContract -> flattenContractFields pipeline,
 * rendered with @modyra/plain's mountMdyForm — genuine interactive DOM in
 * a real browser, not a screenshot or a mocked pipeline.
 */

test("pasting a real Studio project renders real, interactive fields with zero console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");

  await expect(page.locator("[data-plain-status]")).toHaveText("Rendered 6 field(s) via @modyra/plain.");
  // city, zip, sku, coupon (real text inputs) + the select's own combobox trigger (also type=text) = 5.
  await expect(page.locator('[data-plain-form] input[type="text"]')).toHaveCount(5);
  await expect(page.locator('[data-plain-form] input[type="number"]')).toHaveCount(1); // qty
  expect(errors).toEqual([]);
});

test("typing into a rendered text field is a real, focus-preserving DOM update", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");

  // Exclude the select's own combobox trigger (also type=text) to land on the real city field.
  const cityInput = page.locator('[data-plain-form] input[type="text"]:not(.mdy-plain-select input)').nth(0);
  await cityInput.fill("Rome");
  await expect(cityInput).toHaveValue("Rome");
  await expect(cityInput).toBeFocused(); // re-render on every keystroke must not steal focus
});

test("the select field opens a real listbox and commits a selection", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");

  const trigger = page.locator(".mdy-plain-select input");
  await trigger.click();
  const listbox = page.locator(".mdy-plain-select ul");
  await expect(listbox).toBeVisible();
  await page.click(".mdy-plain-select li >> nth=0");
  await expect(listbox).toBeHidden();
});

test("malformed JSON reports an error instead of throwing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await page.fill("[data-plain-json]", "{ not json");
  await page.click("[data-plain-render]");

  await expect(page.locator("[data-plain-status]")).toHaveText("Not valid JSON.");
  expect(errors).toEqual([]);
});
