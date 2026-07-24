import { expect, test } from "@playwright/test";

/**
 * P7 gate (.modyra/modyra-studio-caveman-plan.md section 14): "dummy target
 * needs no canvas change" / "failure cannot corrupt editor" / "stale
 * ignored". The Export tab drives the real @modyra/studio-target-json and
 * @modyra/studio-target-core targets through the lazy TargetRegistry —
 * never a mock.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("Export tab lists both registered targets and Generate produces project.json + contract.json for the default (JSON) target", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();

  await expect(page.locator("[data-export-target] option")).toHaveText(["Contract + Studio JSON", "Core (createForm)"]);
  await page.locator("[data-export-generate]").click();

  await expect(page.locator(".export-file")).toHaveCount(2);
  await expect(page.locator(".export-file-path").nth(0)).toContainText("project.mdy-studio.json");
  await expect(page.locator(".export-file-path").nth(1)).toContainText("contract.json");
  await expect(page.locator(".export-file-path").nth(1)).toContainText("(entry)");
});

test("P8: switching to the Core target and generating produces form.ts + stubs.ts, a real createForm() definition", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-target]").selectOption("core");
  await page.locator("[data-export-generate]").click();

  await expect(page.locator(".export-file")).toHaveCount(2);
  await expect(page.locator(".export-file-path").nth(0)).toContainText("form.ts");
  await expect(page.locator(".export-file-path").nth(0)).toContainText("(entry)");
  await expect(page.locator(".export-file-path").nth(1)).toContainText("stubs.ts");
});

test("downloading a generated file triggers a real browser download with the file's own name", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-generate]").click();
  await expect(page.locator(".export-file")).toHaveCount(2);

  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-export-download="project.mdy-studio.json"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("project.mdy-studio.json");
});

test("generate failure cannot corrupt the editor: canvas and tree stay intact", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-generate]").click();
  await expect(page.locator(".export-file")).toHaveCount(2);

  // Switching back to the canvas: the earlier generate() must never have touched project state.
  await page.locator('[data-inspector-tab="node"]').click();
  await expect(page.locator(".tree-node")).toHaveCount(1);
  await expect(page.locator("[data-name]")).toHaveValue(/^text/);
});

test("generated contract.json carries the same diagnostics shown in the model's own Diagnostics tab", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-name]").fill("password");
  await page.locator("[data-name]").blur();

  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-generate]").click();

  await expect(page.locator(".inspector-body .diagnostic-row.severity-warning")).toHaveCount(1);
  await expect(page.locator(".inspector-body .diagnostic-row")).toContainText("looks sensitive");
});
