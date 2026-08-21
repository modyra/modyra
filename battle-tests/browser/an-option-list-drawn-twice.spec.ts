/**
 * A closed multiselect, and how many times it draws the things a person can choose.
 *
 * With the popup shut — `aria-expanded` absent on every opener — and three options declared:
 *
 *     plain     1 option list in the document, 1 visible, 3 chips visible
 *     lit       1 option list in the document, 1 visible, 3 chips visible
 *     angular   2 option lists in the document, 2 visible, 6 chips visible
 *
 * **Angular draws the list twice**: once inline under the renderer and once inside the overlay panel,
 * and with the popup closed both are on the page and both are visible. Every option appears to a person
 * twice, and to a screen reader twice, and a click has two places to land.
 *
 *     button.mdy-chip < div.mdy-multiselect__options < mdy-control-multiselect
 *     button.mdy-chip < div.mdy-multiselect__options < div.mdy-overlay-panel < mdy-control-multiselect
 *
 * The overlay's copy is the one that should only exist while the popup is open. It is not hidden — this
 * is not the hide-versus-remove strategy the contract allows for a *view*, because there is no state in
 * which both copies are correct at once.
 *
 * Asserted on the **closed** control on purpose: open, two lists is a renderer that portals its options
 * and keeps the anchor, which is a question about portalling. Closed, it is simply twice.
 *
 * Counted rather than compared against a number written here: three options must produce one list
 * whatever a renderer's chosen anatomy is, and a control that draws none is caught by the same
 * assertion from below.
 *
 * Claims under attack: UI-009, A11Y-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

for (const host of HOSTS) {
  test(`a closed multiselect draws its options once, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api, options }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("m", [{ name: "s", kind: "multiselect", label: "S", options }]);
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(400);

    const drawn = await page.evaluate(() => {
      const host = document.querySelector('[data-form="m"]');
      if (host === null) return null;
      const visible = (element: Element) => element.getBoundingClientRect().height > 0;
      const lists = Array.from(host.querySelectorAll(".mdy-multiselect__options"));
      return {
        expanded: host.querySelectorAll('[aria-expanded="true"]').length,
        lists: lists.length,
        listsVisible: lists.filter(visible).length,
        chipsVisible: Array.from(host.querySelectorAll(".mdy-chip")).filter(visible).length,
      };
    });

    expect(drawn, "nothing was mounted, so there is no control to count").not.toBeNull();

    // The premise: this is the closed state. Two lists while open is a question about portalling and
    // belongs to a different spec.
    expect(
      drawn!.expanded,
      `the popup is open, so this measurement is not about a closed control — ${JSON.stringify(drawn)}`,
    ).toBe(0);

    expect(
      drawn!.lists,
      `a closed multiselect has ${drawn!.lists} option lists in the document. Angular keeps one inline ` +
        `under the renderer and another inside the overlay panel, so every option is on the page twice ` +
        `— seen twice, read out twice, and clickable in two places`,
    ).toBe(1);

    expect(
      drawn!.listsVisible,
      `${drawn!.listsVisible} option lists are visible at once. This is not the hide-or-remove choice ` +
        `the contract leaves open for a view: there is no state in which two copies of the options are ` +
        `both correct`,
    ).toBe(1);

    // And the same read from the leaves, which catches a renderer that shares one list element between
    // two anatomies while still drawing each option twice inside it.
    expect(
      drawn!.chipsVisible,
      `${OPTIONS.length} options produced ${drawn!.chipsVisible} visible chips`,
    ).toBe(OPTIONS.length);
  });
}
