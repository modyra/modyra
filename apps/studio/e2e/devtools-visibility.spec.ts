import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * Whether a field's value shows in the clear in the devtools panel.
 *
 * The panel guessed from the field's name and nothing could overrule it — so `notes` holding a
 * recovery phrase was printed, and `cardStyle` was masked for containing "card".
 */
test.beforeEach(async ({ page }) => { await openStudio(page); });

test("the eye cycles guess, shown, hidden — and the guess stays reachable", async ({ page }) => {
  await page.locator('[data-template="text"]').click();

  const eye = page.locator("[data-toggle-sensitive]").first();
  await expect(eye).toHaveAttribute("data-sensitive", "auto");
  await expect(eye).toHaveAccessibleName(/guessed from the name/);

  await eye.click();
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAttribute("data-sensitive", "false");
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAccessibleName(/shown in the clear/);

  await page.locator("[data-toggle-sensitive]").first().click();
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAttribute("data-sensitive", "true");
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAccessibleName(/hidden/);

  // Back to the guess: a two-state toggle would make the heuristic unreachable once touched.
  await page.locator("[data-toggle-sensitive]").first().click();
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAttribute("data-sensitive", "auto");
});

test("the choice survives undo and redo like any other edit", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-toggle-sensitive]").first().click();
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAttribute("data-sensitive", "false");

  await page.locator("[data-undo]").click();
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAttribute("data-sensitive", "auto");
  await page.locator("[data-redo]").click();
  await expect(page.locator("[data-toggle-sensitive]").first()).toHaveAttribute("data-sensitive", "false");
});
