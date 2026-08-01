/**
 * Timepicker field controller conformance tests. Modeled on Angular's real
 * MdyTimepickerComponent/MdyTimepickerClockComponent semantics — see
 * timepicker-field-controller.ts's own doc comment.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createTimepickerFieldController } from "../dist/field/index.js";
import { MDY_VALUE_CONTRACTS } from "../../core/dist/index.js";

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
  const readonly = rx.signal(false);
  // Derived exactly as the engine derives it, so a stand-in handle cannot describe a state the
  // real one can never be in.
  const interactivity = rx.computed(() =>
    disabled() ? "disabled" : readonly() ? "readonly" : "enabled");

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

/* ── The face keeps the format's formalism ────────────────────────────────────────────────────
 * A twelve-hour clock offers twelve hours and a period beside them; a twenty-four hour clock offers
 * twenty-four and no period at all. The face used to answer 1–12 whatever the format, so 14:00 was
 * a value a 24-hour picker held and could not be pointed at.
 */

test("a 12-hour face offers twelve hours, and only twelve", async () => {
  const { timepickerDialNumbers } = await import("../dist/index.js");
  const hours = timepickerDialNumbers("hour", "12h");
  assert.equal(hours.length, 12);
  assert.deepEqual([...hours].map((n) => n.value).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(hours.every((n) => n.ring === "outer"), "a twelve-hour face has one ring");
});

test("a 24-hour face offers all twenty-four, on two rings", async () => {
  const { timepickerDialNumbers } = await import("../dist/index.js");
  const hours = timepickerDialNumbers("hour", "24h");
  assert.equal(hours.length, 24);
  const values = [...hours].map((n) => n.value).sort((a, b) => a - b);
  assert.deepEqual(values, Array.from({ length: 24 }, (_, i) => i));
  // Twelve positions on a face; the second twelve go inside, which is what a clock has always done.
  assert.equal(hours.filter((n) => n.ring === "outer").length, 12);
  assert.equal(hours.filter((n) => n.ring === "inner").length, 12);
  // Every position is used exactly twice — once per ring — so no number lands on top of another.
  for (const ring of ["outer", "inner"]) {
    const indexes = hours.filter((n) => n.ring === ring).map((n) => n.index).sort((a, b) => a - b);
    assert.deepEqual(indexes, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], `${ring} ring`);
  }
  // Midnight is named `00` and sits at the top, where 12 sits outside.
  const midnight = hours.find((n) => n.value === 0);
  assert.equal(midnight.label, "00");
  assert.equal(midnight.index, 12);
});

test("the default is the twelve-hour face, so nothing that never asked has changed", async () => {
  const { timepickerDialNumbers } = await import("../dist/index.js");
  assert.deepEqual(timepickerDialNumbers("hour"), timepickerDialNumbers("hour", "12h"));
  assert.equal(timepickerDialNumbers("minute").length, 12);
});

/* ── The keyboard on the face ─────────────────────────────────────────────────────────────────
 * The dial listened for `mousedown` and `touchstart` and nothing else. Everything on it was
 * reachable only by dragging a hand around a circle.
 */

test("the arrows turn the hand, and the hand turns clockwise", async () => {
  const { timepickerDialKeyIntent } = await import("../dist/index.js");
  assert.deepEqual(timepickerDialKeyIntent("ArrowRight", "hour", "12h", 3), { field: "hour", value: 4 });
  assert.deepEqual(timepickerDialKeyIntent("ArrowUp", "hour", "12h", 3), { field: "hour", value: 4 });
  assert.deepEqual(timepickerDialKeyIntent("ArrowLeft", "hour", "12h", 3), { field: "hour", value: 2 });
  assert.deepEqual(timepickerDialKeyIntent("ArrowDown", "hour", "12h", 3), { field: "hour", value: 2 });
});

test("a clock is a ring, so the ends wrap rather than stop", async () => {
  const { timepickerDialKeyIntent } = await import("../dist/index.js");
  // 12h: after 12 comes 1, and before 1 comes 12. There is no hour zero on this face.
  assert.equal(timepickerDialKeyIntent("ArrowRight", "hour", "12h", 12).value, 1);
  assert.equal(timepickerDialKeyIntent("ArrowLeft", "hour", "12h", 1).value, 12);
  // 24h: after 23 comes 00, which is the hour this face names.
  assert.equal(timepickerDialKeyIntent("ArrowRight", "hour", "24h", 23).value, 0);
  assert.equal(timepickerDialKeyIntent("ArrowLeft", "hour", "24h", 0).value, 23);
  // Minutes run 0–59 either way.
  assert.equal(timepickerDialKeyIntent("ArrowRight", "minute", "12h", 59).value, 0);
  assert.equal(timepickerDialKeyIntent("ArrowLeft", "minute", "24h", 0).value, 59);
});

test("no key produces an hour the format does not have", async () => {
  const { timepickerDialKeyIntent } = await import("../dist/index.js");
  const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];
  for (const key of keys) {
    for (let hour = 1; hour <= 12; hour += 1) {
      const twelve = timepickerDialKeyIntent(key, "hour", "12h", hour).value;
      assert.ok(twelve >= 1 && twelve <= 12, `${key} from ${hour} gave ${twelve} on a 12-hour face`);
    }
    for (let hour = 0; hour <= 23; hour += 1) {
      const twentyFour = timepickerDialKeyIntent(key, "hour", "24h", hour).value;
      assert.ok(twentyFour >= 0 && twentyFour <= 23, `${key} from ${hour} gave ${twentyFour} on a 24-hour face`);
    }
    for (const minute of [0, 7, 30, 59]) {
      const value = timepickerDialKeyIntent(key, "minute", "12h", minute).value;
      assert.ok(value >= 0 && value <= 59, `${key} from ${minute} gave ${value}`);
    }
  }
});

test("Home and End are the ends of the face the format shows", async () => {
  const { timepickerDialKeyIntent } = await import("../dist/index.js");
  assert.equal(timepickerDialKeyIntent("Home", "hour", "12h", 5).value, 1);
  assert.equal(timepickerDialKeyIntent("End", "hour", "12h", 5).value, 12);
  assert.equal(timepickerDialKeyIntent("Home", "hour", "24h", 5).value, 0);
  assert.equal(timepickerDialKeyIntent("End", "hour", "24h", 5).value, 23);
  assert.equal(timepickerDialKeyIntent("End", "minute", "12h", 5).value, 59);
});

test("a page turns a quarter of the face for minutes, and three hours for hours", async () => {
  const { timepickerDialKeyIntent } = await import("../dist/index.js");
  assert.equal(timepickerDialKeyIntent("PageUp", "minute", "12h", 10).value, 15);
  assert.equal(timepickerDialKeyIntent("PageDown", "minute", "12h", 2).value, 57);
  assert.equal(timepickerDialKeyIntent("PageUp", "hour", "24h", 22).value, 1);
});

test("a key the dial does not claim is left alone", async () => {
  const { timepickerDialKeyIntent } = await import("../dist/index.js");
  for (const key of ["Enter", "Escape", "Tab", " ", "a"]) {
    assert.equal(timepickerDialKeyIntent(key, "hour", "12h", 3), null, key);
  }
});

test("what a screen reader is told matches what the arrows can reach", async () => {
  const { timepickerDialAria, timepickerDialKeyIntent } = await import("../dist/index.js");
  for (const format of ["12h", "24h"]) {
    for (const field of ["hour", "minute"]) {
      const aria = timepickerDialAria(field, format, field === "minute" ? 30 : format === "24h" ? 14 : 5);
      assert.equal(aria.role, "slider");
      // The announced bounds are the bounds Home and End land on — one rule, not two.
      assert.equal(aria.valueMin, timepickerDialKeyIntent("Home", field, format, 5).value, `${format}/${field} min`);
      assert.equal(aria.valueMax, timepickerDialKeyIntent("End", field, format, 5).value, `${format}/${field} max`);
      assert.ok(aria.valueText.length > 0);
    }
  }
});

test("the mark lands on the number the face shows, not the one the draft holds", async () => {
  const { timepickerDialNumbers, timepickerSelectedDialValue } = await import("../dist/index.js");
  // 14:00 — the draft holds it as 2 PM whatever the format, because that is the canonical model.
  const afternoon = { hour: 2, minute: 0, period: "PM" };

  assert.equal(timepickerSelectedDialValue("hour", afternoon, "12h"), 2);
  assert.equal(timepickerSelectedDialValue("hour", afternoon, "24h"), 14);
  // Whatever it answers must be a number actually on that face, or it marks nothing.
  for (const format of ["12h", "24h"]) {
    const marked = timepickerSelectedDialValue("hour", afternoon, format);
    const values = timepickerDialNumbers("hour", format).map((n) => n.value);
    assert.ok(values.includes(marked), `${format}: ${marked} is not on the face`);
  }

  // Midnight is 12 AM in the draft and 00 on a 24-hour face — the case an off-by-twelve hides in.
  const midnight = { hour: 12, minute: 0, period: "AM" };
  assert.equal(timepickerSelectedDialValue("hour", midnight, "12h"), 12);
  assert.equal(timepickerSelectedDialValue("hour", midnight, "24h"), 0);
  // And noon, which converts the other way.
  assert.equal(timepickerSelectedDialValue("hour", { hour: 12, minute: 0, period: "PM" }, "24h"), 12);

  // Minutes are the same on either face, and still snap to the fives the face is marked in.
  assert.equal(timepickerSelectedDialValue("minute", { hour: 2, minute: 7, period: "PM" }, "24h"), 5);
  assert.equal(timepickerSelectedDialValue("minute", { hour: 2, minute: 58, period: "PM" }, "12h"), 0);

  // Every hour of the day marks a number that exists on the face it is shown on.
  for (let hour24 = 0; hour24 < 24; hour24 += 1) {
    const draft = {
      hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
      minute: 0,
      period: hour24 >= 12 ? "PM" : "AM",
    };
    const marked = timepickerSelectedDialValue("hour", draft, "24h");
    assert.equal(marked, hour24, `draft for ${hour24} marked ${marked}`);
  }
});

test("asking without a format is the twelve-hour answer, as it always was", async () => {
  const { timepickerSelectedDialValue } = await import("../dist/index.js");
  const draft = { hour: 2, minute: 0, period: "PM" };
  assert.equal(timepickerSelectedDialValue("hour", draft), 2);
});

/* ── The declared commit mode ───────────────────────────────────────────────────
 * `MDY_VALUE_CONTRACTS` says this kind commits on confirmation rather than live. A declaration
 * nothing checks is documentation, and this is the check: the difference between the two modes is
 * observable on the handle, so it can be asserted rather than described.
 */
test("a confirm-mode kind writes nothing to the field until it is confirmed", () => {
  assert.strictEqual(MDY_VALUE_CONTRACTS.timepicker.commit, "confirm");

  const { controller, handle } = setup({ initialValue: "10:30 AM" });
  const before = handle.value();

  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 4 });
  controller.dispatch({ type: "set-minute", minute: 15 });
  controller.dispatch({ type: "set-period", period: "PM" });

  // The dial has moved and the field has not.
  assert.strictEqual(controller.state().draft.hour, 4);
  assert.strictEqual(handle.value(), before, "the draft reached the field before it was confirmed");

  controller.dispatch({ type: "confirm" });
  assert.notStrictEqual(handle.value(), before, "confirming wrote nothing");
});

test("cancelling a confirm-mode kind leaves the field as it found it", () => {
  const { controller, handle } = setup({ initialValue: "10:30 AM" });
  const before = handle.value();

  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 4 });
  controller.dispatch({ type: "cancel" });

  assert.strictEqual(handle.value(), before);
});
