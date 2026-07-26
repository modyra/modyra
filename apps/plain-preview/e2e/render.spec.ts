import { expect, test } from "@playwright/test";
import { createCheckoutProject } from "../../../packages/studio-model/test/fixtures/checkout.fixture.mjs";

/** Browser coverage for importing and rendering an exported Studio project. */

test("renders an exported Studio project without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");

  await expect(page.locator("[data-plain-status]")).toHaveText("Rendered 6 field(s) via @modyra/plain.");
  // city, zip, sku, coupon (text inputs) + the select's own combobox trigger (also type=text) = 5.
  await expect(page.locator('[data-plain-form] input[type="text"]')).toHaveCount(5);
  await expect(page.locator('[data-plain-form] input[type="number"]')).toHaveCount(1); // qty
  expect(errors).toEqual([]);
});

test("typing into a rendered text field preserves focus", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");

  // Exclude the select's own combobox trigger (also type=text) to land on the city field.
  const cityInput = page.locator('[data-plain-form] input[type="text"]:not(.mdy-plain-select input)').nth(0);
  await cityInput.fill("Rome");
  await expect(cityInput).toHaveValue("Rome");
  await expect(cityInput).toBeFocused(); // re-render on every keystroke must not steal focus
});

test("the select field opens its listbox and commits a selection", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");

  const trigger = page.locator(".mdy-plain-select input");
  await trigger.click();
  const listbox = page.locator("body > .mdy-plain-select__portal");
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute("role", "listbox");
  await listbox.locator("li").first().click();
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


test("invalid JSON preserves the last successfully rendered form", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-plain-json]", JSON.stringify(createCheckoutProject()));
  await page.click("[data-plain-render]");
  const count = await page.locator("[data-plain-form] input").count();
  expect(count).toBeGreaterThan(0);
  await page.fill("[data-plain-json]", "{ invalid");
  await page.click("[data-plain-render]");
  await expect(page.locator("[data-plain-status]")).toHaveText("Not valid JSON.");
  await expect(page.locator("[data-plain-form] input")).toHaveCount(count);
});
