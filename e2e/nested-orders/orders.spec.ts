import { expect, test, type Page } from "@playwright/test";

/**
 * The flagship promise, on all three renderers at once: the interface renders portions of the
 * structure, while the model owns identity, data, validity and lifecycle whole.
 */
const entry = (project: string): string =>
  project.startsWith("plain") ? "/lab.html#orders" : project.startsWith("lit") ? "/enterprise.html" : "/";
const scopeOf = (page: Page, project: string) =>
  project.startsWith("angular") ? page.locator("app-orders-section") : page.locator("body");

const state = async (page: Page, project: string) =>
  JSON.parse((await scopeOf(page, project).locator("pre.demo-state").textContent()) ?? "{}");

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto(entry(testInfo.project.name));
  await scopeOf(page, testInfo.project.name).locator("[data-order]").first().waitFor();
});

test("a line under-allocated gates the form, named by its own path", async ({ page }, testInfo) => {
  const s = await state(page, testInfo.project.name);
  expect(s.valid).toBe(false);
  const errors = Object.values(s.lineErrors).flat() as Array<{ message: string; path: string }>;
  expect(errors[0]!.message).toContain("allocated 2 of 3");
  expect(errors[0]!.path).toBe("orders.tmp:1.lines");
});

test("a collapsed order keeps its verdict; a filtered one keeps its rows", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Collapse first" }).click();
  await expect(scope.locator("[data-line]")).toHaveCount(0);
  let s = await state(page, testInfo.project.name);
  expect(s.valid).toBe(false);
  expect(Object.values(s.lineErrors).flat().length).toBeGreaterThan(0);

  await scope.getByRole("button", { name: "Filter ORD" }).click();
  await expect(scope.locator("[data-order]")).toHaveCount(0);
  await expect.poll(async () => (await state(page, testInfo.project.name)).orders).toEqual(["tmp:1"]);
  s = await state(page, testInfo.project.name);
  expect(s.orders).toEqual(["tmp:1"]);
  expect(s.lines["tmp:1"]).toEqual(["l1"]);
});

test("the demonstrative moment: allocate, collapse, filter, server rename — coherent throughout", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Add allocation" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(true);
  await scope.getByRole("button", { name: "Collapse first" }).click();
  await scope.getByRole("button", { name: "Filter ORD" }).click();
  await scope.getByRole("button", { name: "Server assigns code" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).orders[0]).toMatch(/^ORD-/);
  const s = await state(page, testInfo.project.name);
  expect(s.orders).toHaveLength(1);
  const order = s.value[s.orders[0]];
  expect(Object.keys(order.lines.l1.allocs)).toHaveLength(2);
  expect(s.valid).toBe(true);
});

test("a removed order comes back whole on undo", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Remove order" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).orders).toEqual([]);
  await scope.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).orders).toEqual(["tmp:1"]);
  const s = await state(page, testInfo.project.name);
  expect(s.lines["tmp:1"]).toEqual(["l1"]);
  expect(Object.keys(s.value["tmp:1"].lines.l1.allocs)).toEqual(["a1"]);
});
