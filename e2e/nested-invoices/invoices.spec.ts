import { expect, test, type Page } from "@playwright/test";

/** The business promise: validity lives in the model, not in the viewport. */
const entry = (project: string): string =>
  project.startsWith("plain") ? "/lab.html#invoices" : project.startsWith("lit") ? "/enterprise.html" : "/";
const scopeOf = (page: Page, project: string) =>
  project.startsWith("angular") ? page.locator("app-invoices-section")
  : project.startsWith("lit") ? page.locator("nested-invoices") : page.locator("body");

const state = async (page: Page, project: string) =>
  JSON.parse((await scopeOf(page, project).locator("pre.demo-state").textContent()) ?? "{}");

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto(entry(testInfo.project.name));
  await scopeOf(page, testInfo.project.name).locator("[data-invoice]").first().waitFor();
});

test("the demonstrative moment: a closed line at 95% keeps the invoice invalid, and reopening finds the error", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Close the line" }).click();
  await expect(scope.locator("[data-split]")).toHaveCount(0);
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(false);
  expect(JSON.stringify((await state(page, testInfo.project.name)).lineErrors)).toContain("95%");

  await scope.getByRole("button", { name: "Reopen the line" }).click();
  await expect(scope.locator("[data-split]")).toHaveCount(2);
  expect(JSON.stringify((await state(page, testInfo.project.name)).lineErrors)).toContain("95%");
});

test("a fixed split makes the invoice valid, and the server's verdict lands on the split it names", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Fix the split" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid).toBe(true);
  await scope.getByRole("button", { name: "Submit to the server" }).click();
  await expect.poll(async () => (await state(page, testInfo.project.name)).splitServerError).toEqual(["CC-10 is frozen this quarter"]);
});

test("an approved line is readonly but consulted: not editable, still in the value", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Approve the line" }).click();
  await expect(scope.locator("[data-line] input").first()).not.toBeEditable();
  const s = await state(page, testInfo.project.name);
  expect(s.value["INV-1"].lines.l1.desc).toBe("Consulting");
  expect(s.approved).toContain("invoices.INV-1.lines.l1");
});
