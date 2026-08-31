/**
 * The semantic element categories say what they admit, where a renderer author reads them.
 *
 * `MdyWidgetSemanticElement` names twenty categories; `MDY_SEMANTIC_ELEMENTS` is the table a
 * conformance run judges a renderer against. The names and the table are two halves of one answer,
 * and the type's prose describes the table — so a category added to one and not the other leaves a
 * renderer author guessing, which is how a mapping gets invented instead of read.
 *
 * Four categories are deliberately unconstrained. That is a decision, not an omission, so it is
 * asserted rather than tolerated: constraining one of them, or leaving a fifth unconstrained by
 * accident, is a change to what the contract promises.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MDY_WIDGET_CONTRACTS } from "../dist/index.js";
import { MDY_SEMANTIC_ELEMENTS } from "../dist/testing/index.js";

/** Deliberately unconstrained: a renderer may draw these however it likes. */
const UNCONSTRAINED = ["group", "popup", "presentation", "root"];

const used = new Set();
for (const widget of Object.values(MDY_WIDGET_CONTRACTS)) {
  for (const node of widget.structure.nodes) used.add(node.element);
}

test("every category a contract uses is one the table judges", () => {
  const missing = [...used].filter((name) => !(name in MDY_SEMANTIC_ELEMENTS)).sort();
  assert.deepEqual(missing, [], "a category no table entry covers is judged by nothing");
});

test("the table describes no category the contracts never use", () => {
  const unused = Object.keys(MDY_SEMANTIC_ELEMENTS).filter((name) => !used.has(name)).sort();
  assert.deepEqual(unused, [], "an entry for a category nobody uses is a rule guarding nothing");
});

test("exactly the four documented categories are unconstrained", () => {
  const open = Object.entries(MDY_SEMANTIC_ELEMENTS)
    .filter(([, constraint]) => constraint === undefined)
    .map(([name]) => name)
    .sort();
  assert.deepEqual(open, UNCONSTRAINED);
});

test("a constrained category admits at least one tag or one role", () => {
  for (const [name, constraint] of Object.entries(MDY_SEMANTIC_ELEMENTS)) {
    if (constraint === undefined) continue;
    assert.ok(
      constraint.tags.length > 0 || constraint.roles.length > 0,
      `${name} is constrained by an empty rule, which admits nothing and reads as an oversight`,
    );
  }
});
