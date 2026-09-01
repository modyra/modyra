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
  // A verdict that crosses a server needs longer than a verdict a page computes. The default five
  // seconds is comfortable on one renderer alone and marginal under a full matrix, where the wait is
  // for a machine running three engines rather than for the form deciding anything — a flake that
  // reads as "the invoice never became valid" and is not about the invoice at all.
  const SERVER_ROUND_TRIP = { timeout: 15_000 };
  await expect.poll(async () => (await state(page, testInfo.project.name)).valid, SERVER_ROUND_TRIP).toBe(true);
  await scope.getByRole("button", { name: "Submit to the server" }).click();
  await expect
    .poll(async () => (await state(page, testInfo.project.name)).splitServerError, SERVER_ROUND_TRIP)
    .toEqual(["CC-10 is frozen this quarter"]);
});

test("an approved line is readonly but consulted: not editable, still in the value", async ({ page }, testInfo) => {
  const scope = scopeOf(page, testInfo.project.name);
  await scope.getByRole("button", { name: "Approve the line" }).click();

  // **The model first, the rendering second, because they fail for different reasons and the old
  // order could not tell them apart.** Asking whether the input is editable is asking about the
  // consequence of an approval; if the press never registered, that question is answered by a page
  // where nothing was approved, and the failure reads *the input is still editable* — which is true,
  // and about the wrong thing. This has failed twice on one engine and reproduced in none of
  // thirty-six local attempts, including under saturated cores, so what it says when it next fails
  // is the only thing that will separate a lost press from a binding that did not apply.
  await expect.poll(async () => (await state(page, testInfo.project.name)).approved)
    .toContain("invoices.INV-1.lines.l1");
  await expect(scope.locator("[data-line] input").first()).not.toBeEditable();
  const s = await state(page, testInfo.project.name);
  expect(s.value["INV-1"].lines.l1.desc).toBe("Consulting");
});
