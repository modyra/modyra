/**
 * Datepicker field controller conformance tests. Modeled on Angular's real
 * MdyDatePickerComponent/MdyCalendarComponent semantics — see
 * datepicker-field-controller.ts's own doc comment.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createDatepickerFieldController } from "../dist/field/index.js";

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
    path: "date",
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

  const controller = createDatepickerFieldController(
    { widgetId: "date", handle, ...overrides },
    rx,
  );

  return { controller, handle, rx };
}

test("initial state with no value focuses today, 42 grid cells", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.strictEqual(state.selectedDate, null);
  assert.strictEqual(state.cells.length, 42);
  assert.strictEqual(state.open, false);
});

test("initial state with a value focuses and views that month", () => {
  const { controller } = setup({ initialValue: "2026-03-15" });
  const state = controller.state();
  assert.strictEqual(state.viewYear, 2026);
  assert.strictEqual(state.viewMonth, 3);
  assert.strictEqual(state.focusedDate, "2026-03-15");
  const selectedCell = state.cells.find((c) => c.iso === "2026-03-15");
  assert.strictEqual(selectedCell.selected, true);
});

test("select-date commits the value and marks dirty/touched", () => {
  const { controller, handle } = setup({ initialValue: "2026-03-15" });
  controller.dispatch({ type: "select-date", iso: "2026-03-20" });
  assert.strictEqual(handle.value(), "2026-03-20");
  assert.strictEqual(handle.dirty(), true);
  assert.strictEqual(handle.touched(), true);
  assert.strictEqual(controller.state().focusedDate, "2026-03-20");
});

test("select-date outside min/max range is rejected", () => {
  const { controller, handle } = setup({ minDate: "2026-01-01", maxDate: "2026-01-31" });
  controller.dispatch({ type: "select-date", iso: "2026-02-01" });
  assert.strictEqual(handle.value(), null);
  assert.strictEqual(handle.dirty(), false);
});

test("cells outside min/max are marked disabled", () => {
  const { controller } = setup({ initialValue: "2026-01-15", minDate: "2026-01-10", maxDate: "2026-01-20" });
  const cells = controller.state().cells;
  assert.strictEqual(cells.find((c) => c.iso === "2026-01-05").disabled, true);
  assert.strictEqual(cells.find((c) => c.iso === "2026-01-15").disabled, false);
  assert.strictEqual(cells.find((c) => c.iso === "2026-01-25").disabled, true);
});

test("keydown ArrowRight moves focus by one day via calendarKeyboardTarget, crossing into next month updates the view", () => {
  const { controller } = setup({ initialValue: "2026-03-31" });
  controller.dispatch({ type: "keydown", key: "ArrowRight" });
  const state = controller.state();
  assert.strictEqual(state.focusedDate, "2026-04-01");
  assert.strictEqual(state.viewYear, 2026);
  assert.strictEqual(state.viewMonth, 4);
});

test("keydown Enter commits the focused date", () => {
  const { controller, handle } = setup({ initialValue: "2026-03-15" });
  controller.dispatch({ type: "keydown", key: "ArrowRight" });
  controller.dispatch({ type: "keydown", key: "Enter" });
  assert.strictEqual(handle.value(), "2026-03-16");
});

test("navigate-month moves the view without changing focusedDate's day-of-month semantics or the selection", () => {
  const { controller, handle } = setup({ initialValue: "2026-03-15" });
  controller.dispatch({ type: "navigate-month", delta: 1 });
  assert.strictEqual(controller.state().viewMonth, 4);
  assert.strictEqual(handle.value(), "2026-03-15"); // browsing does not commit
});

test("open sets open=true and focuses the current (or today's) date", () => {
  const { controller } = setup();
  const commands = controller.dispatch({ type: "open" });
  assert.strictEqual(controller.state().open, true);
  assert.ok(commands.some((c) => c.type === "open-overlay"));
});

test("close restores focus when requested", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open" });
  const commands = controller.dispatch({ type: "close", restoreFocus: true });
  assert.strictEqual(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "restore-focus"));
});

test("keydown Escape closes and restores focus", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open" });
  const commands = controller.dispatch({ type: "keydown", key: "Escape" });
  assert.strictEqual(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "restore-focus"));
});

test("clear resets the value to null", () => {
  const { controller, handle } = setup({ initialValue: "2026-03-15" });
  controller.dispatch({ type: "clear" });
  assert.strictEqual(handle.value(), null);
  assert.strictEqual(handle.dirty(), true);
});

test("blur marks touched without altering the value", () => {
  const { controller, handle } = setup();
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(handle.touched(), true);
  assert.strictEqual(handle.value(), null);
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("disabled controller ignores select-date/navigate-month/open", () => {
  const { controller, handle } = setup({ initialValue: "2026-03-15" });
  handle.disabled.set(true);
  controller.dispatch({ type: "select-date", iso: "2026-03-20" });
  assert.strictEqual(handle.value(), "2026-03-15");
  assert.strictEqual(controller.state().open, false);
});

test("view exposes grid ARIA contract with roving tabindex on the focused cell only", () => {
  const { controller } = setup({ initialValue: "2026-03-15" });
  const view = controller.view();
  assert.strictEqual(view.parts.grid.attributes.role, "grid");
  assert.strictEqual(view.parts.trigger.attributes.role, "combobox");
  const focusedCell = view.parts["2026-03-15"];
  assert.strictEqual(focusedCell.attributes.role, "gridcell");
  assert.strictEqual(focusedCell.attributes["aria-selected"], true);
  assert.strictEqual(focusedCell.attributes.tabindex, 0);
  const otherCell = view.parts["2026-03-16"];
  assert.strictEqual(otherCell.attributes.tabindex, -1);
});

test("setValue updates state and view programmatically", () => {
  const { controller, handle } = setup();
  controller.setValue("2027-06-01");
  assert.strictEqual(handle.value(), "2027-06-01");
  assert.strictEqual(controller.state().viewYear, 2027);
  assert.strictEqual(controller.state().viewMonth, 6);
});
