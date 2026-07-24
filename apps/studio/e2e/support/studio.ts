import type { Page } from "@playwright/test";

/**
 * Studio opens on the live form with a collapsed floating toolbar, which is
 * where the field templates and the project actions live. Tests that compose a
 * form need the toolbar open; the panel stays open until toggled back, so one
 * call per test file is enough.
 */
export async function openStudio(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".studio");
  await openDock(page);
}

/** Expands the floating toolbar if it is collapsed — a reload always starts it collapsed again. */
export async function openDock(page: Page): Promise<void> {
  const panel = page.locator("[data-dock-panel]");
  if (await panel.isHidden()) await page.locator("[data-dock-toggle]").click();
  await panel.waitFor({ state: "visible" });
}

/** Switches the canvas to the Structure outline (the tree view). */
export async function showStructure(page: Page): Promise<void> {
  await openDock(page);
  await page.locator('[data-canvas-mode="structure"]').click();
  await page.waitForSelector('[data-canvas-surface="structure"]');
}

/** Switches the canvas back to the live form. */
export async function showLiveForm(page: Page): Promise<void> {
  await openDock(page);
  await page.locator('[data-canvas-mode="form"]').click();
  await page.waitForSelector('[data-canvas-surface="form"]');
}
