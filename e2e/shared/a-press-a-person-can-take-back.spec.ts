import { expect, test } from "@playwright/test";

/**
 * Beginning a press on the field and moving away before letting go leaves the list shut.
 *
 * Starting a tap and sliding off it is how a person takes it back, on every platform, and it is the
 * whole of WCAG 2.5.2: a single-pointer gesture either does nothing on the down-event, or completes
 * on the up-event so that leaving cancels it. A control that has already acted by the time the
 * finger lifts has no take-back, and the person who most needs one is the person whose aim is least
 * steady.
 *
 * It is also what the control this forwards to already does. The field's empty space hands the press
 * to the opener, and a button activates on release — so acting sooner would give one control two
 * activation models depending on which pixel was hit.
 *
 * **Three readings, and the middle one is the finding.** Reading only the completed press finds
 * every renderer opening the list and reports agreement, because a control that acts too early also
 * ends up open. The pressed-and-held reading is what separates them.
 */

/** Where the press lands: the caret's centre, which takes no events and always reaches the box. */
async function caretCentre(field: import("@playwright/test").Locator): Promise<{ x: number; y: number }> {
  const caret = field.locator('[class*="__arrow"]').first();
  await caret.scrollIntoViewIfNeeded();
  const box = await caret.boundingBox();
  expect(box, "the field draws no caret, so this file measured nothing").not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test("a press taken back before release leaves the list shut", async ({ page }) => {
  await page.goto("/");
  const field = page.locator(".mdy-renderer--multiselect:visible").first();
  await field.waitFor({ state: "visible" });
  const opener = field.locator("[aria-expanded]").first();
  const isOpen = async () => (await opener.getAttribute("aria-expanded")) === "true";

  const at = await caretCentre(field);
  const landedOn = await page.evaluate(
    (p) => document.elementFromPoint(p.x, p.y)?.getAttribute("class") ?? "(nothing)", at);
  expect(landedOn, `a press at the caret's centre reaches "${landedOn}", not the field's own box`)
    .toContain("mdy-multiselect");

  await expect(opener).toHaveAttribute("aria-expanded", "false");

  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  const whileHeld = await isOpen();

  // Away from the field entirely, then released: the gesture a person makes to undo a tap.
  await page.mouse.move(at.x, at.y - 200);
  await page.mouse.up();
  const afterTakingItBack = await isOpen();

  expect(
    { whileHeld, afterTakingItBack },
    "the field acted while the button was still down, so moving away could not take the press back. "
    + "A control that has already opened by the time the finger lifts has no cancel, which is what "
    + "WCAG 2.5.2 asks a single-pointer gesture for.",
  ).toEqual({ whileHeld: false, afterTakingItBack: false });

  // The control case, in the same run: a field that answers nothing at all would satisfy every
  // assertion above. This is the one that tells "cancellable" from "dead".
  await page.mouse.click(at.x, at.y);
  await expect(
    opener,
    "the field does not open on a completed press either, so the readings above describe a control "
    + "that answers nothing rather than one whose gesture can be taken back",
  ).toHaveAttribute("aria-expanded", "true");
});
