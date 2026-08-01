/**
 * Multiselect field controller conformance tests. Modeled on Angular's real
 * MdyMultiselectComponent semantics (toggle-set "single" mode, counter/bag
 * "multi" mode) — see multiselect-field-controller.ts's own doc comment.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createMultiselectFieldController } from "../dist/field/index.js";
import { MDY_VALUE_CONTRACTS } from "../../core/dist/index.js";

const options = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large", disabled: true },
];

function setup(mode = "single", initialValue = []) {
  const rx = vanillaReactivity();
  const value = rx.signal(initialValue);
  const errors = rx.signal([]);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const valid = rx.computed(() => errors().length === 0);
  const pending = rx.signal(false);
  const required = rx.signal(false);
  const disabled = rx.signal(false);
  const readonly = rx.signal(false);
  // Derived exactly as the engine derives it, so a stand-in handle cannot describe a state the
  // real one can never be in.
  const interactivity = rx.computed(() =>
    disabled() ? "disabled" : readonly() ? "readonly" : "enabled");

  const handle = {
    path: "sizes",
    value,
    errors,
    touched,
    dirty,
    valid,
    pending,
    required,
    disabled,
    readonly,
    interactivity,
    set(v) {
      value.set(v);
    },
    markAsTouched() {
      touched.set(true);
    },
    markAsDirty() {
      dirty.set(true);
    },
  };

  const controller = createMultiselectFieldController(
    { widgetId: "sizes", handle, options, mode },
    rx,
  );

  return { controller, handle, rx };
}

test("initial state is empty", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.deepStrictEqual(state.selectedValues, []);
  assert.strictEqual(state.selectedKeys.size, 0);
  assert.strictEqual(state.touched, false);
});

test("single mode: toggle adds then removes, marks dirty/touched", () => {
  const { controller, handle } = setup("single");
  controller.dispatch({ type: "toggle", optionKey: "medium" });
  assert.deepStrictEqual(handle.value(), ["medium"]);
  assert.strictEqual(controller.state().selectedKeys.has("medium"), true);
  assert.strictEqual(handle.dirty(), true);
  assert.strictEqual(handle.touched(), true);

  controller.dispatch({ type: "toggle", optionKey: "medium" });
  assert.deepStrictEqual(handle.value(), []);
  assert.strictEqual(controller.state().selectedKeys.has("medium"), false);
});

test("single mode: toggling a disabled option is ignored", () => {
  const { controller, handle } = setup("single");
  controller.dispatch({ type: "toggle", optionKey: "large" });
  assert.deepStrictEqual(handle.value(), []);
  assert.strictEqual(handle.dirty(), false);
});

test("multi mode: increment appends, allowing repeats; decrement removes one", () => {
  const { controller, handle } = setup("multi");
  controller.dispatch({ type: "increment", optionKey: "small" });
  controller.dispatch({ type: "increment", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), ["small", "small"]);
  assert.strictEqual(controller.state().counts.get("small"), 2);

  controller.dispatch({ type: "decrement", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), ["small"]);
  assert.strictEqual(controller.state().counts.get("small"), 1);
});

test("decrementing an option not present is a no-op", () => {
  const { controller, handle } = setup("multi");
  const commands = controller.dispatch({ type: "decrement", optionKey: "medium" });
  assert.deepStrictEqual(handle.value(), []);
  assert.deepStrictEqual(commands, []);
});

test("clear resets to an empty array", () => {
  const { controller, handle } = setup("single", ["small", "medium"]);
  controller.dispatch({ type: "clear" });
  assert.deepStrictEqual(handle.value(), []);
});

test("blur marks touched without altering the value", () => {
  const { controller, handle } = setup();
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(handle.touched(), true);
  assert.deepStrictEqual(handle.value(), []);
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("search filters filteredOptions by label, case-insensitive, without touching selection", () => {
  const { controller, handle } = setup("single", ["small"]);
  controller.dispatch({ type: "search", query: "lar" });
  assert.deepStrictEqual(controller.filteredOptions().map((o) => o.value), ["large"]);
  assert.deepStrictEqual(handle.value(), ["small"]); // search never mutates the field
});

test("disabled controller ignores toggle/increment/decrement/clear", () => {
  const { controller, handle } = setup("single");
  handle.disabled.set(true);
  controller.dispatch({ type: "toggle", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), []);
  assert.strictEqual(handle.dirty(), false);
});

test("view exposes chip-group ARIA contract (role=group, not listbox)", () => {
  const { controller } = setup("single", ["medium"]);
  const view = controller.view();
  assert.strictEqual(view.parts.group.attributes.role, "group");
  // The chip group is the popup's content; `mdy-multiselect` belongs to the trigger that opens it.
  assert.strictEqual(view.parts.group.classes.includes("mdy-multiselect__options"), true);
  assert.strictEqual(view.parts.trigger.classes.includes("mdy-multiselect"), true);
  assert.strictEqual(view.parts.medium.attributes["aria-pressed"], "true");
  assert.strictEqual(view.parts.small.attributes["aria-pressed"], "false");
  assert.strictEqual(view.parts.large.attributes["aria-disabled"], "true");
});

test("multi mode view exposes data-count instead of aria-pressed", () => {
  const { controller } = setup("multi");
  controller.dispatch({ type: "increment", optionKey: "small" });
  controller.dispatch({ type: "increment", optionKey: "small" });
  const view = controller.view();
  assert.strictEqual(view.parts.small.attributes["data-count"], 2);
  assert.strictEqual("aria-pressed" in view.parts.small.attributes, false);
});

test("the options live in an overlay the trigger controls", () => {
  const { controller } = setup();
  assert.strictEqual(controller.state().open, false);
  assert.strictEqual(controller.view().parts.popup.attributes.hidden, true);

  const opened = controller.dispatch({ type: "toggleOpen" });
  assert.strictEqual(controller.state().open, true);
  assert.strictEqual(controller.view().parts.trigger.attributes["aria-expanded"], "true");
  assert.strictEqual(controller.view().parts.popup.attributes.hidden, false);
  // Opening moves focus into the filter field, exactly like select's overlay does.
  assert.deepStrictEqual(opened.map((c) => c.type), ["open-overlay", "focus"]);

  // Picking does not close: a multiselect exists to take more than one choice.
  controller.dispatch({ type: "toggle", optionKey: "small" });
  assert.strictEqual(controller.state().open, true);

  const closed = controller.dispatch({ type: "close", restoreFocus: true });
  assert.strictEqual(controller.state().open, false);
  assert.deepStrictEqual(closed.map((c) => c.type), ["close-overlay", "restore-focus"]);
});

test("closing clears the filter so reopening shows every option", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "search", query: "sma" });
  assert.strictEqual(controller.filteredOptions().length, 1);
  controller.dispatch({ type: "close" });
  assert.strictEqual(controller.state().query, "");
  assert.strictEqual(controller.filteredOptions().length, 3);
});

test("a disabled multiselect does not open", () => {
  const { controller, handle } = setup();
  handle.disabled.set(true);
  assert.deepStrictEqual(controller.dispatch({ type: "open" }), []);
  assert.strictEqual(controller.state().open, false);
});

test("setValue updates state programmatically", () => {
  const { controller, handle } = setup();
  controller.setValue(["small", "large"]);
  assert.deepStrictEqual(handle.value(), ["small", "large"]);
  assert.strictEqual(controller.state().selectedKeys.has("large"), true);
});

/* ── The declared commit mode ───────────────────────────────────────────────────
 * The other half of what `MDY_VALUE_CONTRACTS` distinguishes: a `live` kind writes through on the
 * interaction itself. Asserting only the `confirm` side would leave the two modes indistinguishable
 * — a contract where every kind behaved the same would still pass.
 */
test("a live-mode kind writes through on the interaction itself", () => {
  assert.strictEqual(MDY_VALUE_CONTRACTS.multiselect.commit, "live");

  const { controller, handle } = setup();
  const before = handle.value();

  controller.dispatch({ type: "toggle", optionKey: "medium" });

  assert.notDeepStrictEqual(handle.value(), before, "the interaction did not reach the field");
});
