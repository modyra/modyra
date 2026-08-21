/**
 * Timepicker field controller conformance tests.
 *
 * Editing is draft/commit: the dial moves a working copy and nothing reaches the field until
 * `"confirm"`. See timepicker-field-controller.ts for the behaviour these assert.
 */

import { dialHour } from "@modyra/core/datetime";
import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import {
  createTimepickerFieldController,
  MDY_TIMEPICKER_INNER_RING,
  timepickerDialRing,
} from "../dist/field/index.js";
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

  // `3` on a 24-hour clock is three in the morning. It used to mean "the third hour of whichever
  // half the draft was already in", which is what left a 24-hour picker unable to leave the half it
  // opened on: there was no other word for the afternoon, because a 24-hour picker has no period
  // control and `set-hour` refused 13–23 outright.
  controller.dispatch({ type: "set-hour", hour: 3 });
  controller.dispatch({ type: "confirm" });
  assert.strictEqual(handle.value(), "03:30");

  // And the draft is still held 1–12 with a period, which is what "canonical 12h" means: the
  // conversion happens at this seam rather than in each renderer.
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-hour", hour: 15 });
  assert.deepStrictEqual(controller.state().draft, { hour: 3, minute: 30, period: "PM" });
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
  // Canonical: `HH:mm` is what a time is wherever it is held, whatever this field shows.
  assert.strictEqual(handle.value(), "19:30");
  assert.strictEqual(controller.state().display, "07:30 PM");
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

test("the dial's two rings name two different hours from one direction", () => {
  // `dialHour` and `timepickerDialRing` are the arithmetic and the hit test behind a 24-hour face:
  // twelve positions, twenty-four numbers, and the same direction meaning 3 outside and 15 inside.
  // Without the ring, half the numbers the face draws had no way to be asked for.
  assert.equal(dialHour(90, "outer"), 3);
  assert.equal(dialHour(90, "inner"), 15);
  assert.equal(dialHour(0, "outer"), 12, "noon sits at the top of the outer ring");
  assert.equal(dialHour(0, "inner"), 0, "and midnight at the top of the inner one");

  // The geometry the stylesheet lays out: a 256px dial, 40px numbers, so the hand — the radius the
  // outer digits sit at — is 128 − 20 − 8 = 100, and the inner digits sit at 0.6 of it.
  const face = { left: 0, top: 0, width: 256, height: 256 };
  const HAND = 100;
  const at = (radius, degrees) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [128 + Math.cos(radians) * radius, 128 + Math.sin(radians) * radius];
  };
  // Each ring claims a band around the digits actually drawn on it.
  assert.equal(timepickerDialRing(face, ...at(HAND, 90), "24h", HAND), "outer", "the outer digits are on the outer ring");
  assert.equal(timepickerDialRing(face, ...at(127, 90), "24h", HAND), "outer", "and so is the rim beyond them");
  assert.equal(timepickerDialRing(face, ...at(HAND * MDY_TIMEPICKER_INNER_RING, 90), "24h", HAND), "inner");
  // The middle of the face belongs to the inner ring: it is the nearest thing to it, and there is no
  // other ring further in to claim it. The boundary sits below the outer digits rather than at the
  // midpoint, so a press aimed at the 9 does not answer 21.
  assert.equal(timepickerDialRing(face, ...at(10, 90), "24h", HAND), "inner", "the centre is nearest the inner ring");
  // The two digit boxes touch at 80 — 40px wide, drawn 40px apart — so that meeting point is the
  // edge, and a press either side of it belongs to the digit whose box it is in.
  assert.equal(timepickerDialRing(face, ...at(80, 90), "24h", HAND), "inner", "inside the 21's box");
  assert.equal(timepickerDialRing(face, ...at(81, 90), "24h", HAND), "outer", "inside the 9's");
  // A 12-hour face has one ring wherever the finger lands, and so does a minute face.
  assert.equal(timepickerDialRing(face, ...at(60, 90), "12h", HAND), "outer");
  assert.equal(timepickerDialRing(face, ...at(60, 90), "24h", HAND, "minute"), "outer", "minutes are drawn at one radius");
});

test("a 24-hour picker takes every hour its own face shows", () => {
  // The seam the twelve inner numbers had no word for. A 24-hour face draws `00` and 13–23, and
  // every other surface of the picker speaks 0–23 — the segment bounds, what a typed entry is
  // accepted as, what the End key asks for — while the one that writes took 1–12 and refused the
  // rest in silence. So a 24-hour picker could not be moved off the half of the day it opened on.
  for (const [asked, expected] of [[0, { hour: 12, period: "AM" }], [9, { hour: 9, period: "AM" }],
    [12, { hour: 12, period: "PM" }], [13, { hour: 1, period: "PM" }], [23, { hour: 11, period: "PM" }]]) {
    const { controller } = setup({ initialValue: "21:00", format: "24h" });
    controller.dispatch({ type: "open" });
    controller.dispatch({ type: "set-hour", hour: asked });
    assert.deepStrictEqual(
      controller.state().draft,
      { ...expected, minute: 0 },
      `a 24-hour picker refused ${asked}, an hour its own face draws`,
    );
  }
});

test("an hour no clock has is refused, and the refusal is said out loud", () => {
  // `return []` was the whole of what happened, and that silence is why the seam above survived:
  // nothing failed, nothing was reported, and the draft simply did not move.
  const { controller } = setup({ initialValue: "21:00", format: "24h" });
  controller.dispatch({ type: "open" });
  const commands = controller.dispatch({ type: "set-hour", hour: 24 });
  assert.deepStrictEqual(controller.state().draft, { hour: 9, minute: 0, period: "PM" });
  assert.equal(commands.length, 1, "an hour this clock does not have was refused in silence");
  assert.equal(commands[0].type, "announce");
});

test("the popup opens on the view the host configured, and returns to it", () => {
  const { controller } = setup({ initialValue: "02:30 PM" });
  controller.dispatch({ type: "open" });
  // The face is the default: it is the faster route to an approximate time and the only gesture
  // where there is no keyboard. It was two answers across three renderers before it was declared.
  assert.equal(controller.state().viewMode, "dial", "the clock is the default view");
  controller.dispatch({ type: "set-view-mode", mode: "input" });
  assert.equal(controller.state().viewMode, "input", "the number fields are one press away");
  controller.dispatch({ type: "close" });
  controller.dispatch({ type: "open" });
  assert.equal(controller.state().viewMode, "dial", "where the last session left it is not where the next resumes");

  const onInput = setup({ initialValue: "02:30 PM", viewMode: "input" });
  onInput.controller.dispatch({ type: "open" });
  assert.equal(onInput.controller.state().viewMode, "input", "a host that asks for the boxes gets them");
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

  // The spinbutton is the control inside the segment, not the segment: the value and the name are
  // reachable only on the element a user operates.
  assert.strictEqual(view.parts.hourControl.attributes.role, "spinbutton");
  assert.strictEqual(view.parts.hourControl.attributes["aria-valuenow"], 2);
  assert.strictEqual(view.parts.minuteControl.attributes["aria-valuenow"], 30);

  // And the segment carries neither — it is the container the state is painted on.
  assert.deepStrictEqual(view.parts.hour.attributes, {});
  assert.deepStrictEqual(view.parts.minute.attributes, {});
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
