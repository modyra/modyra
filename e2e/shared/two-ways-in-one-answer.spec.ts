import { expect, test } from "@playwright/test";

/**
 * A list answers the keyboard the same whether it was opened by hand or by key.
 *
 * The way a person opened a panel is not a statement about which hand they will use next: opening
 * with the mouse and then reaching for the keyboard is one task, not two, and it is the same person
 * doing it. A panel that answers only the route it was opened from leaves them holding a thing they
 * opened and cannot close — over the field it covers, with nothing focused to say where they are.
 *
 * **What the two routes agree on is not asserted here**, and that is deliberate. Where the reading
 * position lands is a design decision each renderer may take differently — the opener, the first
 * option, the strip — and this file has no business settling it. What no renderer may do is answer
 * from one door and not the other.
 *
 * The keyboard route is the control case. If dismissal were broken both ways the two routes would
 * agree perfectly, and agreement measured on a control that never worked is not a finding about
 * consistency.
 */

const OPEN = '[aria-expanded="true"]';

/** Opens the list the way a hand does: a press on the caret, which always reaches the field's box. */
async function openByHand(field: import("@playwright/test").Locator): Promise<void> {
  const caret = field.locator('[class*="__arrow"]').first();
  await caret.scrollIntoViewIfNeeded();
  const box = await caret.boundingBox();
  expect(box, "the field draws no caret, so this file measured nothing").not.toBeNull();
  await field.page().mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

/** Opens it the way a keyboard does, from the opener the contract names. */
async function openByKey(field: import("@playwright/test").Locator): Promise<void> {
  await field.locator("[aria-expanded]").first().focus();
  await field.page().keyboard.press("Enter");
}

test("the list answers a dismissal whichever way it was opened", async ({ page }) => {
  await page.goto("/");
  const field = page.locator(".mdy-renderer--multiselect:visible").first();
  await field.waitFor({ state: "visible" });
  const opener = field.locator("[aria-expanded]").first();

  const dismissAfter = async (open: () => Promise<void>): Promise<{ opened: boolean; closed: boolean }> => {
    await open();
    await page.waitForTimeout(250);
    const opened = await field.locator(OPEN).count() > 0;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const closed = await field.locator(OPEN).count() === 0;
    // Left shut whatever happened, so the next reading starts where this one did.
    if (!closed) { await opener.focus(); await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
    return { opened, closed };
  };

  const byKey = await dismissAfter(() => openByKey(field));
  expect(
    byKey,
    "the keyboard route does not open and dismiss, so this file cannot tell two routes agreeing from "
    + "two routes both failing — which is what it would report if it went on.",
  ).toEqual({ opened: true, closed: true });

  const byHand = await dismissAfter(() => openByHand(field));
  expect(
    byHand,
    "the list opened by hand does not answer the key that dismisses it, while the same list opened "
    + "by key does. A person who opens a panel with the mouse and reaches for the keyboard is holding "
    + "something they opened and cannot close.",
  ).toEqual({ opened: true, closed: true });
});
