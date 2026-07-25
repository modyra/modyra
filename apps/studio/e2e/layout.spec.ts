import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * Contract v2 layout authoring: column rows built in the canvas, rendered by
 * @modyra/plain, and carried into the exported Contract.
 */

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await page.locator("[data-new]").click();
});

async function addFields(page: import("@playwright/test").Page, names: string[]): Promise<void> {
  for (const name of names) {
    await page.locator('[data-template="text"]').click();
    await page.locator("[data-name]").fill(name);
    await page.locator("[data-name]").blur();
  }
}

const columnCounts = (page: import("@playwright/test").Page) =>
  page.locator(".mdy-layout-columns").evaluateAll((rows) => rows.map((row) => row.querySelectorAll(".mdy-layout-column").length));

async function toggleColumns(page: import("@playwright/test").Page, path: string): Promise<void> {
  const field = page.locator(`.plain-canvas-field[data-field-path="${path}"]`);
  await field.hover();
  await field.locator("[data-layout-columns]").click();
}

test("two fields become a column row, and a third widens it", async ({ page }) => {
  await addFields(page, ["city", "zip", "extra"]);

  await toggleColumns(page, "city");
  expect(await columnCounts(page)).toEqual([2]);

  // The only remaining free field joins the existing row rather than starting a new one.
  await toggleColumns(page, "extra");
  expect(await columnCounts(page)).toEqual([3]);

  // And back out again — a row that drops below two columns disappears entirely.
  await toggleColumns(page, "extra");
  expect(await columnCounts(page)).toEqual([2]);
});

test("a column row stays where its fields are and is undoable", async ({ page }) => {
  await addFields(page, ["first", "city", "zip", "last"]);

  await toggleColumns(page, "city");
  expect(await columnCounts(page)).toEqual([2]);
  // Order is preserved: the arranged pair must not jump to the top of the form.
  await expect(page.locator(".plain-canvas-field")).toHaveCount(4);
  const order = await page.locator(".plain-canvas-field").evaluateAll((els) => els.map((e) => e.dataset.fieldPath));
  expect(order).toEqual(["first", "city", "zip", "last"]);

  await page.locator("[data-undo]").click();
  expect(await columnCounts(page)).toEqual([]);
});

test("clicking a field pairs it with a free neighbour, not with an already-arranged one", async ({ page }) => {
  await addFields(page, ["a", "b", "c", "d"]);

  await toggleColumns(page, "a"); // a + b
  await toggleColumns(page, "c"); // must pair with d, not append to a+b
  expect(await columnCounts(page)).toEqual([2, 2]);
});

test("the authored layout reaches the exported Contract", async ({ page }) => {
  await addFields(page, ["city", "zip"]);
  await toggleColumns(page, "city");

  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-generate]").click();
  await page.waitForSelector(".export-file");

  const paths = await page.locator(".export-file-path").allInnerTexts();
  const index = paths.findIndex((p) => p.includes("contract.json"));
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator("details.accordion summary").nth(index).click();
  const contract = JSON.parse(await page.locator(".export-file-code").nth(index).innerText());

  expect(contract.layout).toEqual([
    { kind: "columns", id: expect.any(String), columns: [["city"], ["zip"]] },
  ]);
});

test("column rows are offered for root fields, not for fields inside a group", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator("[data-name]").fill("shipping");
  await page.locator("[data-name]").blur();
  const groupId = await page.locator(".plain-canvas-group").first().getAttribute("data-plain-group");

  await addFields(page, ["city"]);
  await page.locator("[data-plain-field-into]").last().selectOption(groupId!);

  // A group already owns where its children render; two owners for one node is the bug to avoid.
  const field = page.locator('.plain-canvas-field[data-field-path="shipping.city"]');
  await field.hover();
  await expect(field.locator("[data-layout-columns]")).toBeDisabled();
});
