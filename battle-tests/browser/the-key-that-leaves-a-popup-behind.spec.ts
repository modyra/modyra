/**
 * Tab out of an open popup, which the table says closes it.
 *
 * `MDY_WIDGET_KEYBOARD` declares, for all six kinds that have a popup,
 * `{ key: "Tab", when: "open", intent: "cancel", restoresFocus: false }`. It sits beside Escape,
 * which cancels *and* restores focus, and the difference between them is the whole point: Escape
 * puts the user back where they were, Tab lets them carry on forward. Both close.
 *
 * The suite's keyboard sweep asserts only the bindings a *closed* widget declares, and says so — the
 * open ones are judged against focus, and a spec that moved focus to judge a key would be judging
 * its own choice. So this binding, and the trap it exists to prevent, had never been driven.
 *
 * A popup that stays open under Tab is not a cosmetic difference. The keys still go to the overlay,
 * so Tab walks its internals — a calendar cell, then the next cell — and a keyboard user who meant
 * to leave the field is inside it, with no indication that the way out is a different key.
 *
 * A field built from a native control is excluded by name: the browser owns that popup and answers
 * Tab itself.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

/**
 * The kinds whose popup Tab moves *inside* rather than out of — read from the binding that says so.
 *
 * This was derived from the anatomy: a kind declaring an `actions` bar has a confirm button in its
 * overlay, and a confirm button Tab cannot reach is a widget with no keyboard commit path. That was
 * a **proxy**, and it agreed with the contract for one kind by coincidence. When `colors` joined
 * this family — an operable part, not a choice, inside the popup and *not repeated* — the anatomy
 * did not move and the declaration did:
 *
 *     timepicker   Tab@open intent=move    parts.actions=true    the proxy agreed
 *     colors       Tab@open intent=move    parts.actions=false   the proxy did not
 *
 * So the claim now reads the declaration it is about. The four kinds that close are still protected;
 * the two that keep Tab are asserted to keep it. A kind that changes family in the contract moves
 * between the two assertions on its own, and this spec becomes the proof of the family rather than
 * the obstacle to it.
 */
const KEEPS_TAB = (kind: string): boolean =>
  (MDY_WIDGET_KEYBOARD[kind] ?? []).some(
    (binding) => binding.key === "Tab" && binding.when === "open" && binding.intent === "move",
  );

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** Every kind that declares what Tab does while it is open. */
const KINDS = Object.entries(MDY_WIDGET_KEYBOARD)
  .filter(([, keys]) => keys.some((each) => each.key === "Tab" && each.when === "open"))
  .map(([kind]) => kind);

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`tab closes what it tabs out of, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "no kind declares what Tab does while open").toBeGreaterThan(0);

    const leftOpen: string[] = [];
    const neverOpened: string[] = [];
    const closedTooSoon: string[] = [];

    for (const kind of KINDS) {
      const id = `tb-${kind}`;
      await page.evaluate(({ mountId, k, api, options }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options }]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS });
      await page.waitForTimeout(280);

      const expanded = () => page.evaluate((sel) =>
        document.querySelector(`${sel} [aria-expanded="true"]`) !== null, `[data-form="${id}"]`);

      const native = await page.evaluate((sel) =>
        document.querySelector(`${sel} [aria-expanded]`) === null, `[data-form="${id}"]`);
      if (native) {
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
          { mountId: id, api: host.api });
        continue;
      }

      let opened = false;
      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(260);
        if (await expanded()) { opened = true; break; }
      }

      if (!opened) neverOpened.push(kind);
      else {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(320);
        const stillOpen = await expanded();
        if (KEEPS_TAB(kind)) { if (!stillOpen) closedTooSoon.push(kind); }
        else if (stillOpen) leftOpen.push(kind);
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(80);
    }

    // The control: every kind reached the state whose binding is under test. A kind that never
    // opened would report nothing left open and mean nothing by it.
    expect(neverOpened, "a kind never opened, so Tab was never pressed on an open popup").toEqual([]);

    expect(leftOpen, "Tab left a popup open, so the keys still go to it and the user is inside the field")
      .toEqual([]);

    // And the other direction, which is the half a list of exemptions would have hidden: a kind that
    // holds a confirm button must still be there after Tab, or its keyboard commit path is gone.
    expect(
      closedTooSoon,
      "Tab closed a popup that holds its own confirm button, so the only way to commit it is a pointer",
    ).toEqual([]);
  });
}
