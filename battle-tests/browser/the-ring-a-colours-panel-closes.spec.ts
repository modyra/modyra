/**
 * The ring a colours panel closes: open it, Tab reaches the custom entry, Tab comes back, Escape leaves.
 *
 * ADR 0197's family split says a kind whose `Tab@open` intent is `move` keeps the keyboard inside
 * its panel. Colours joined that family because it holds an action — a button for entering a tint of
 * one's own — that is not a choice and is not repeated, so Tab knows where it lands. Before that, Tab
 * closed the panel before reaching it and the arrows never left the swatch grid: the action was
 * drawn, styled, announced, and operable by pointer only.
 *
 * The repair was measured in jsdom, and jsdom does not move focus for a click. So the claim that a
 * person can walk this ring has been made where walking cannot happen. This drives it in a real
 * browser, in all three renderers.
 *
 * **Landing is asserted, never the press.** `focus()` returning is not focus arriving: an element
 * that is hidden, disabled or detached takes none, silently. Every step here reads
 * `document.activeElement` after the key, and the panel's own open state beside it — a ring that
 * ends with the panel shut has not come back, it has left.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { HOSTS } from "./bench";

const KEEPS_TAB = (MDY_WIDGET_KEYBOARD.colors ?? []).some(
  (binding) => binding.key === "Tab" && binding.when === "open" && binding.intent === "move",
);
const ENTRY = MDY_WIDGET_CONTRACTS.colors.parts.customEntry.classes[0];
const POPUP = MDY_WIDGET_CONTRACTS.colors.parts.popup.classes[0];

for (const host of HOSTS) {
  test(`the colours panel keeps the keyboard and gives it back, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise is the contract's, not this file's: if colours ever leaves the Tab-retaining
    // family, this spec is asserting a rule nobody holds and should say so rather than fail.
    expect(KEEPS_TAB, "colors no longer declares Tab@open:move, so this ring is not the rule").toBe(true);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("ring-colors", [{ name: "c", kind: "colors", label: "C" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const opener = page.locator('[data-form="ring-colors"] [aria-haspopup]').first();
    await expect(opener, "the colours field drew no opener, so nothing could be opened").toBeVisible();
    // Opened with a press, because opening is not the claim: what happens to the keyboard once it
    // is open is. The panel is portalled and positioned, so it has no offsetParent — visibility is
    // read from its rects, and using offsetParent here reported a panel that was on screen as shut.
    await opener.click();
    await page.waitForTimeout(350);

    const state = () => page.evaluate(({ entryClass, popupClass }) => {
      const active = document.activeElement;
      const panel = document.querySelector(`.${popupClass}`);
      return {
        open: panel !== null && panel.getClientRects().length > 0,
        onEntry: active !== null && active.closest(`.${entryClass}`) !== null,
        insidePanel: active !== null && panel !== null && panel.contains(active),
        what: active === null ? "(none)" : `${active.tagName.toLowerCase()}.${active.className || "-"}`,
      };
    }, { entryClass: ENTRY, popupClass: POPUP });

    const opened = await state();
    expect(opened.open, "the panel did not open, so where the keyboard goes says nothing").toBe(true);

    // Tab until the custom entry has focus, or until the panel closes — which is the defect this
    // exists for. A bounded walk: the ring is small, and an unbounded one would hang on the bug.
    let reached = opened.onEntry;
    let left = false;
    for (let press = 0; press < 12 && !reached; press += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      const now = await state();
      if (!now.open) { left = true; break; }
      reached = now.onEntry;
    }
    expect(left, "Tab closed the panel before the custom entry — the action is pointer-only").toBe(false);
    expect(reached, "Tab never landed on the custom entry inside the open panel").toBe(true);

    // And it comes back: the ring is closed, not a one-way trip into a corner.
    let returned = false;
    for (let press = 0; press < 12 && !returned; press += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      const now = await state();
      if (!now.open) break;
      returned = now.insidePanel && !now.onEntry;
    }
    expect(returned, "after the custom entry, Tab did not come back to the panel — the ring is open").toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const closed = await state();
    expect(closed.open, "Escape did not close the panel, so the keyboard has no way out").toBe(false);
  });
}
