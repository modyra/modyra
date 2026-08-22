/**
 * Primitive field controller conformance tests.
 */

import assert from "node:assert";
import test from "node:test";

import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import {
  createTextFieldController,
} from "../dist/field/index.js";

function setupText() {
  const form = createForm({ email: field("", [required()]) });
  const handle = form.f.email;
  const controller = createTextFieldController({
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
  const readonly = rx.signal(false);
  // Derived exactly as the engine derives it, so a stand-in handle cannot describe a state the
  // real one can never be in.
  const interactivity = rx.computed(() =>
    disabled() ? "disabled" : readonly() ? "readonly" : "enabled");

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

  const controller = createTextFieldController({
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
  // Touched, because a verdict is announced to somebody who has been at the field: `aria-invalid`
  // and the error list say the same thing, and neither says it about a rule nobody has answered yet.
  controller.dispatch({ type: "blur" });
  const view = controller.view();
  assert.strictEqual(view.parts.input.attributes.type, "email");
  assert.strictEqual(view.parts.input.attributes["aria-invalid"], "true");
  assert.strictEqual(view.parts.input.attributes["aria-required"], "true");
  assert.strictEqual(view.parts.input.attributes["aria-describedby"].includes("email__errors"), true);
  assert.strictEqual(view.parts.label.attributes.for, "email");
  // The root carries the renderer base. Invalid and required are *announced* — `aria-invalid` and
  // `aria-required` above — and are no longer also spelled as root classes: the `mdy-field--*`
  // vocabulary that carried them was declared for years and painted by no theme.
  assert.strictEqual(view.root.classes.includes("mdy-renderer"), true);
});

test("view updates when value becomes valid", () => {
  const { controller, handle } = setupText();
  controller.dispatch({ type: "input", value: "a@b.co" });
  const view = controller.view();
  assert.strictEqual(view.parts.input.attributes["aria-invalid"], "false");
  assert.strictEqual(view.root.classes.includes("mdy-renderer"), true);
  assert.strictEqual(view.parts.input.attributes["aria-describedby"].includes("email__description"), true);
});

test("out of play, no verdict: a disabled field reports no failure to show", () => {
  // The form does not validate a disabled field — `form.state.valid()` ignores it — so reporting it
  // as failing offers a verdict its own form does not hold. A closed section of required fields was
  // a block of red boxes for something nobody was being asked. The wrapper class belongs to each
  // renderer; what every renderer reads is this state and this attribute.
  const form = createForm({ email: field("", [required()]) });
  form.activate();
  const controller = createTextFieldController({ widgetId: "email", handle: form.f.email, inputType: "email" });

  assert.equal(controller.state().invalid, true, "an empty required field is failing");
  // Announced once the person has been there. The state is the verdict; the attribute is whether
  // they are being told, and those are two questions with one answer only after a touch.
  controller.dispatch({ type: "blur" });
  assert.equal(controller.view().parts.input.attributes["aria-invalid"], "true");

  form.setDisabled("email", () => true);
  assert.equal(controller.state().invalid, false, "a field the form ignores still reported a verdict");
  assert.equal(controller.view().parts.input.attributes["aria-invalid"], "false");
  assert.equal(form.state.valid(), true, "the form was asking about it after all");

  // The verdict was never wrong — it comes back the moment the field is in play again.
  form.setDisabled("email", () => false);
  assert.equal(controller.state().invalid, true);
  assert.equal(controller.view().parts.input.attributes["aria-invalid"], "true");

  controller.destroy();
  form.deactivate();
});
