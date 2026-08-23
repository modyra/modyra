/**
 * One way back, exercised through all three of the things it has to cover.
 *
 * [ADR 0129](../../docs/architecture/0129-one-way-back-not-three.md) settles that a multiselect has a
 * single reversal for the whole control rather than one per action, and says in its own Verification
 * section that the assertion which catches a violation has to exercise **all three** destructive
 * actions through the same affordance.
 *
 * The reason is written into the record and is worth repeating here, because this file exists to stop
 * exactly one outcome: a clear-all shipped with an undo while removal and reordering still have none.
 * That satisfies "a selection can be cleared", satisfies any check written against clearing, and
 * leaves a control that teaches a person it has a way back and then does not have one the next time.
 * **A promise kept three-quarters of the time is a trap with better manners.**
 *
 * Each case is asserted the same way: do the thing, find a way back, take it, and the value is what it
 * was. Never against a literal — the value before the act is the expectation, so a control that
 * restores something plausible but different cannot pass.
 *
 * The affordance is looked for by what it offers rather than by where it is drawn: the record does not
 * say whether it lives in the field, beside it, or in the announcement, and a spec that named a place
 * would decide that.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { messagesForLocale } from "@modyra/widgets";

import { HOSTS, bench, chosen } from "./bench";

/**
 * The verb a chip's move button wears, taken from the catalogue rather than written out.
 *
 * The accessible name is the verb and then the value it acts on — `"Move earlier Alfa"` — so a
 * selector cannot spell the whole of it without knowing which chip it will land on. It matches the
 * verb as a prefix, and the verb comes from the message catalogue: a spec that repeats the English
 * string breaks the day the wording improves, which is what happened to this line the day every chip
 * button started naming its object.
 */
const MOVE_EARLIER = `button[aria-label^="${messagesForLocale("en").chipMoveEarlierLabel}"]`;


/** Anything offering to reverse what just happened, wherever it is drawn. */
const UNDO = 'button:has-text("Undo"), button:has-text("Annulla"), [data-mdy-undo], button[aria-label*="Undo" i]';

for (const host of HOSTS) {
  const value = (page: import("@playwright/test").Page, id: string) =>
    page.evaluate(({ api, id }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(id)?.s ?? null,
      { api: host.api, id });

  const takeTheWayBack = async (page: import("@playwright/test").Page, after: string) => {
    const offered = page.locator(UNDO);
    const count = await offered.count();
    if (count === 0) return { offered: false as const };
    await offered.first().click({ timeout: 5_000 });
    await page.waitForTimeout(300);
    return { offered: true as const, after };
  };

  test(`removing a chip can be undone, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    const { root, id } = await bench(page, host, "someOfFew");

    const before = await value(page, id);
    await page.locator(`${root} .mdy-multiselect__chips .mdy-chip`).first()
      // The contract's part, not the button's words: a remove control names the thing it removes,
      // so an exact-name selector matches one label and stops matching when the wording changes.
      .locator(".mdy-chip__remove").click({ timeout: 5_000 });
    await page.waitForTimeout(300);
    // The premise: the act did something. A reversal of nothing restores nothing and passes.
    expect(await value(page, id), "removing a chip did not change the value").not.toEqual(before);

    const back = await takeTheWayBack(page, "a removal");
    expect(back.offered, "nothing offered a way back after a chip was removed").toBe(true);
    expect(await value(page, id), "the way back did not restore what the removal took").toEqual(before);
  });

  test(`moving a chip can be undone, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    const { root, id } = await bench(page, host, "reorderable");

    const before = await value(page, id);
    await page.locator(`${root} .mdy-multiselect__chips .mdy-chip`).last()
      .locator(MOVE_EARLIER).click({ timeout: 5_000 });
    await page.waitForTimeout(300);
    expect(await value(page, id), "moving a chip did not change the order").not.toEqual(before);

    const back = await takeTheWayBack(page, "a move");
    expect(
      back.offered,
      "nothing offered a way back after a chip was moved — an order a person built is as easy to lose " +
        "as a choice, and quieter to lose",
    ).toBe(true);
    expect(await value(page, id), "the way back did not restore the order the move changed").toEqual(before);
  });

  test(`clearing a selection can be undone, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    const { root, id } = await bench(page, host, "full");

    const before = await value(page, id);
    const clear = page.locator(`${root} button`).filter({ hasText: /clear|svuota|reset|remove all/i })
      .or(page.locator(`${root} button[aria-label*="Clear" i]`));
    expect(
      await clear.count(),
      "there is no control that clears the selection, so twelve choices still come off one at a time",
    ).toBeGreaterThan(0);

    await clear.first().click({ timeout: 5_000 });
    await page.waitForTimeout(300);
    expect(await chosen(page, root), "clearing left chips behind").toEqual([]);

    const back = await takeTheWayBack(page, "a clear");
    expect(
      back.offered,
      "twelve choices went in one press and nothing offered them back — the person who most needs a " +
        "clear-all is the one who will hit it by accident",
    ).toBe(true);
    expect(await value(page, id), "the way back did not restore the twelve choices").toEqual(before);
  });
}
