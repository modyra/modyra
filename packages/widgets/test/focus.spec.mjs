/**
 * The focus handover contract.
 *
 * Each case is a way focus can be lost silently: an overlay closing onto `<body>`, a restore aimed
 * at an element that has already been removed, a search box opening without focus. They look
 * identical from the outside — nothing throws, every attribute is right, and the user is standing
 * at the top of the page.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  createFocusCustodian,
} from "../dist/index.js";

/** A widget with a trigger, a popup and a field inside the popup. */
function widget() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const { document } = dom.window;
  globalThis.document = document;
  const root = document.createElement("div");
  root.innerHTML = `
    <button class="trigger">open</button>
    <div class="popup"><input class="search" /></div>
  `;
  document.body.append(root);
  return {
    document,
    root,
    trigger: root.querySelector(".trigger"),
    popup: root.querySelector(".popup"),
    search: root.querySelector(".search"),
    custodian: createFocusCustodian(() => root),
  };
}

test("focus returns to whoever held it before the widget moved it", () => {
  const w = widget();
  w.trigger.focus();
  assert.equal(w.document.activeElement, w.trigger);

  w.custodian.remember();
  w.search.focus();
  assert.equal(w.document.activeElement, w.search, "the widget moved focus into its popup");

  const landed = w.custodian.restore();
  assert.equal(landed, w.trigger);
  assert.equal(w.document.activeElement, w.trigger, "and handed it back");
});

test("a preferred target wins when it will take focus", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();

  assert.equal(w.custodian.restore(w.search), w.search, "the caller's choice is honoured");
});

test("a preferred target that cannot take focus falls through to the previous owner", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();

  // The exact shape that strands a user: the overlay is torn down, and the restore is aimed at
  // something inside it. `focus()` on a detached element does nothing and says nothing.
  const detached = w.document.createElement("button");
  assert.equal(w.custodian.restore(detached), w.trigger, "an unreachable target must not win");
  assert.equal(w.document.activeElement, w.trigger);
});

test("a hidden target falls through rather than swallowing the focus", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();

  w.popup.hidden = true;
  assert.equal(w.custodian.restore(w.search), w.trigger, "a hidden ancestor makes it unreachable");
});

test("a disabled target falls through", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();

  const disabled = w.document.createElement("button");
  disabled.disabled = true;
  w.root.append(disabled);
  assert.equal(w.custodian.restore(disabled), w.trigger);
});

test("when the previous owner has gone, focus lands inside the widget rather than on the body", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();

  // The trigger is replaced by a re-render: the remembered owner is now detached.
  w.trigger.remove();

  const landed = w.custodian.restore();
  assert.ok(landed, "something in the widget must take it");
  assert.ok(w.root.contains(landed), "and it must be inside the widget");
  assert.notEqual(w.document.activeElement, w.document.body, "never the document body");
});

test("focus goes nowhere only when the whole widget has left the document", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();
  w.root.remove();

  assert.equal(w.custodian.restore(), null, "there is genuinely nowhere to stand");
});

test("remember keeps the owner from outside the interaction, not the widget's own last move", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();

  // A widget that focuses its own parts and re-records would hand focus back to itself, which is
  // how a dismissed overlay returns the user to the element it just removed.
  w.search.focus();
  w.custodian.remember();

  assert.equal(w.custodian.restore(), w.trigger, "the first owner is still the one worth returning to");
});

test("release forgets the owner, so a destroyed widget holds no reference", () => {
  const w = widget();
  // Remembered from *outside* the widget, so falling back inside it is distinguishable from
  // handing it back. With the owner inside, both answers are the same element and the test would
  // pass whatever release did.
  const outside = w.document.createElement("button");
  w.document.body.append(outside);
  outside.focus();
  w.custodian.remember();
  w.search.focus();

  w.custodian.release();
  const landed = w.custodian.restore();
  assert.notEqual(landed, outside, "the remembered owner was released");
  assert.ok(w.root.contains(landed), "so focus falls back inside the widget");
});

test("without release, an owner outside the widget still gets it back", () => {
  const w = widget();
  const outside = w.document.createElement("button");
  w.document.body.append(outside);
  outside.focus();
  w.custodian.remember();
  w.search.focus();

  assert.equal(w.custodian.restore(), outside, "focus came from outside and goes back outside");
});

/**
 * The case that makes the verification load-bearing rather than belt-and-braces.
 *
 * A plain `<div>` is connected, not disabled, not hidden and has no hidden ancestor — it passes
 * every reachability check that can be made by inspection. It still will not take focus, because
 * nothing made it focusable. Only asking `activeElement` afterwards can tell.
 *
 * Without this, removing the verification breaks no test: the reachability filter happens to catch
 * every other case, and the rule looks redundant right up until an element is plausible and inert.
 */
test("a target that looks reachable but refuses focus falls through", () => {
  const w = widget();
  w.trigger.focus();
  w.custodian.remember();
  w.search.focus();

  const inert = w.document.createElement("div");
  inert.textContent = "not focusable";
  w.root.append(inert);

  assert.equal(w.custodian.restore(inert), w.trigger, "asking is not the same as being taken");
  assert.equal(w.document.activeElement, w.trigger);
});
