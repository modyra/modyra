/**
 * One way back, and what withdraws it.
 *
 * ADR 0129 settles that a multiselect has a single reversal covering the last destructive change —
 * a removal, a move, or a clear — rather than one undo per act. These assertions hold the three
 * properties that decision rests on, none of which a happy-path check would notice:
 *
 * - depth is **one**: a second act replaces the offer rather than stacking on it;
 * - a **constructive** act withdraws it, so the reversal never puts back something the person did
 *   not just lose;
 * - a move restores the **order**, which is the half of a reorder that a membership comparison
 *   cannot see.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, vanillaReactivity } from "@modyra/core";
import { createMultiselectFieldController } from "../dist/field/index.js";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

/** A controller over a form holding the three values, with the reactivity the form owns. */
function open(initial = ["a", "b", "c"], mode = "single") {
  const form = createForm({ s: field(initial) }, { reactivity: vanillaReactivity(), devWarnings: false });
  const controller = createMultiselectFieldController({
    widgetId: "w", handle: form.f.s, options: OPTIONS, mode,
  });
  return { form, controller, value: () => form.f.s.value() };
}

test("a removal offers a way back, and taking it restores what was lost", () => {
  const { form, controller, value } = open();
  controller.dispatch({ type: "toggle", optionKey: "a" });
  assert.deepEqual(value(), ["b", "c"]);
  assert.deepEqual(controller.state().wayBack, { act: "remove", optionKey: "a", count: 1 });

  controller.dispatch({ type: "undo" });
  assert.deepEqual(value(), ["a", "b", "c"]);
  // Spent once taken: a second press must not walk further back into a history this control does
  // not keep.
  assert.equal(controller.state().wayBack, null);
  controller.destroy(); form.destroy();
});

test("a move is undone as a move: the order comes back, not just the membership", () => {
  const { form, controller, value } = open();
  controller.dispatch({ type: "move-selected", optionKey: "c", to: 0 });
  assert.deepEqual(value(), ["c", "a", "b"]);
  assert.deepEqual(controller.state().wayBack, { act: "move", optionKey: "c", count: 3 });

  controller.dispatch({ type: "undo" });
  assert.deepEqual(value(), ["a", "b", "c"], "the order the move changed was not restored");
  controller.destroy(); form.destroy();
});

test("a clear offers back everything it took, and says how many", () => {
  const { form, controller, value } = open();
  controller.dispatch({ type: "clear" });
  assert.deepEqual(value(), []);
  assert.deepEqual(controller.state().wayBack, { act: "clear", optionKey: null, count: 3 });

  controller.dispatch({ type: "undo" });
  assert.deepEqual(value(), ["a", "b", "c"]);
  controller.destroy(); form.destroy();
});

test("clearing an empty selection is not an act, and offers nothing", () => {
  const { form, controller } = open([]);
  controller.dispatch({ type: "clear" });
  assert.equal(controller.state().wayBack, null, "an offer to restore nothing is a trap, not a way back");
  controller.destroy(); form.destroy();
});

test("depth is one: a second act replaces the offer rather than stacking on it", () => {
  const { form, controller, value } = open();
  controller.dispatch({ type: "toggle", optionKey: "a" });
  const afterFirst = value();
  controller.dispatch({ type: "toggle", optionKey: "b" });
  assert.deepEqual(value(), ["c"]);

  controller.dispatch({ type: "undo" });
  assert.deepEqual(value(), afterFirst, "one press went back further than one act");
  controller.dispatch({ type: "undo" });
  assert.deepEqual(value(), afterFirst, "the second press found a history this control does not keep");
  controller.destroy(); form.destroy();
});

test("a constructive act withdraws the offer", () => {
  const { form, controller } = open();
  controller.dispatch({ type: "toggle", optionKey: "a" });
  assert.notEqual(controller.state().wayBack, null);

  // Choosing again is not something to be put back, and an offer left standing across it would
  // reverse a loss the person has already made good.
  controller.dispatch({ type: "toggle", optionKey: "a" });
  assert.equal(controller.state().wayBack, null);
  controller.destroy(); form.destroy();
});

test("in counter mode one fewer is a loss and one more is not", () => {
  const { form, controller, value } = open(["a", "a", "b"], "multi");
  controller.dispatch({ type: "decrement", optionKey: "a" });
  assert.deepEqual(value(), ["a", "b"]);
  assert.deepEqual(controller.state().wayBack, { act: "remove", optionKey: "a", count: 1 });

  controller.dispatch({ type: "increment", optionKey: "a" });
  assert.equal(controller.state().wayBack, null);
  controller.destroy(); form.destroy();
});

test("a field out of play has no way back to offer", () => {
  const { form, controller, value } = open();
  form.setDisabled("s", () => true);
  controller.dispatch({ type: "clear" });
  assert.deepEqual(value(), ["a", "b", "c"], "a disabled field cleared itself");
  assert.equal(controller.state().wayBack, null);
  controller.destroy(); form.destroy();
});
