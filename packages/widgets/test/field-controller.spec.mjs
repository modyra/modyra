/**
 * Primitive field controller conformance tests.
 */

import assert from "node:assert";
import test from "node:test";

import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import { createFieldController } from "../dist/field/index.js";

function setupText() {
  const form = createForm({ email: field("", [required()]) });
  const handle = form.f.email;
  const controller = createFieldController({
    widgetId: "email",
    handle,
    inputType: "email",
    autocomplete: "email",
  });
  return { controller, handle };
}

function setupMockHandle(initialValue = "") {
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
    path: "mock",
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

  const controller = createFieldController({
    widgetId: "mock",
    handle,
    inputType: "text",
  });

  return { controller, handle, rx };
}

test("initial state mirrors the field handle", () => {
  const { controller, handle } = setupText();
  const state = controller.state();
  assert.strictEqual(state.value, "");
  assert.strictEqual(state.invalid, true);
  assert.strictEqual(state.disabled, false);
  assert.strictEqual(state.readonly, false);
  assert.strictEqual(state.required, true);
  assert.strictEqual(state.touched, false);
  assert.strictEqual(state.dirty, false);
  assert.strictEqual(state.pending, false);
  assert.strictEqual(handle.touched(), false);
});

test("input intent updates value and marks dirty", () => {
  const { controller, handle } = setupText();
  const commands = controller.dispatch({ type: "input", value: "a@b.co" });
  assert.strictEqual(controller.state().value, "a@b.co");
  assert.strictEqual(controller.state().dirty, true);
  assert.strictEqual(handle.value(), "a@b.co");
  assert.strictEqual(handle.dirty(), true);
  assert.ok(commands.some((c) => c.type === "mark-dirty"));
});

test("blur intent marks touched", () => {
  const { controller, handle } = setupText();
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(controller.state().touched, true);
  assert.strictEqual(handle.touched(), true);
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("disabled controller ignores input but still marks touched on blur", () => {
  const { controller, handle } = setupMockHandle();
  handle.disabled.set(true);
  const inputCommands = controller.dispatch({ type: "input", value: "x" });
  assert.strictEqual(inputCommands.length, 0);
  assert.strictEqual(handle.value(), "");
  const blurCommands = controller.dispatch({ type: "blur" });
  assert.ok(blurCommands.some((c) => c.type === "mark-touched"));
  assert.strictEqual(handle.touched(), true);
});

test("readonly controller ignores input", () => {
  const { controller, handle } = setupMockHandle();
  controller.setReadonly(true);
  controller.dispatch({ type: "input", value: "x" });
  assert.strictEqual(handle.value(), "");
  assert.strictEqual(handle.dirty(), false);
});

test("view exposes ARIA contract", () => {
  const { controller } = setupText();
  const view = controller.view();
  assert.strictEqual(view.parts.input.attributes.type, "email");
  assert.strictEqual(view.parts.input.attributes["aria-invalid"], true);
  assert.strictEqual(view.parts.input.attributes["aria-required"], true);
  assert.strictEqual(view.parts.input.attributes["aria-describedby"].includes("email-errors"), true);
  assert.strictEqual(view.parts.label.attributes.for, "email");
  assert.strictEqual(view.root.classes.includes("mdy-field--invalid"), true);
  assert.strictEqual(view.root.classes.includes("mdy-field--required"), true);
});

test("view updates when value becomes valid", () => {
  const { controller, handle } = setupText();
  controller.dispatch({ type: "input", value: "a@b.co" });
  const view = controller.view();
  assert.strictEqual(view.parts.input.attributes["aria-invalid"], false);
  assert.strictEqual(view.root.classes.includes("mdy-field--invalid"), false);
  assert.strictEqual(view.parts.input.attributes["aria-describedby"].includes("email-description"), true);
});
