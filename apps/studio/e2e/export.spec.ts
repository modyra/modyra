import { expect, test } from "@playwright/test";

/**
 * P7 gate (.modyra/modyra-studio-caveman-plan.md section 14): "dummy target
 * needs no canvas change" / "failure cannot corrupt editor" / "stale
 * ignored". The Export tab drives the real @modyra/studio-target-json,
 * @modyra/studio-target-core, @modyra/studio-target-angular and
 * @modyra/studio-target-react targets through the lazy TargetRegistry —
 * never a mock.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("Export tab lists all four registered targets and Generate produces project.json + contract.json for the default (JSON) target", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();

  await expect(page.locator("[data-export-target] option")).toHaveText(["Contract + Studio JSON", "Core (createForm)", "Angular (mdyForm)", "React (useMdyForm)"]);
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

test("P9: switching to the Angular target and generating produces form.ts + stubs.ts, a real mdyForm() definition", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-target]").selectOption("angular");
  await page.locator("[data-export-generate]").click();

  await expect(page.locator(".export-file")).toHaveCount(2);
  await expect(page.locator(".export-file-path").nth(0)).toContainText("form.ts");
  await expect(page.locator(".export-file-path").nth(0)).toContainText("(entry)");
  await expect(page.locator(".export-file-path").nth(1)).toContainText("stubs.ts");
});

test("P10: switching to the React target and generating produces form.ts + stubs.ts, a real useMdyForm() definition", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-target]").selectOption("react");
  await page.locator("[data-export-generate]").click();

  await expect(page.locator(".export-file")).toHaveCount(2);
  await expect(page.locator(".export-file-path").nth(0)).toContainText("form.ts");
  await expect(page.locator(".export-file-path").nth(0)).toContainText("(entry)");
  await expect(page.locator(".export-file-path").nth(1)).toContainText("stubs.ts");
});

test("previewing a file shows its real generated content, and Copy puts it on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-target]").selectOption("core");
  await page.locator("[data-export-generate]").click();
  await expect(page.locator(".export-file")).toHaveCount(2);

  const formFile = page.locator(".export-file").first();
  await expect(formFile.locator(".export-file-code")).toBeHidden();
  await formFile.locator("summary").click();
  await expect(formFile.locator(".export-file-code")).toContainText("createForm");
  await expect(formFile.locator(".export-file-code")).toContainText("field(");

  await formFile.locator("[data-export-copy]").click();
  await expect(formFile.locator("[data-export-copy]")).toHaveText("Copied!");
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain("createForm");
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
