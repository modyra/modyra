import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * The two things the live canvas has to get right: editing the form where you
 * read it, and not throwing the editor back to the top on every command.
 */

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await page.locator("[data-new]").click();
});

async function addFields(page: import("@playwright/test").Page, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await page.locator('[data-template="text"]').click();
}

test("a field's label and code name are edited in place, on the field itself", async ({ page }) => {
  await addFields(page, 1);
  const field = page.locator(".plain-canvas-field").first();
  const nodeId = await field.getAttribute("data-node");

  await field.locator('[data-inline-edit="label"]').fill("Full name");
  await field.locator('[data-inline-edit="label"]').blur();
  await field.locator('[data-inline-edit="name"]').fill("fullName");
  await field.locator('[data-inline-edit="name"]').blur();

  // The edit reaches the real model: the inspector, the derived path and the Contract all follow.
  await expect(page.locator(`[data-inline-edit="name"][data-inline-node="${nodeId}"]`)).toHaveValue("fullName");
  await expect(page.locator("[data-label]")).toHaveValue("Full name");
  await expect(page.locator(".plain-canvas-field").first()).toHaveAttribute("data-field-path", "fullName");
});

test("the form name is edited in the header and is undoable", async ({ page }) => {
  await page.locator("[data-form-name]").fill("Checkout");
  await page.locator("[data-form-name]").blur();
  await expect(page.locator("[data-form-name]")).toHaveValue("Checkout");

  await page.locator("[data-undo]").click();
  await expect(page.locator("[data-form-name]")).toHaveValue("Untitled form");
});

test("the canvas keeps its scroll position across a command", async ({ page }) => {
  await addFields(page, 14);
  const canvas = page.locator(".canvas");
  await canvas.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const before = await canvas.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(0);

  // A command that rebuilds the live form. The viewport must not jump back to the top.
  const last = page.locator(".plain-canvas-field").last();
  await last.locator('[data-inline-edit="label"]').fill("Still here");
  await last.locator('[data-inline-edit="label"]').blur();

  await expect
    .poll(async () => canvas.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(before - 40);
});

test("the inspector keeps its scroll position while its own controls are used", async ({ page }) => {
  await addFields(page, 1);
  await page.locator('details[data-section="server"] summary').click();
  await page.locator("[data-enable-server-validator]").click();

  const body = page.locator(".inspector-body");
  await body.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const before = await body.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(0);

  await page.locator("[data-server-debounce]").fill("750");
  await page.locator("[data-server-debounce]").blur();

  await expect(page.locator("[data-server-debounce]")).toHaveValue("750");
  await expect.poll(async () => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(before - 40);
});

test("typing into the live form survives an unrelated edit elsewhere", async ({ page }) => {
  await addFields(page, 2);
  const first = page.locator(".plain-canvas-field").first();
  const control = first.locator("input:not(.plain-canvas-inline)");
  await control.fill("Ada Lovelace");

  // Rename the *other* field: the value typed into the first one must not be thrown away.
  const second = page.locator(".plain-canvas-field").last();
  await second.locator('[data-inline-edit="label"]').fill("Second");
  await second.locator('[data-inline-edit="label"]').blur();

  await expect(page.locator(".plain-canvas-field").first().locator("input:not(.plain-canvas-inline)")).toHaveValue(
    "Ada Lovelace",
  );
});
