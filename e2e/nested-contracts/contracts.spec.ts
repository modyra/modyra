import { expect, test, type Page } from "@playwright/test";

/**
 * The advanced promise: a rule about a whole collection is checked where the collection lives.
 *
 * Overlaps and gaps between price bands are refused by the collection that owns the bands, which is
 * why the verdict survives collapsing every band; and sorting bands for reading never renames them.
 */
const entry = (project: string): string =>
  project.startsWith("plain") ? "/lab.html#contracts" : project.startsWith("lit") ? "/enterprise.html" : "/";
const scopeOf = (page: Page, project: string) =>
  project.startsWith("angular") ? page.locator("app-contracts-section")
  : project.startsWith("lit") ? page.locator("nested-contracts") : page.locator("body");

const state = async (page: Page, project: string) =>
  JSON.parse((await scopeOf(page, project).locator("pre.demo-state").textContent()) ?? "{}");

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto(entry(testInfo.project.name));
  await scopeOf(page, testInfo.project.name).locator("[data-contract]").first().waitFor();
});

test("the demonstrative moment: a moved threshold overlaps, and the error names both bands", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(true);

  await scope.getByRole("button", { name: "Move the threshold" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(false);
  const overlapping = (await state(page, testInfo.project.name)).bandErrors.join(" ");
  expect(overlapping).toContain("b1");
  expect(overlapping).toContain("b2");
  expect(overlapping).toContain("overlap");
});

test("a gap is refused as loudly as an overlap, and naming the quantities left uncovered", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Leave a gap" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).bandErrors.join(" ")).toContain("uncovered");
  await scope.getByRole("button", { name: "Restore the ladder" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(true);
});

test("a collapsed band still gates the contract: the rule lives on the collection, not on the screen", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Move the threshold" }).click();
  await scope.getByRole("button", { name: "Collapse the bands" }).click();
  await expect(scope.locator("[data-band]")).toHaveCount(0);
  const s = await state(page, testInfo.project.name);
  expect(s.valid).toBe(false);
  expect(s.bandErrors.join(" ")).toContain("overlap");
});

test("a price that rises with volume is refused one level up, on the line that owns the bands", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Add a band" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(true);
  await scope.getByRole("button", { name: "Raise the top price" }).click();
  await expect.poll(async () => JSON.stringify((await state(page, testInfo.project.name)).lineErrors)).toContain("costs more per unit");
});

test("sorting for reading never renames: the keys are the model's, the order is the screen's", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  const before = await state(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Sort descending" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).readingOrder)
    .toEqual([...before.readingOrder].reverse());
  const after = await state(page, testInfo.project.name);
  expect(after.bands).toEqual(before.bands);
  expect(after.value).toEqual(before.value);
});

test("the server's refusal lands on the band it names", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Send for approval" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).serverErrors)
    .toEqual(["Discount above 20% needs approval"]);
});
