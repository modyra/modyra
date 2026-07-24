/**
 * Multiselect field controller conformance tests. Modeled on Angular's real
 * MdyMultiselectComponent semantics (toggle-set "single" mode, counter/bag
 * "multi" mode) — see multiselect-field-controller.ts's own doc comment.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createMultiselectFieldController } from "../dist/field/index.js";

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
  assert.strictEqual(view.parts.group.classes.includes("mdy-multiselect"), true);
  assert.strictEqual(view.parts.medium.attributes["aria-pressed"], true);
  assert.strictEqual(view.parts.small.attributes["aria-pressed"], false);
  assert.strictEqual(view.parts.large.attributes["aria-disabled"], true);
});

test("multi mode view exposes data-count instead of aria-pressed", () => {
  const { controller } = setup("multi");
  controller.dispatch({ type: "increment", optionKey: "small" });
  controller.dispatch({ type: "increment", optionKey: "small" });
  const view = controller.view();
  assert.strictEqual(view.parts.small.attributes["data-count"], 2);
  assert.strictEqual("aria-pressed" in view.parts.small.attributes, false);
});

test("setValue updates state programmatically", () => {
  const { controller, handle } = setup();
  controller.setValue(["small", "large"]);
  assert.deepStrictEqual(handle.value(), ["small", "large"]);
  assert.strictEqual(controller.state().selectedKeys.has("large"), true);
});
