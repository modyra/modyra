/**
 * A picker that offers only some times, through the controller that owns the draft.
 *
 * The contract layer decides what is offered; these ask whether every route into the value actually
 * goes through it. Four routes exist — the number fields, the arrows, the face and a dragged pointer
 * — and a rule enforced on three of them is a rule a user reaches round.
 */
import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createTimepickerFieldController } from "../dist/field/index.js";

function setup(overrides = {}) {
  const rx = vanillaReactivity();
  const value = rx.signal(overrides.initialValue ?? null);
  const errors = rx.signal([]);
  const flag = () => rx.signal(false);
  const disabled = flag();
  const readonly = flag();
  const handle = {
    path: "time",
    value,
    errors,
    touched: flag(),
    dirty: flag(),
    valid: rx.computed(() => errors().length === 0),
    pending: flag(),
    required: flag(),
    disabled,
    readonly,
    interactivity: rx.computed(() => (disabled() ? "disabled" : readonly() ? "readonly" : "enabled")),
    set(v) { value.set(v); },
    markAsTouched() {},
    markAsDirty() {},
  };
  const controller = createTimepickerFieldController({ widgetId: "time", handle, ...overrides }, rx);
  return { controller, handle };
}

const QUARTERS = { minuteStep: 15 };

/** The minute the draft is holding. */
const minuteOf = (controller) => controller.state().draft.minute;

test("a minute the field does not offer cannot be set by the number fields", () => {
  const { controller } = setup({ format: "24h", initialValue: "09:00", granularity: QUARTERS });
  const refused = controller.dispatch({ type: "set-minute", minute: 7 });
  // Refused out loud: a control that ignored it would leave a field looking as though it took the
  // value, which is the failure `acceptTimeField` was written to end.
  assert.ok(refused.some((command) => command.type === "announce"), JSON.stringify(refused));
  assert.strictEqual(minuteOf(controller), 0);

  controller.dispatch({ type: "set-minute", minute: 30 });
  assert.strictEqual(minuteOf(controller), 30);
});

test("a minute the field does not offer cannot be reached by dragging either", () => {
  const { controller } = setup({ format: "24h", initialValue: "09:00", granularity: QUARTERS });
  // 42° is nearest the 7-minute mark on a face that offers every minute. On this one there is no
  // 7 to land on, and the drag has to answer with something the face actually drew.
  controller.dispatch({ type: "set-from-angle", field: "minute", angle: 42 });
  assert.ok([0, 15].includes(minuteOf(controller)), `landed on ${minuteOf(controller)}`);

  // Every angle of the circle, so nothing between the offered minutes is reachable by pointer.
  const landed = new Set();
  for (let angle = 0; angle < 360; angle += 3) {
    controller.dispatch({ type: "set-from-angle", field: "minute", angle });
    landed.add(minuteOf(controller));
  }
  assert.deepStrictEqual([...landed].sort((a, b) => a - b), [0, 15, 30, 45]);
});

test("an hour the field does not offer is refused, on both rings of a 24-hour face", () => {
  const { controller } = setup({ format: "24h", initialValue: "09:00", granularity: { hourStep: 6 } });
  const hours = new Set();
  for (const ring of ["outer", "inner"]) {
    for (let angle = 0; angle < 360; angle += 3) {
      controller.dispatch({ type: "set-from-angle", field: "hour", angle, ring });
      const { hour, period } = controller.state().draft;
      hours.add((hour % 12) + (period === "PM" ? 12 : 0));
    }
  }
  assert.deepStrictEqual([...hours].sort((a, b) => a - b), [0, 6, 12, 18]);
});

test("a window's step follows the hour the draft is on", () => {
  const granularity = {
    minuteStep: 30,
    windows: [{ from: "09:00", to: "12:00", minuteStep: 5 }],
  };
  const { controller } = setup({ format: "24h", initialValue: "09:00", granularity });

  // Inside the window, five-minute minutes are offered.
  controller.dispatch({ type: "set-minute", minute: 5 });
  assert.strictEqual(minuteOf(controller), 5);

  // Move the hour out of the window and the same minute is no longer on offer — the step is read
  // per intent, so it answers for the hour the draft is on rather than the one it opened at.
  controller.dispatch({ type: "set-hour", hour: 14 });
  controller.dispatch({ type: "set-minute", minute: 5 });
  assert.strictEqual(minuteOf(controller), 5, "the value it already held is kept, never rounded");

  controller.dispatch({ type: "set-minute", minute: 30 });
  assert.strictEqual(minuteOf(controller), 30);
});

test("a value that arrives off the step is shown as it is, not rounded to fit", () => {
  // ADR 0063. A time chosen before the rule changed, or sent by a server that does not share it,
  // is what the user is looking at — silently moving it answers a question nobody asked.
  const { controller } = setup({ format: "24h", initialValue: "09:07", granularity: QUARTERS });
  assert.strictEqual(minuteOf(controller), 7);
  assert.strictEqual(controller.state().value, "09:07");
});

test("no granularity leaves every route exactly as it was", () => {
  const { controller } = setup({ format: "24h", initialValue: "09:00" });
  controller.dispatch({ type: "set-minute", minute: 7 });
  assert.strictEqual(minuteOf(controller), 7);
  controller.dispatch({ type: "set-from-angle", field: "minute", angle: 42 });
  assert.strictEqual(minuteOf(controller), 7, "42° is the 7-minute mark on a face offering all of them");
});
