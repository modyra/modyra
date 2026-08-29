/**
 * Setting a custom property to the value it already holds is not free.
 *
 * A custom property write invalidates style on the element and on everything inheriting from it,
 * which for a popup holding a calendar is its whole subtree — on every pass of a tracker that runs
 * while the page scrolls. So the rule is that an unchanged value is not written at all.
 *
 * A rule about when *not* to write is the kind that gets applied in one renderer and forgotten in
 * the others, which is why it is one function rather than three conditions. The check counts the
 * writes rather than reading the values back: a property set to what it already held leaves the
 * element looking identical, so reading it afterwards cannot tell the two apart.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { applyOverlayProperties } from "../dist/index.js";

/** An element that says what was written to it, rather than only what it now holds. */
function watched() {
  const dom = new JSDOM("<!doctype html><html><body><div></div></body></html>");
  const element = dom.window.document.querySelector("div");
  const written = [];
  const real = element.style.setProperty.bind(element.style);
  element.style.setProperty = (property, value) => {
    written.push(property);
    real(property, value);
  };
  return { element, written };
}

test("a property that has changed is written", () => {
  const { element, written } = watched();
  applyOverlayProperties(element, { "--mdy-popup-top": "12px", "--mdy-popup-left": "4px" });

  assert.deepEqual(written, ["--mdy-popup-top", "--mdy-popup-left"]);
  assert.equal(element.style.getPropertyValue("--mdy-popup-top"), "12px");
});

test("a property already holding that value is not written again", () => {
  const { element, written } = watched();
  applyOverlayProperties(element, { "--mdy-popup-top": "12px", "--mdy-popup-left": "4px" });
  written.length = 0;

  applyOverlayProperties(element, { "--mdy-popup-top": "12px", "--mdy-popup-left": "4px" });
  assert.deepEqual(written, [],
    "an anchoring pass that moved nothing still invalidated the popup's whole subtree. A tracker "
    + "runs this on every scroll frame, so the cost is paid continuously for no visible change");
});

test("the one property that moved is the only one written", () => {
  const { element, written } = watched();
  applyOverlayProperties(element, { "--mdy-popup-top": "12px", "--mdy-popup-left": "4px" });
  written.length = 0;

  applyOverlayProperties(element, { "--mdy-popup-top": "40px", "--mdy-popup-left": "4px" });
  assert.deepEqual(written, ["--mdy-popup-top"],
    "the unchanged property was rewritten alongside the one that moved, so the rule is 'write when "
    + "anything changed' rather than 'write what changed'");
});
