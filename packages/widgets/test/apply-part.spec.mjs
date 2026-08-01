/**
 * `applyPart` owns the classes a contract names, and nothing else.
 *
 * A renderer's own classes arrive from two directions: some are written once when the element is
 * created, others are toggled by a framework binding on every change. A part applier that rebuilds
 * the whole `class` attribute erases the second kind, and does it silently — the element keeps
 * rendering, just without a state class.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { applyPart } = await import("../dist/index.js");

const part = (classes, attributes = {}) => ({ classes, attributes });

function element(className = "") {
  const node = document.createElement("div");
  if (className) node.className = className;
  return node;
}

test("a class added between applies survives the next one", () => {
  const node = element("mdy-slider");
  applyPart(node, part(["mdy-part-class"]));

  // What a framework binding does: toggle a state class the contract knows nothing about.
  node.classList.add("mdy-input-wrapper--disabled");

  applyPart(node, part(["mdy-part-class"]));

  assert.ok(
    node.classList.contains("mdy-input-wrapper--disabled"),
    "a class the contract does not name must not be removed",
  );
  assert.ok(node.classList.contains("mdy-part-class"));
  assert.ok(node.classList.contains("mdy-slider"), "the creation-time class stays");
});

test("a class the contract drops is removed", () => {
  const node = element();
  applyPart(node, part(["was-here"]));
  assert.ok(node.classList.contains("was-here"));

  applyPart(node, part(["now-here"]));
  assert.ok(!node.classList.contains("was-here"), "a class it added and dropped goes away");
  assert.ok(node.classList.contains("now-here"));
});

test("a contract that names no classes leaves the attribute alone", () => {
  // Every projection-driven part is this shape: attributes only. It must not be able to strip
  // classes it never added.
  const node = element("mdy-colors__native-hidden");
  applyPart(node, part([], { "aria-disabled": "true" }));

  assert.equal(node.className, "mdy-colors__native-hidden");
  assert.equal(node.getAttribute("aria-disabled"), "true");
});

test("attributes still follow the contract in both directions", () => {
  const node = element();
  applyPart(node, part([], { "aria-disabled": "true", disabled: true }));
  assert.equal(node.getAttribute("aria-disabled"), "true");
  assert.ok(node.hasAttribute("disabled"));

  // `false` removes a boolean attribute; an ARIA state is a string and stays.
  applyPart(node, part([], { "aria-disabled": "false", disabled: false }));
  assert.equal(node.getAttribute("aria-disabled"), "false");
  assert.ok(!node.hasAttribute("disabled"));
});
