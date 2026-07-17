/**
 * Boolean field controller conformance tests.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createBooleanFieldController } from "../dist/field/index.js";

function setup(checked = false, variant = "checkbox") {
  const rx = vanillaReactivity();
  const value = rx.signal(checked);
  const errors = rx.signal([]);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const valid = rx.computed(() => errors().length === 0);
  const pending = rx.signal(false);
  const required = rx.signal(false);
  const disabled = rx.signal(false);

  const handle = {
    path: "agree",
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

  const controller = createBooleanFieldController(
    {
      widgetId: "agree",
      handle,
      variant,
    },
    rx,
  );

  return { controller, handle, rx };
}

test("initial unchecked state", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.strictEqual(state.checked, false);
  assert.strictEqual(state.invalid, false);
  assert.strictEqual(state.touched, false);
  assert.strictEqual(state.dirty, false);
});

test("check intent updates value and marks dirty", () => {
  const { controller, handle } = setup(false);
  const commands = controller.dispatch({ type: "check" });
  assert.strictEqual(controller.state().checked, true);
  assert.strictEqual(handle.value(), true);
  assert.strictEqual(handle.dirty(), true);
  assert.ok(commands.some((c) => c.type === "mark-dirty"));
});

test("toggle inverts value", () => {
  const { controller, handle } = setup(false);
  controller.dispatch({ type: "toggle" });
  assert.strictEqual(handle.value(), true);
  controller.dispatch({ type: "toggle" });
  assert.strictEqual(handle.value(), false);
});

test("blur marks touched", () => {
  const { controller, handle } = setup();
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(handle.touched(), true);
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("disabled controller ignores check", () => {
  const { controller, handle } = setup();
  handle.disabled.set(true);
  controller.dispatch({ type: "check" });
  assert.strictEqual(handle.value(), false);
  assert.strictEqual(handle.dirty(), false);
});

test("checkbox view exposes ARIA contract", () => {
  const { controller } = setup(true, "checkbox");
  const view = controller.view();
  assert.strictEqual(view.parts.input.attributes.type, "checkbox");
  assert.strictEqual(view.parts.input.attributes.role, "checkbox");
  assert.strictEqual(view.parts.input.attributes.checked, true);
  assert.strictEqual(view.parts.input.attributes["aria-checked"], true);
  assert.strictEqual(view.root.classes.includes("mdy-field--checked"), true);
});

test("switch view exposes ARIA contract", () => {
  const { controller } = setup(false, "switch");
  const view = controller.view();
  assert.strictEqual(view.parts.input.attributes.type, null);
  assert.strictEqual(view.parts.input.attributes.role, "switch");
  assert.strictEqual(view.parts.input.attributes.checked, false);
  assert.strictEqual(view.parts.input.attributes["aria-checked"], false);
});
