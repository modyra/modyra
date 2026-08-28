/**
 * Tab leaves an open panel, and the order is the whole of it.
 *
 * Measured on a page before this existed: of three renderers, one put focus back on the trigger and
 * two put it on the document body. None did what the policy declares — `restoreFocus: false`, meaning
 * *let focus go where it was headed*.
 *
 * The body case is nobody's decision. The panel closes while the focused element is inside it, the
 * browser is left with an active element that no longer exists, and it falls back to the body — from
 * which the next press starts again at the top of the document, so the person has lost their place in
 * the form and nothing said why.
 *
 * So the check is about **sequence**, not destination: the focus has to have moved before the close
 * runs. A check that only read where focus ended would pass on an implementation that closes first
 * and focuses afterwards, which works in a fixture and not on a page, because on a page the browser
 * has already made its decision by then.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { stepOutOfOverlay } = await import("../dist/index.js");

function anOpenPanel() {
  const field = document.createElement("div");
  const opener = document.createElement("button");
  const inside = document.createElement("input");
  field.append(opener);
  document.body.append(field, inside);
  return { field, opener, inside };
}

test("the focus moves before the close runs, not after", () => {
  const { field, opener } = anOpenPanel();
  const order = [];
  opener.addEventListener("focus", () => order.push("focused"));
  stepOutOfOverlay(opener, () => order.push("closed"));
  assert.deepEqual(order, ["focused", "closed"],
    "the panel closed before the focus moved. On a page the browser has already put focus on the "
    + "body by then, and the next press starts over at the top of the document");
  field.remove();
});

test("the opener holds focus when the close has run", () => {
  const { field, opener } = anOpenPanel();
  stepOutOfOverlay(opener, () => {});
  assert.equal(document.activeElement, opener,
    "focus is not on the opener, so the browser's own Tab has nowhere to carry on from — and from "
    + "inside a panel it does not know what the next control is");
  field.remove();
});

test("the close still runs when there is no opener to move to", () => {
  // A panel whose opener has gone — removed by the same render that closed it — must still close.
  // Refusing to close because the focus target was missing would leave the panel on the page.
  let closed = false;
  stepOutOfOverlay(null, () => { closed = true; });
  assert.equal(closed, true, "a missing opener stopped the panel from closing");
  stepOutOfOverlay(undefined, () => { closed = true; });
  assert.equal(closed, true);
});
