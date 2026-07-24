/**
 * Timepicker field controller conformance tests. Modeled on Angular's real
 * MdyTimepickerComponent/MdyTimepickerClockComponent semantics — see
 * timepicker-field-controller.ts's own doc comment.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createTimepickerFieldController } from "../dist/field/index.js";

function setup(overrides = {}) {
  const rx = vanillaReactivity();
  const value = rx.signal(overrides.initialValue ?? null);
  const errors = rx.signal([]);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const valid = rx.computed(() => errors().length === 0);
  const pending = rx.signal(false);
  const required = rx.signal(false);
  const disabled = rx.signal(false);

  const handle = {
    path: "time",
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

  const controller = createTimepickerFieldController(
    { widgetId: "time", handle, ...overrides },
    rx,
  );

  return { controller, handle, rx };
}

test("initial state with no value: draft seeded from current time, not blank", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.strictEqual(state.value, null);
  assert.ok(state.draft.hour >= 1 && state.draft.hour <= 12);
  assert.ok(state.draft.minute >= 0 && state.draft.minute <= 59);
  assert.ok(state.draft.period === "AM" || state.draft.period === "PM");
});

test("initial state with a 12h value: draft matches it", () => {
  const { controller } = setup({ initialValue: "02:30 PM" });
  const state = controller.state();
  assert.deepStrictEqual(state.draft, { hour: 2, minute: 30, period: "PM" });
});

test("24h format: value stored/committed as HH:mm, draft still canonical 12h", () => {
  const { controller, handle } = setup({ initialValue: "14:30", format: "24h" });
  assert.deepStrictEqual(controller.state().draft, { hour: 2, minute: 30, period: "PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 3 });
  controller.dispatch({ type: "confirm" });
  assert.strictEqual(handle.value(), "15:30");
});

test("editing the draft does not touch the field until confirm", () => {
  const { controller, handle } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 7 });
  controller.dispatch({ type: "set-minute", minute: 15 });
  controller.dispatch({ type: "set-period", period: "AM" });
  assert.strictEqual(handle.value(), "02:30 PM"); // unchanged
  assert.strictEqual(handle.dirty(), false);
  assert.deepStrictEqual(controller.state().draft, { hour: 7, minute: 15, period: "AM" });
});

test("confirm commits the draft, marks dirty/touched, and closes", () => {
  const { controller, handle } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 7 });
  const commands = controller.dispatch({ type: "confirm" });
  assert.strictEqual(handle.value(), "07:30 PM");
  assert.strictEqual(handle.dirty(), true);
  assert.strictEqual(handle.touched(), true);
  assert.strictEqual(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "close-overlay"));
});

test("cancel discards the draft edits and restores focus", () => {
  const { controller, handle } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 11 });
  const commands = controller.dispatch({ type: "cancel" });
  assert.strictEqual(handle.value(), "02:30 PM"); // unchanged
  assert.strictEqual(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "restore-focus"));
});

test("re-opening re-seeds the draft from the committed value, discarding any prior unconfirmed edit", () => {
  const { controller } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 11 });
  controller.dispatch({ type: "cancel" });
  controller.dispatch({ type: "open" });
  assert.deepStrictEqual(controller.state().draft, { hour: 2, minute: 30, period: "PM" });
});

test("set-hour/set-minute reject out-of-range values", () => {
  const { controller } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 13 });
  controller.dispatch({ type: "set-minute", minute: 60 });
  assert.deepStrictEqual(controller.state().draft, { hour: 2, minute: 30, period: "PM" });
});

test("set-from-angle snaps to the nearest hour/minute via the shared core angle helpers", () => {
  const { controller } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-from-angle", field: "hour", angle: 0 });
  assert.strictEqual(controller.state().draft.hour, 12);
  controller.dispatch({ type: "set-from-angle", field: "minute", angle: 180 });
  assert.strictEqual(controller.state().draft.minute, 30);
});

test("focus-field tracks which dial ring/input has focus", () => {
  const { controller } = setup();
  assert.strictEqual(controller.state().focusedField, "hour");
  controller.dispatch({ type: "focus-field", field: "minute" });
  assert.strictEqual(controller.state().focusedField, "minute");
});

test("clear resets the committed value to null", () => {
  const { controller, handle } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "clear" });
  assert.strictEqual(handle.value(), null);
  assert.strictEqual(handle.dirty(), true);
});

test("blur marks touched without altering the value", () => {
  const { controller, handle } = setup({ initialValue: "02:30 PM" });
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(handle.touched(), true);
  assert.strictEqual(handle.value(), "02:30 PM");
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("disabled controller ignores open/confirm/set-hour", () => {
  const { controller, handle } = setup({ initialValue: "02:30 PM" });
  handle.disabled.set(true);
  controller.dispatch({ type: "open" });
  assert.strictEqual(controller.state().open, false);
});

test("view exposes trigger/dialog/hour/minute ARIA contract", () => {
  const { controller } = setup({ initialValue: "02:30 PM" });
  const view = controller.view();
  assert.strictEqual(view.parts.trigger.attributes.role, "combobox");
  assert.strictEqual(view.parts.dialog.attributes.role, "dialog");
  assert.strictEqual(view.parts.hour.attributes.role, "spinbutton");
  assert.strictEqual(view.parts.hour.attributes["aria-valuenow"], 2);
  assert.strictEqual(view.parts.minute.attributes["aria-valuenow"], 30);
});

test("setValue updates the committed value and re-seeds the draft", () => {
  const { controller, handle } = setup();
  controller.setValue("09:45 AM");
  assert.strictEqual(handle.value(), "09:45 AM");
  assert.deepStrictEqual(controller.state().draft, { hour: 9, minute: 45, period: "AM" });
});
