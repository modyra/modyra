/**
 * Walking a palette with the keyboard.
 *
 * A colours field opens onto a grid of swatches, and the keyboard contract says four keys move
 * through it while it is open: `ArrowDown`, `ArrowUp`, `Home`, `End`. None of them names a part, so
 * they hold wherever the keyboard legitimately stands once the popup is open — and it opens with
 * focus already on a swatch, so there is no other place for them to mean something.
 *
 * They move nothing. The only key that advances through the palette is `Tab`, which makes ten
 * swatches ten tab stops: a person walking to the tenth colour presses Tab ten times, passes through
 * every colour on the way, and cannot get back out of the grid in fewer presses than they came in.
 * A composite that a person can only tab through is a composite in name only — the reason a grid
 * takes one tab stop and moves inside it with the arrows is precisely so that the surrounding form
 * stays walkable.
 *
 * The observation is taken document-wide rather than under the field, because a popup is rendered
 * outside the control it belongs to; scoped to the field it would report every open-state key as
 * dead whatever happened, which is a measurement that cannot see what it claims.
 *
 * **The drive proves itself before it accuses anything.** Two guards run first: the popup must open
 * with swatches in it, and `Tab` must be seen to move the reading position. A run where `Tab` moved
 * nothing either would be a broken observer rather than a finding, and it would read identically.
 *
 * "Moved" is deliberately generous — active descendant, selection, roving `tabindex`, class, or
 * where focus sits. Any of them is a reading position that went somewhere. Requiring a particular
 * mechanism would pin an implementation the contract does not choose.
 *
 * Claims under attack: A11Y-004, UI-011.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The keys the contract declares as moving through an open colours popup. */
const MOVES = (MDY_WIDGET_KEYBOARD.colors ?? [])
  .filter((binding) => binding.when === "open" && binding.intent === "move")
  .map((binding) => binding.key);

/** Where the reading position is, by every mechanism a renderer might use to hold it. */
const position = (page: import("@playwright/test").Page) => page.evaluate(() => {
  const marks = Array.from(document.querySelectorAll("*")).map((element) => [
    element.getAttribute("aria-activedescendant"),
    element.getAttribute("aria-selected"),
    element.getAttribute("aria-checked"),
    element.getAttribute("tabindex"),
    element.className,
  ].join("|")).join("//");
  const active = document.activeElement;
  return `${marks}::${active === null ? "none" : `${active.tagName}#${active.id}.${active.className}`}`;
});

for (const host of HOSTS) {
  test(`a palette is walkable with the keys it declares, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const id = "palette";
    await page.evaluate(({ api, id }) => {
      (window as never as Api)[api].mountFields(id, [{ name: "c", kind: "colors", label: "Colore" }] as never);
    }, { api: host.api, id });

    const root = `[data-form="${id}"]`;
    await page.locator(root).waitFor({ timeout: 5_000 });
    await page.locator(`${root} [aria-haspopup]`).first().click({ timeout: 5_000 });

    const swatches = page.locator(".mdy-color-swatch, [role='option'], [role='gridcell']");
    await expect(swatches.first()).toBeVisible({ timeout: 5_000 });
    const count = await swatches.count();
    // A palette with one swatch has no second place for a move to go, and every key would read as
    // dead for a reason that is not the one this spec is about.
    expect(count, `${host.name} opened a palette holding ${count} swatch(es), which nothing can move through`)
      .toBeGreaterThan(1);

    const before = await position(page);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
    // The observer, proved against a key that is known to move before any key is accused of not.
    expect(await position(page), `${host.name}: Tab moved nothing either, so this drive cannot see a move at all`)
      .not.toBe(before);

    const dead: string[] = [];
    for (const key of MOVES) {
      const start = await position(page);
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
      if (await position(page) === start) dead.push(key);
    }

    expect(dead, `${host.name}: a palette of ${count} swatches does not answer ${dead.join(", ")}, leaving Tab as the only way through it`)
      .toEqual([]);
  });
}
