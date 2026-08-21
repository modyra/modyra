/**
 * The chip as a control rather than a caption: what a person can do to a choice once it is made.
 *
 * Asked for directly — *"deve esserci anche il counter nelle chips del multi, valuta il perimetro UIX a
 * 360 gradi"* — so this is the perimeter, measured against the parts the contract already declares
 * rather than against a picture invented here.
 *
 * The count is there and it is right:
 *
 *     <span class="mdy-chip__label">Opzione A</span><span class="mdy-chip__count">3</span>
 *
 * `optionCount` declares that class and plain emits it, so three of one option reads as one chip
 * saying three rather than as three chips or as one that lies. That half is done.
 *
 * **What the contract also declares and nobody draws** is everything that would let a person act on
 * what they are looking at:
 *
 *     optionStep    mdy-chip__btn     the affordance that makes the 3 a 2
 *     optionCheck   mdy-chip__check
 *     chip states   selected, removable
 *
 * And the chip is a `<span>` with `tabindex="-1"`. So it cannot be focused, which means it cannot be
 * removed, cannot be stepped, and **cannot be reordered** — a keyboard never arrives at it. The
 * reordering work about to be built assumes a chip a person can reach; today there is none.
 *
 * A control that shows a number and offers no way to change it is asking somebody to reopen a popup,
 * find the row again among the others, and press a different button there — which is the journey the
 * chips strip exists to remove.
 *
 * Four assertions, each failing a different half-answer: the count is drawn; the chip can be reached;
 * a choice can be taken back from the chip; and where quantities are in play the chip can change one.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const parts = MDY_WIDGET_CONTRACTS.multiselect.parts as Record<string, { classes: string[] }>;
const CHIP = parts.chip.classes[0]!;
const COUNT = parts.optionCount.classes[0]!;
const STEP = parts.optionStep.classes[0]!;

const OPTIONS = ["a", "b"].map((value) => ({ value, label: `Opzione ${value.toUpperCase()}` }));

for (const host of HOSTS) {
  test(`a chip says how many and lets a person change it, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Three of one option and one of another: the value carries repeats, so a chip per distinct value
    // has to say how many or lose what the person asked for.
    //
    // **`mode: "multi"` is what asks for that.** A repeated value on a toggle-set control is not a
    // quantity — the default mode holds a set, and handing it duplicates describes a control that was
    // never offered a counter. This file spent its life measuring one and reporting on the other.
    await page.evaluate(async ({ api, options }) => {
      (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
        .mountFields("c", [{
          name: "s", kind: "multiselect", label: "S", options, mode: "multi",
          initialValue: ["a", "a", "a", "b"],
        }]);
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(450);

    const read = await page.evaluate(({ chipClass, countClass, stepClass }) => {
      const root = document.querySelector('[data-form="c"]');
      if (root === null) return null;
      const chips = Array.from(root.querySelectorAll(`.${chipClass}`));
      const first = chips[0] as HTMLElement | undefined;
      return {
        chips: chips.length,
        counts: root.querySelectorAll(`.${countClass}`).length,
        countText: root.querySelector(`.${countClass}`)?.textContent?.trim() ?? null,
        steps: root.querySelectorAll(`.${stepClass}`).length,
        firstTag: first?.tagName.toLowerCase() ?? null,
        firstTabIndex: first?.tabIndex ?? null,
        removable: first === undefined
          ? 0
          : first.querySelectorAll("button").length + (first.tagName === "BUTTON" ? 1 : 0),
      };
    }, { chipClass: CHIP, countClass: COUNT, stepClass: STEP });

    expect(read, "nothing was mounted").not.toBeNull();

    // The premise: a chip per distinct value, which is what makes the count necessary.
    expect(
      read!.chips,
      `four values were chosen — three of one — and the control drew ${read!.chips} chips`,
    ).toBe(2);

    expect(
      read!.countText,
      `the chip for the option chosen three times says ${JSON.stringify(read!.countText)} — a chip per ` +
        `distinct value with no count answers the same for one and for three`,
    ).toBe("3");

    // Reachable, or none of the rest can happen: removing, stepping and reordering all start from a
    // chip a person can get to.
    expect(
      read!.firstTabIndex,
      `the chip is a <${read!.firstTag}> with tabIndex ${read!.firstTabIndex} — a keyboard never arrives ` +
        `at it, so it cannot be removed, stepped or reordered whatever affordances are drawn on it`,
    ).toBeGreaterThanOrEqual(0);

    expect(
      read!.removable,
      `the contract declares a chip may be "removable" and this one carries no control — taking a ` +
        `choice back means reopening the popup and finding the row again among the others, which is the ` +
        `journey the strip exists to remove`,
    ).toBeGreaterThan(0);

    // And the affordance the contract declares for changing a count: `optionStep`.
    expect(
      read!.steps,
      `the chip says 3 and offers no way to make it 2 — .${STEP} is declared for exactly that and is ` +
        `drawn nowhere`,
    ).toBeGreaterThan(0);
  });
}
