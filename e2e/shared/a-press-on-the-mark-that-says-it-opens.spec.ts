import { expect, test } from "@playwright/test";

/**
 * The one mark on a closed multiselect that means *this opens* is pressable, in every renderer.
 *
 * The caret takes no pointer events — it is decoration, and the whole field is the control that
 * opens the list — so a press aimed at it lands on the box, and the box has to forward it. A person
 * who points at the only affordance a closed field shows and gets nothing has nothing else on the
 * field telling them where to point instead.
 *
 * **Aimed at the caret's centre rather than the field's**, and that choice is the whole reliability
 * of this file. Where the field's centre falls depends on how much is chosen: empty it is the
 * placeholder, with one value it is the opener, with eight it is a chip's remove button — which
 * correctly does not open. Measuring the centre therefore compares three different situations and
 * reports the difference as a renderer's. The caret's centre lands on the box at every fill.
 *
 * The fill is not arranged here and does not need to be: what the press lands on is **asserted**
 * before the press is made, so the file states the situation it measured instead of assuming one. A
 * demo whose caret sat over something else would fail on that line, naming what it hit, rather than
 * pass by pressing the opener directly and proving nothing about the box.
 */

test("a press on the caret opens the list", async ({ page }) => {
  await page.goto("/");
  const field = page.locator(".mdy-renderer--multiselect:visible").first();
  await field.waitFor({ state: "visible" });

  const opener = field.locator("[aria-expanded]").first();
  await expect(opener, "the list is already open, so this file cannot tell an opening from a state")
    .toHaveAttribute("aria-expanded", "false");

  const caret = field.locator('[class*="__arrow"]').first();
  // Brought on screen before it is measured: a box read while the field is below the fold is in
  // coordinates the pointer does not share, and the press lands on whatever is at those numbers —
  // which on a long demo is nothing at all, reported as a field that does not open.
  await caret.scrollIntoViewIfNeeded();
  const box = await caret.boundingBox();
  expect(box, "the field draws no caret, so this file measured nothing").not.toBeNull();
  const at = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };

  // What the press will land on, said before it is made. A press that reached a chip or the opener
  // itself would pass the assertion below while proving nothing about the box.
  const landedOn = await page.evaluate(
    (point) => document.elementFromPoint(point.x, point.y)?.getAttribute("class") ?? "(nothing)",
    at,
  );
  expect(
    landedOn,
    `a press at the caret's centre reaches "${landedOn}". The caret takes no pointer events, so it `
    + "should reach the field's own box — anything else means this file is about to measure a "
    + "different control and call the answer the renderer's.",
  ).toContain("mdy-multiselect");

  await page.mouse.click(at.x, at.y);
  await expect(
    opener,
    `pressing the caret did not open the list. The press landed on "${landedOn}" — the field's own `
    + "box — and the box is the control that opens.",
  ).toHaveAttribute("aria-expanded", "true");
});
