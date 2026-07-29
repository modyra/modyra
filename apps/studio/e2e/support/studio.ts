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
 * Collapses the floating toolbar, which is what a user does once there is nothing left to add.
 *
 * The toolbar floats *over* the canvas by design, so a control far enough down the form sits under
 * it — and more of the form does now that the canvas can be narrowed to a breakpoint. Idempotent, so
 * a test can ask for it before every interaction without toggling it back open.
 */
export async function closeDock(page: Page): Promise<void> {
  const panel = page.locator("[data-dock-panel]");
  if (await panel.isVisible()) await page.locator("[data-dock-toggle]").click();
  await panel.waitFor({ state: "hidden" });
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

/**
 * A real HTML drag, as a sequence of DragEvents sharing one DataTransfer.
 *
 * Playwright's `dragTo` moves the mouse, which HTML5 drag-and-drop does not react to in a headless
 * Chromium: the events have to be dispatched. Shared so the canvas and layout suites drag the same
 * way rather than each carrying a copy.
 */
export async function dispatchHtmlDrag(
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator,
): Promise<void> {
  const sourceHandle = await source.elementHandle();
  const targetHandle = await target.elementHandle();

  if (!sourceHandle || !targetHandle) {
    throw new Error("HTML drag source or target is not attached");
  }

  await page.evaluate(
    ({ sourceElement, targetElement }) => {
      const dataTransfer = new DataTransfer();

      sourceElement.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      targetElement.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      targetElement.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      targetElement.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      sourceElement.dispatchEvent(
        new DragEvent("dragend", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    },
    {
      sourceElement: sourceHandle,
      targetElement: targetHandle,
    },
  );
}
