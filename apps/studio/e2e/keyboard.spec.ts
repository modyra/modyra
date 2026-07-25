import { expect, test } from "@playwright/test";
import { openStudio, showStructure } from "./support/studio.js";

/**
 * P4 gate: checkout-shaped structure buildable keyboard-only, a11y pass.
 * No mouse anywhere in this file — palette/toolbar buttons are activated
 * via focus()+keyboard.press(), tree reordering via the app's own
 * Space/Arrows/Enter/Escape scheme (plan section 7).
 */

async function addFromPalette(page: import("@playwright/test").Page, template: string) {
  await page.locator(`[data-template="${template}"]`).focus();
  await page.keyboard.press("Enter");
}

/** Moves keyboard focus to a node in the outline — the surface that owns reordering. */
async function focusOutlineNode(page: import("@playwright/test").Page, label: string) {
  await page.locator(".outline .tree-node", { hasText: label }).last().locator("[data-node]").last().focus();
}

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await showStructure(page); // this suite drives the Structure outline, not the live form
});

test("adding an element via keyboard lands the caret in its label, not on the palette", async ({ page }) => {
  await addFromPalette(page, "text");
  // Inserting leaves you where you would type next, which is the composing rhythm.
  await expect(page.locator('.plain-canvas-field [data-inline-edit="label"]:focus')).toHaveCount(1);
});

test("keyboard-only: compose a group with a field moved inside it (no mouse)", async ({ page }) => {
  await addFromPalette(page, "group");
  await addFromPalette(page, "text");

  // Reordering is an outline gesture: focus the node there, then use the app's documented
  // keyboard equivalent for drag.
  await focusOutlineNode(page, "Text");
  await page.keyboard.press(" ");
  await expect(page.locator("footer")).toContainText("Picked up Text");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator("footer")).toContainText("Drop completed");

  const group = page.locator(".outline .tree-node", { hasText: "group" }).first();
  await expect(group.locator(".tree-node", { hasText: "Text" })).toHaveCount(1);

  // Focus must still be on the moved node after the whole pick-up/move/drop sequence.
  await expect(page.locator(".outline [data-node]:focus")).toContainText("Text");
});

test("keyboard-only: reorder two siblings with Arrow keys, focus follows the moved item", async ({ page }) => {
  await addFromPalette(page, "text");
  await addFromPalette(page, "email");
  // Root children are now [text, email]; pick up "email" and move it before "text".
  await focusOutlineNode(page, "Email");
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");

  const rootLabels = await page.locator(".outline .tree > .tree-node > .node .select").allInnerTexts();
  expect(rootLabels[0]).toContain("Email");
  await expect(page.locator(".outline [data-node]:focus")).toContainText("Email");
});

test("Escape cancels a pick-up without losing focus", async ({ page }) => {
  await addFromPalette(page, "text");
  await focusOutlineNode(page, "Text");
  await page.keyboard.press(" ");
  await page.keyboard.press("Escape");
  await expect(page.locator("footer")).toContainText("Move cancelled");
  await expect(page.locator(".outline [data-node]:focus")).toContainText("Text");
});

test("deleting a node via keyboard moves focus to the root, not off the page", async ({ page }) => {
  await addFromPalette(page, "text");
  await page.locator('.outline [data-delete]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("footer")).toContainText("Delete");
  // Deleting the only node empties the tree - there's no [data-node] left, so focus falls back
  // to the canvas region (tabindex=-1) rather than silently dropping to <body>.
  await expect(page.locator(".canvas:focus")).toHaveCount(1);
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(activeTag).not.toBe("BODY");
});

test("Undo announces the action and moves focus to a control that's actually enabled", async ({ page }) => {
  await addFromPalette(page, "text");
  await addFromPalette(page, "email");
  await page.locator("[data-undo]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("footer")).toContainText("Undo");
  // One more undo remains (two inserts happened) — Undo itself is still enabled, so focus stays put.
  await expect(page.locator("[data-undo]:focus")).toHaveCount(1);

  // Undoing again exhausts history: Undo is about to become `disabled` (which refuses focus),
  // so focus must land on Redo instead — never silently fall through to <body>.
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-undo]")).toBeDisabled();
  await expect(page.locator("[data-redo]:focus")).toHaveCount(1);
});

test("a11y: live region, labeled actions, focusable tree nodes", async ({ page }) => {
  await addFromPalette(page, "group");

  const footer = page.locator("footer");
  await expect(footer).toHaveAttribute("role", "status");
  await expect(footer).toHaveAttribute("aria-live", "polite");

  await expect(page.locator("[data-delete]").first()).toHaveAttribute("aria-label", /Delete/);
  await expect(page.locator("[data-duplicate]").first()).toHaveAttribute("aria-label", /Duplicate/);

  const tabindex = await page.locator("[data-node]").first().getAttribute("tabindex");
  expect(tabindex).toBe("0");
});
