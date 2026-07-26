import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/** Accessibility checks for the primary Studio surfaces. */
const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");

interface AxeViolation {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly nodes: ReadonlyArray<{ readonly target: readonly string[] }>;
}

async function violations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_PATH });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<unknown> } }).axe;
    return (await axe.run(".studio", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    })) as { violations: AxeViolation[] };
  });
  return result.violations;
}

function describe(found: AxeViolation[]): string {
  return found.map((v) => `${v.id} (${v.impact}): ${v.help} @ ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n");
}

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await page.locator("[data-new]").click();
});

test("the composing surface is free of WCAG A/AA violations", async ({ page }) => {
  for (const template of ["text", "select", "checkbox", "toggle", "date"]) {
    await page.locator(`[data-template="${template}"]`).click();
  }
  await page.locator("[data-dock-toggle]").click();

  const found = await violations(page);
  expect(found, describe(found)).toEqual([]);
});

test("the open insert palette is free of WCAG A/AA violations", async ({ page }) => {
  await page.locator("[data-dock-toggle]").click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator("[data-palette-input]")).toBeFocused();

  const found = await violations(page);
  expect(found, describe(found)).toEqual([]);
});

test("the toolbar, diagnostics and export panels are free of WCAG A/AA violations", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();

  await page.locator('[data-inspector-tab="diagnostics"]').click();
  await expect(page.locator(".diagnostic-row").first()).toBeVisible();
  let found = await violations(page);
  expect(found, describe(found)).toEqual([]);

  await page.locator('[data-inspector-tab="export"]').click();
  found = await violations(page);
  expect(found, describe(found)).toEqual([]);
});

test("a column row keeps every control reachable and labelled", async ({ page }) => {
  for (const name of ["city", "zip"]) {
    await page.locator('[data-template="text"]').click();
    await page.locator("[data-name]").fill(name);
    await page.locator("[data-name]").blur();
  }
  const field = page.locator('.plain-canvas-field[data-field-path="city"]');
  await field.hover();
  await field.locator("[data-layout-columns]").click();
  await expect(page.locator(".mdy-layout-columns")).toHaveCount(1);

  const found = await violations(page);
  expect(found, describe(found)).toEqual([]);
});

test.describe("light scheme", () => {
  test.use({ colorScheme: "light" });

  test("the light scheme follows the system and is free of WCAG A/AA violations", async ({ page }) => {
    for (const template of ["text", "select", "toggle"]) {
      await page.locator(`[data-template="${template}"]`).click();
    }
    await page.locator("[data-dock-toggle]").click();

    // Following the system means the shell really repaints, not just declares a preference.
    const background = await page.locator(".studio").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).toBe("rgb(255, 255, 255)");

    const found = await violations(page);
    expect(found, describe(found)).toEqual([]);
  });
});
