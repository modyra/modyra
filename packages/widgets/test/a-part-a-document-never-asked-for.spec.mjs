/**
 * A part owed only where the page asked for the capability behind it.
 *
 * `presentWhen` says when a part is on the page. It cannot say whether the question applies at all: a
 * multiselect's reorder grip is present when there is a value *and* only where a document asked for
 * reordering, which is not a state the widget is in — it is something the page decided before the
 * widget existed.
 *
 * Read without that, the contract owed a drag handle to every multiselect holding a value. All three
 * renderers drew it only where reordering was asked for, which is right and was a rule none of them
 * could point at. Three adapters agreeing against a declaration is the evidence that the declaration
 * is what is wrong, and it is the only evidence that reads that way — one adapter disagreeing is a
 * renderer defect.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_PART_REQUIRES, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, MDY_WIDGET_KINDS } from "../dist/index.js";

test("a part with a precondition carries it into every kind that declares the part", () => {
  const entries = Object.entries(MDY_PART_REQUIRES);
  assert.ok(entries.length > 0, "no part declares a precondition, so this asserts nothing");
  for (const [part, capability] of entries) {
    const carriers = MDY_WIDGET_KINDS.filter((kind) =>
      MDY_WIDGET_CONTRACTS[kind].structure.nodes.some((node) => node.part === part));
    assert.ok(carriers.length > 0, `${part} declares a precondition and no kind declares the part`);
    for (const kind of carriers) {
      const node = MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((one) => one.part === part);
      assert.equal(node.requires, capability,
        `${kind}.${part} does not carry the precondition the table gives it, so a renderer reading `
        + "the node alone owes the part unconditionally");
    }
  }
});

test("a precondition names a capability the kind's own keyboard already gates on", () => {
  // The word is shared with the key bindings deliberately: `requires` there gates a gesture on the
  // same fact. A precondition naming something no binding knows would be a second vocabulary for one
  // idea, which is how two declarations come to be read as different rules.
  for (const [part, capability] of Object.entries(MDY_PART_REQUIRES)) {
    const kinds = MDY_WIDGET_KINDS.filter((kind) =>
      MDY_WIDGET_CONTRACTS[kind].structure.nodes.some((node) => node.part === part));
    const gated = kinds.some((kind) =>
      (MDY_WIDGET_KEYBOARD[kind] ?? []).some((binding) => binding.requires === capability));
    assert.ok(gated,
      `${part} is gated on "${capability}" and no key binding of any kind that draws it knows that `
      + "word. Either the capability is spelled two ways or one of the two is wrong");
  }
});

test("and a part with no precondition is owed whenever its condition holds", () => {
  // The perimeter. Without it a table that gated every optional part would pass the two above and
  // make the whole contract conditional on capabilities nobody declares.
  const gated = MDY_WIDGET_KINDS.flatMap((kind) =>
    MDY_WIDGET_CONTRACTS[kind].structure.nodes.filter((node) => node.requires !== undefined));
  const conditional = MDY_WIDGET_KINDS.flatMap((kind) =>
    MDY_WIDGET_CONTRACTS[kind].structure.nodes.filter((node) => node.presentWhen !== undefined));
  assert.ok(gated.length < conditional.length / 4,
    `${gated.length} of ${conditional.length} conditional parts are gated on a capability. A contract `
    + "mostly conditional on what a page asked for says very little about what a renderer owes");
});
