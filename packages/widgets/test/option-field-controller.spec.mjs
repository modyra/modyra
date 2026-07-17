/**
 * Option-based field controller conformance tests (radio / segmented).
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createOptionFieldController } from "../dist/field/index.js";

const options = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large", disabled: true },
];

function setup(variant = "radio", initialValue = null) {
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
    path: "size",
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

  const controller = createOptionFieldController(
    {
      widgetId: "size",
      handle,
      options,
      variant,
    },
    rx,
  );

  return { controller, handle, rx };
}

test("initial state is empty", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.strictEqual(state.selectedValue, null);
  assert.strictEqual(state.selectedKey, null);
  assert.strictEqual(state.touched, false);
  assert.strictEqual(state.dirty, false);
});

test("select updates value and marks dirty/touched", () => {
  const { controller, handle } = setup();
  const commands = controller.dispatch({ type: "select", optionKey: "medium" });
  assert.strictEqual(controller.state().selectedValue, "medium");
  assert.strictEqual(controller.state().selectedKey, "medium");
  assert.strictEqual(handle.value(), "medium");
  assert.strictEqual(handle.dirty(), true);
  assert.strictEqual(handle.touched(), true);
  assert.ok(commands.some((c) => c.type === "mark-dirty"));
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("select disabled option is ignored", () => {
  const { controller, handle } = setup();
  controller.dispatch({ type: "select", optionKey: "large" });
  assert.strictEqual(handle.value(), null);
  assert.strictEqual(handle.dirty(), false);
});

test("blur marks touched", () => {
  const { controller, handle } = setup();
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(handle.touched(), true);
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("move changes active key within enabled options", () => {
  const { controller } = setup();
  controller.dispatch({ type: "move", target: "next" });
  assert.strictEqual(controller.state().selectedKey, null); // selection not changed
  const view = controller.view();
  assert.strictEqual(view.parts.small.attributes["aria-checked"], false);
  assert.strictEqual(view.parts.medium.attributes["aria-checked"], false);
});

test("disabled controller ignores select", () => {
  const { controller, handle } = setup();
  handle.disabled.set(true);
  controller.dispatch({ type: "select", optionKey: "small" });
  assert.strictEqual(handle.value(), null);
  assert.strictEqual(handle.dirty(), false);
});

test("radio view exposes ARIA contract", () => {
  const { controller } = setup("radio", "medium");
  const view = controller.view();
  assert.strictEqual(view.parts.group.attributes.role, "radiogroup");
  assert.strictEqual(view.parts.group.classes.includes("mdy-radio-group"), true);
  assert.strictEqual(view.parts.medium.attributes.role, "radio");
  assert.strictEqual(view.parts.medium.attributes["aria-checked"], true);
  assert.strictEqual(view.parts.small.attributes["aria-checked"], false);
  assert.strictEqual(view.parts.large.attributes["aria-disabled"], true);
});

test("segmented view exposes ARIA contract", () => {
  const { controller } = setup("segmented", "small");
  const view = controller.view();
  assert.strictEqual(view.parts.group.classes.includes("mdy-segmented"), true);
  assert.strictEqual(view.parts.small.attributes.role, "radio");
  assert.strictEqual(view.parts.small.attributes["aria-checked"], true);
  assert.strictEqual(view.parts.medium.attributes["aria-checked"], false);
});

test("setValue updates selectedKey", () => {
  const { controller, handle } = setup();
  controller.setValue("small");
  assert.strictEqual(handle.value(), "small");
  assert.strictEqual(controller.state().selectedKey, "small");
});
