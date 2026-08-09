import { expect, test } from "@playwright/test";

/**
 * The table's promise, in a browser: what is rendered never decides what the form holds.
 *
 * Each of these is a way the promise breaks if rows follow the rendering — and each is something a
 * user does without thinking: sorting a column, closing an editor, saving a new row.
 */

const verdict = ".keyed-rows-state";
const rowByKey = (key: string) => `table.keyed-rows tr:has(td:text-is("${key}"))`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("table.keyed-rows")).toBeVisible();
});

test("sorting re-renders every cell and moves no value", async ({ page }) => {
  await expect(page.locator(verdict)).toContainText('"Espresso"');

  await page.getByRole("button", { name: "Sort descending" }).click();

  const firstKey = page.locator("table.keyed-rows tbody tr").first().locator("td").first();
  await expect(firstKey).toHaveText("tmp:1");
  await expect(page.locator(verdict)).toContainText('"Espresso"');
  await expect(page.locator(verdict)).toContainText('"Cornetto"');
});

test("closing every editor keeps the values and the verdict", async ({ page }) => {
  await page.locator(rowByKey("12")).getByRole("button", { name: "Edit" }).click();
  const cell = page.locator(rowByKey("12")).locator("input").first();
  await cell.fill("Ristretto");

  await page.getByRole("button", { name: "Close every editor" }).click();

  await expect(page.locator("table.keyed-rows input")).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator(verdict)).toContainText('"Ristretto"');
  await expect(page.locator(rowByKey("12"))).toContainText("Ristretto");
});

test("a row nobody is rendering still makes the form invalid", async ({ page }) => {
  // `tmp:1` starts with an empty required name.
  await expect(page.locator(verdict)).toContainText("rows valid: false");

  await page.getByRole("button", { name: "Close every editor" }).click();
  await expect(page.locator("table.keyed-rows input")).toHaveCount(0, { timeout: 2000 });

  await expect(page.locator(verdict)).toContainText("rows valid: false");
});

test("saving a provisional row renames the key and keeps what was typed", async ({ page }) => {
  const provisional = page.locator(rowByKey("tmp:1"));
  await provisional.locator("input").first().fill("Maritozzo");

  await provisional.getByRole("button", { name: "Save" }).click();

  await expect(page.locator(rowByKey("tmp:1"))).toHaveCount(0);
  await expect(page.locator(verdict)).toContainText('"Maritozzo"');
  await expect(page.locator(verdict)).not.toContainText("tmp:1");
});

test("removing a row takes its value with it", async ({ page }) => {
  await page.locator(rowByKey("34")).getByRole("button", { name: "Remove" }).click();

  await expect(page.locator(rowByKey("34"))).toHaveCount(0);
  await expect(page.locator(verdict)).not.toContainText('"Cornetto"');
});
