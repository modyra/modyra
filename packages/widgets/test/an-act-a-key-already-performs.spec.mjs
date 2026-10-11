/**
 * An act a declared key already performs does not oblige the panel to keep the Tab.
 *
 * A calendar's header holds three buttons — page back, switch view, page forward — inside the
 * panel. Read as operable parts with no key naming them, they made the panel one that "holds an
 * action", so Tab was kept inside rather than letting go. But each performs an act the kind declares
 * a key for while open: the page keys page, the accelerated arrows switch the view. The part
 * declares the act it performs and the exemption is derived from the bindings, never listed.
 *
 * Asserted in both directions, because a derivation that agrees with the data it was built on has
 * not been verified: the exemption must hold with the keys present, and must die with them gone.
 * The per-part predicate is the same notion the panel's verdict is built on, published for a bench
 * that judges one part, and it is exercised here on the same nodes the panel reads.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, popupHoldsAnAction } = await import("../dist/index.js");
const { partIsReachedByAKey } = await import("../dist/testing/index.js");

const HEADER_PARTS = ["headerPrevious", "viewToggle", "headerNext"];
const nodeOf = (kind, part) => MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((node) => node.part === part);

for (const kind of ["datepicker", "daterange"]) {
  test(`${kind}: every header act is one a declared key performs, so Tab leaves the panel`, () => {
    for (const part of HEADER_PARTS) {
      const node = nodeOf(kind, part);
      assert.ok(node, `${kind} declares no ${part}`);
      assert.ok(node.performs, `${part} declares no act, so nothing can say whether a key reaches it`);
      assert.equal(partIsReachedByAKey(node, MDY_WIDGET_KEYBOARD[kind]), true,
        `${part} performs "${node.performs}" and no open-phase binding of that intent${node.performsPage ? " and size" : ""} exists`);
    }
    assert.equal(popupHoldsAnAction(kind), false, "the panel still reads as holding an act no key reaches");
    const tab = MDY_WIDGET_KEYBOARD[kind].find((one) => one.key === "Tab" && one.when === "open");
    assert.ok(tab, "no Tab binding while open");
    assert.equal(tab.intent, "cancel", "Tab is kept inside a panel whose every act a key already performs");
    assert.equal(tab.restoresFocus, false, "leaving by Tab hands focus back instead of letting it go");
  });

  test(`${kind}: take the paging key away and the panel holds an act again`, () => {
    const withoutPaging = MDY_WIDGET_KEYBOARD[kind].filter((one) => !(one.intent === "move" && one.page === true));
    assert.notEqual(withoutPaging.length, MDY_WIDGET_KEYBOARD[kind].length, "the kind declares no paging key, so nothing was removed");
    assert.equal(partIsReachedByAKey(nodeOf(kind, "headerPrevious"), withoutPaging), false);
    assert.equal(partIsReachedByAKey(nodeOf(kind, "headerNext"), withoutPaging), false);
    // The view toggle is still covered: its key is not the one removed.
    assert.equal(partIsReachedByAKey(nodeOf(kind, "viewToggle"), withoutPaging), true);
    assert.equal(popupHoldsAnAction(kind, withoutPaging), true, "the exemption outlived its reason");
  });

  test(`${kind}: a movement of the wrong size does not cover a part that pages`, () => {
    // A bare arrow moves a day. It is a `move` while open, and it is not a page: a part that pages
    // is not reached by it, or the exemption would hold on any grid that has arrow keys.
    const onlyDayMoves = MDY_WIDGET_KEYBOARD[kind].filter((one) => one.intent === "move" && one.when === "open" && one.page !== true);
    assert.ok(onlyDayMoves.length > 0, "the kind declares no bare movement to test against");
    assert.equal(partIsReachedByAKey(nodeOf(kind, "headerPrevious"), onlyDayMoves), false);
  });
}

test("a part that performs no act is never reached, whatever is declared", () => {
  assert.equal(partIsReachedByAKey(nodeOf("datepicker", "gridcell"), MDY_WIDGET_KEYBOARD.datepicker), false);
  assert.equal(partIsReachedByAKey({}, MDY_WIDGET_KEYBOARD.datepicker), false);
});

test("a key that performs the act only while closed does not reach a part inside the panel", () => {
  const closedOnly = MDY_WIDGET_KEYBOARD.datepicker
    .filter((one) => one.intent === "move" && one.page === true)
    .map((one) => ({ ...one, when: "closed" }));
  assert.ok(closedOnly.length > 0);
  assert.equal(partIsReachedByAKey(nodeOf("datepicker", "headerPrevious"), closedOnly), false);
});
