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

/**
 * The outline rail is always present now — there is no Structure mode to switch to. Kept as a
 * no-op so the suites that used to switch read as "this part drives the outline".
 */
export async function showStructure(page: Page): Promise<void> {
  await page.waitForSelector(".outline .tree, .outline .empty");
}

/** The canvas is always the live form; kept for the same reason as showStructure. */
export async function showLiveForm(page: Page): Promise<void> {
  await page.waitForSelector('[data-canvas-surface="form"]');
}
