/**
 * A mandatory part whose only declared home is gone was not omitted — it had nowhere to be.
 *
 * The contract has thirteen parts that are mandatory under an optional parent. Eight of them live
 * inside an overlay, and the kit already knew that a closed picker is not hiding its calendar. The
 * other five sit under `documentDeclaresIt` and `kindOffersIt` parents — a checkbox's `indicator`
 * lives under its `label`, and a document with no caption may legitimately have none. Asking for
 * the child there asks a renderer for an element and refuses it the place to put it.
 *
 * The line is drawn at a *declaration*, not at an absence: a parent that is simply not in the DOM
 * excuses nothing, so a renderer cannot quietly drop a subtree and have the kit agree.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { MDY_WIDGET_CONTRACTS } from "../dist/index.js";
import { inspectWidgetDom } from "../dist/testing/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;

/** Every part the contract makes mandatory under a parent it makes optional. */
function mandatoryUnderOptional() {
  const found = [];
  for (const [kind, widget] of Object.entries(MDY_WIDGET_CONTRACTS)) {
    const byPart = Object.fromEntries(widget.structure.nodes.map((node) => [node.part, node]));
    for (const node of widget.structure.nodes) {
      if (node.optional || !node.parent) continue;
      const parent = byPart[node.parent];
      if (parent?.optional) found.push({ kind, part: node.part, parent: node.parent });
    }
  }
  return found;
}

test("the contract has such parts, or the rule below guards nothing", () => {
  const pairs = mandatoryUnderOptional();
  assert.ok(pairs.length > 0, "no mandatory part sits under an optional parent");
  const beyondOverlays = pairs.filter(({ kind, parent }) => {
    const contract = MDY_WIDGET_CONTRACTS[kind].parts[parent];
    return contract?.presentWhen !== "overlayIsOpen";
  });
  assert.ok(
    beyondOverlays.length > 0,
    "every case is an overlay, so this rule adds nothing to the one the kit already had",
  );
});

/** A checkbox as plain draws it: root, then a label with the indicator inside. */
function drawCheckbox({ label = true, indicator = true } = {}) {
  const parts = MDY_WIDGET_CONTRACTS.checkbox.parts;
  const root = document.createElement("div");
  for (const one of parts.root.classes) root.classList.add(one);
  const wrapper = document.createElement("div");
  for (const one of parts.inputWrapper.classes) wrapper.classList.add(one);
  root.append(wrapper);
  const control = document.createElement("input");
  control.type = "checkbox";
  wrapper.append(control);
  if (label) {
    const caption = document.createElement("label");
    for (const one of parts.label.classes) caption.classList.add(one);
    wrapper.append(caption);
    if (indicator) {
      const mark = document.createElement("span");
      for (const one of parts.indicator.classes) mark.classList.add(one);
      caption.append(mark);
    }
  }
  // `control` carries no class of its own, so where it is has to be said rather than found — which
  // is what a fixture's `parts()` is for.
  return { root, parts: { control } };
}

const codesFor = ({ root, parts }, absentParts) =>
  inspectWidgetDom(root, "checkbox", { parts, absentParts })
    .filter((issue) => issue.code === "PART_MISSING")
    .map((issue) => issue.part);

test("a declared-absent parent excuses the mandatory part inside it", () => {
  assert.deepEqual(codesFor(drawCheckbox({ label: false }), ["label"]), []);
});

test("a parent that is merely missing excuses nothing", () => {
  assert.deepEqual(
    codesFor(drawCheckbox({ label: false }), []),
    ["indicator"],
    "an undeclared absence let a renderer drop a subtree unnoticed",
  );
});

test("the part is still required when its parent is there", () => {
  assert.deepEqual(codesFor(drawCheckbox({ indicator: false }), []), ["indicator"]);
});
