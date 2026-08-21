/**
 * Where an overlay's branch ends.
 *
 * The dismissal rule is written about a logical branch — the invoker, the popup, its descendants,
 * anything portalled elsewhere, any child popup. Containment answers most of it and misses the
 * portalled part, and that gap used to be filled four times, once per renderer, on the reasoning
 * that only a renderer knows where its own portal went.
 *
 * It does not have to. A widget that portals a popup says so: its opener names the popup through
 * `aria-controls`, and following that declaration out of the root is what `portalRootFor` does. So
 * these assert the two halves that decide whether a click closes something — a popup that belongs to
 * this widget is inside wherever it sits, and a popup that belongs to the widget next to it is
 * outside however similar it looks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { overlayBranchContains } from "../dist/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const { document } = dom.window;

/**
 * Two fields side by side, each with a popup portalled to the end of the document.
 *
 * The shape a page has when two selects are open at once, and the one a boundary drawn by class name
 * across the document gets wrong.
 */
function twoFields() {
  document.body.innerHTML = `
    <div id="one" class="mdy-renderer">
      <button id="one-trigger" aria-controls="one-list">A</button>
    </div>
    <div id="two" class="mdy-renderer">
      <button id="two-trigger" aria-controls="two-list">B</button>
    </div>
    <div id="one-portal" class="mdy-overlay"><ul id="one-list"><li id="one-option">a</li></ul></div>
    <div id="two-portal" class="mdy-overlay"><ul id="two-list"><li id="two-option">b</li></ul></div>
  `;
  const at = (id) => document.getElementById(id);
  return { at, branch: { root: at("one") } };
}

test("the trigger and everything under the widget's root is inside", () => {
  const { at, branch } = twoFields();
  assert.equal(overlayBranchContains(branch, at("one")), true);
  assert.equal(overlayBranchContains(branch, at("one-trigger")), true);
});

test("a popup this widget portalled is inside, wherever the renderer put it", () => {
  const { at, branch } = twoFields();
  // Not a descendant of the root by any reading — it is a sibling of the field, at the end of the
  // document — and it is this field's popup because this field's opener names it.
  assert.equal(at("one").contains(at("one-option")), false, "the fixture must actually portal");
  assert.equal(overlayBranchContains(branch, at("one-portal")), true);
  assert.equal(overlayBranchContains(branch, at("one-option")), true);
});

test("the popup beside it, belonging to another field, is outside", () => {
  const { at, branch } = twoFields();
  assert.equal(overlayBranchContains(branch, at("two-portal")), false);
  assert.equal(overlayBranchContains(branch, at("two-option")), false);
  assert.equal(overlayBranchContains(branch, at("two-trigger")), false);
});

test("a part the renderer names is inside; one it does not name is not", () => {
  const { at } = twoFields();
  // `also` is for what containment cannot reach and `aria-controls` does not name — a multiselect's
  // chips sitting outside the wrapper the popup is anchored to.
  const named = { root: at("one"), also: [at("two")] };
  assert.equal(overlayBranchContains(named, at("two-trigger")), true);
  assert.equal(overlayBranchContains({ root: at("one") }, at("two-trigger")), false);
});

test("a target that is not a node is outside", () => {
  const { at, branch } = twoFields();
  // An interaction the renderer could not locate is not one that happened inside. Answering
  // "inside" is the safer-looking mistake and it produces a popup nothing can dismiss.
  for (const target of [null, undefined, "one-option", 42, {}]) {
    assert.equal(overlayBranchContains(branch, target), false, `${String(target)} must be outside`);
  }
  assert.equal(overlayBranchContains({ root: null }, at("one-option")), false);
});

test("a root is anything that can answer for a subtree", () => {
  // `MdyOverlayRoot` is structural on purpose: a host that is not a DOM element still knows what is
  // beneath it, and requiring `Element` would put a cast at every call site.
  const { at } = twoFields();
  /** @type {import("../dist/index.js").MdyOverlayRoot} */
  const root = { contains: (node) => node === at("one-option") };
  assert.equal(overlayBranchContains({ root }, at("one-option")), true);
  assert.equal(overlayBranchContains({ root }, at("two-option")), false);
});
