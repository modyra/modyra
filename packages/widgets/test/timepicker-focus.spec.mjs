/**
 * Where focus is in an open picker, and what moves it.
 *
 * The severe one first: `Tab` was declared as `cancel` for every overlay kind, and a timepicker's
 * popup has a confirm button in it. So opening the picker, typing an hour and pressing Tab to reach
 * the minutes closed it and threw the draft away — and since nothing else reached the confirm button,
 * the widget's only commit path was a pointer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MDY_TIMEPICKER_ADVANCE_MS,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KEYBOARD,
  timepickerFocusPart,
  timepickerTabOrder,
  timepickerTabTarget,
} from "../dist/index.js";

test("Tab moves within a popup that has its own controls, and dismisses one that does not", () => {
  const tabOf = (kind) => MDY_WIDGET_KEYBOARD[kind].filter((b) => b.key === "Tab" && b.when === "open");
  assert.deepEqual(tabOf("timepicker"), [{ key: "Tab", when: "open", intent: "move" }]);
  // A list is one composite control: Tab leaving it is the combobox pattern and stays.
  for (const kind of ["select", "multiselect", "datepicker", "daterange", "colors"]) {
    assert.deepEqual(tabOf(kind), [{ key: "Tab", when: "open", intent: "cancel", restoresFocus: false }], kind);
  }
});

test("the question is asked of the catalogue, not of a list beside it", () => {
  // A kind that grows an action bar grows this with it. `timepicker` is the only overlay declaring
  // one today, and if that changes the binding follows without an edit here.
  const withActions = Object.entries(MDY_WIDGET_CONTRACTS)
    .filter(([, c]) => c.capabilities?.overlay && "actions" in c.parts)
    .map(([kind]) => kind);
  assert.deepEqual(withActions, ["timepicker"]);
});

test("Escape still cancels, and still takes focus back", () => {
  // The two dismissals differ and both are needed: Tab is now movement inside the dialog, so Escape
  // is the only way out — and a keyboard user who cannot leave is worse off than one who cannot commit.
  const escape = MDY_WIDGET_KEYBOARD.timepicker.find((b) => b.key === "Escape" && b.when === "open");
  assert.deepEqual(escape, { key: "Escape", when: "open", intent: "cancel", restoresFocus: true });
});

test("each field names the control that carries its focus", () => {
  assert.equal(timepickerFocusPart("hour"), "hourControl");
  assert.equal(timepickerFocusPart("minute"), "minuteControl");
  // And both are parts the catalogue has, so a renderer can find them without a selector of its own.
  for (const part of ["hourControl", "minuteControl"]) {
    assert.ok(part in MDY_WIDGET_CONTRACTS.timepicker.parts, part);
  }
});

test("the tab order is the contract's, and a 24-hour picker has no period to reach", () => {
  assert.deepEqual(timepickerTabOrder("12h"), ["hourControl", "minuteControl", "periodOption", "modeToggle", "action", "action--confirm"]);
  assert.deepEqual(timepickerTabOrder("24h"), ["hourControl", "minuteControl", "modeToggle", "action", "action--confirm"]);
});

test("Tab wraps at both ends, because the popup is a dialog", () => {
  // A picker whose Tab walked out of it left a confirm button behind and a draft nobody could commit.
  assert.equal(timepickerTabTarget("hourControl", "24h"), "minuteControl");
  // Both actions, because `action` names two buttons: a stop that named the part reached whichever
  // was drawn first — cancel — so tabbing to the end and pressing Enter discarded the draft.
  assert.equal(timepickerTabTarget("action", "24h"), "action--confirm");
  assert.equal(timepickerTabTarget("action--confirm", "24h"), "hourControl", "the last returns to the first");
  assert.equal(timepickerTabTarget("hourControl", "24h", -1), "action--confirm", "and Shift+Tab the other way");
  assert.equal(timepickerTabTarget("minuteControl", "12h"), "periodOption");
  assert.equal(timepickerTabTarget("minuteControl", "24h"), "modeToggle", "which a 24-hour picker skips");
});

test("a press that arrives before focus was placed starts at an end", () => {
  assert.equal(timepickerTabTarget("nowhere", "24h"), "hourControl");
  assert.equal(timepickerTabTarget("nowhere", "24h", -1), "action--confirm");
});

test("the dial's handover has one declared timing", () => {
  // It was 0 in one renderer, 200 and 300 in another, 300 in the third — three answers to a question
  // about how long a person needs to see the number they just chose.
  assert.equal(typeof MDY_TIMEPICKER_ADVANCE_MS, "number");
  assert.ok(MDY_TIMEPICKER_ADVANCE_MS > 0 && MDY_TIMEPICKER_ADVANCE_MS < 1000);
});

// ─── the handover, on a clock the test holds ─────────────────────────────────

const { createTimepickerFieldController, vanillaReactivity } = await import("../dist/index.js").then(
  async (w) => ({ ...w, ...(await import("../../core/dist/index.js")) }));

/** A controller whose waiting the test decides, with the pending runs it is holding. */
function pickerWithClock(overrides = {}) {
  const rx = vanillaReactivity();
  const flag = () => rx.signal(false);
  const value = rx.signal(overrides.initialValue ?? "09:00");
  const disabled = flag();
  const readonly = flag();
  const handle = {
    path: "t", value, errors: rx.signal([]), touched: flag(), dirty: flag(),
    valid: rx.computed(() => true), pending: flag(), required: flag(), disabled, readonly,
    interactivity: rx.computed(() => (disabled() ? "disabled" : readonly() ? "readonly" : "enabled")),
    set: (v) => value.set(v), markAsTouched() {}, markAsDirty() {},
  };
  const pending = [];
  const controller = createTimepickerFieldController({
    widgetId: "t", handle, format: "24h", ...overrides,
    schedule: (run, afterMs) => {
      const entry = { run, afterMs, cancelled: false };
      pending.push(entry);
      return () => { entry.cancelled = true; };
    },
  }, rx);
  return {
    controller,
    /** Runs every timer the controller is still waiting on. */
    tick() { for (const entry of pending.splice(0)) if (!entry.cancelled) entry.run(); },
    waitingFor: () => pending.filter((e) => !e.cancelled).map((e) => e.afterMs),
  };
}

test("opening the picker asks for focus on the hour box", () => {
  // The one upstream of everything else: without it a keyboard reached the opener and stopped, and
  // the key recorded as closing the popup never arrived because focus was never in the thing that
  // listens for it.
  const { controller } = pickerWithClock();
  const commands = controller.dispatch({ type: "open" });
  assert.deepEqual(
    commands.filter((c) => c.type === "focus"),
    [{ type: "focus", target: { part: "hourControl" } }],
  );
});

test("the dial holds the hour for the declared moment, then hands it to the minute", () => {
  // Both sides, so a handover that never happens and one that happens instantly both fail.
  const { controller, tick, waitingFor } = pickerWithClock();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-from-angle", field: "hour", angle: 90 });

  assert.equal(controller.state().focusedField, "hour", "still the hour, immediately after the press");
  assert.deepEqual(waitingFor(), [MDY_TIMEPICKER_ADVANCE_MS], "and it is waiting the declared time");

  tick();
  assert.equal(controller.state().focusedField, "minute");
});

test("a minute chosen on the face hands over to nothing", () => {
  const { controller, waitingFor } = pickerWithClock();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "focus-field", field: "minute" });
  controller.dispatch({ type: "set-from-angle", field: "minute", angle: 90 });
  assert.deepEqual(waitingFor(), [], "there is no third field to advance to");
});

test("asking for a field by name moves focus with it, and cancels a handover in flight", () => {
  const { controller, tick, waitingFor } = pickerWithClock();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-from-angle", field: "hour", angle: 90 });

  // The user reached for the hour box again before the face handed over. The pending advance must
  // not arrive afterwards and take them somewhere they did not ask to be.
  const commands = controller.dispatch({ type: "focus-field", field: "hour" });
  assert.deepEqual(commands, [{ type: "focus", target: { part: "hourControl" } }]);
  assert.deepEqual(waitingFor(), [], "the handover was cancelled, not merely superseded");
  tick();
  assert.equal(controller.state().focusedField, "hour");
});

test("a picker torn down mid-handover leaves nothing to arrive", () => {
  const { controller, tick, waitingFor } = pickerWithClock();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-from-angle", field: "hour", angle: 90 });
  controller.destroy();
  assert.deepEqual(waitingFor(), []);
  tick();
});

test("a handover that arrives after the picker closed does nothing", () => {
  // The timer outlives the popup by design — cancelling on close would be a second place that knows
  // about it — so the arrival checks what it is arriving into.
  const { controller, tick } = pickerWithClock();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "set-from-angle", field: "hour", angle: 90 });
  controller.dispatch({ type: "cancel" });
  tick();
  assert.equal(controller.state().focusedField, "hour");
});

test("a selector reaches exactly one part, including the two that share a class", async () => {
  // `hourControl` and `minuteControl` carry the same class — they are the same kind of control twice
  // — so asked by class alone both resolve to the hour. A focus command naming the minute box put
  // focus on the hour, and a Tab that looked like it did nothing was in fact arriving somewhere.
  const { timepickerPartSelector } = await import("../dist/index.js");
  assert.notEqual(timepickerPartSelector("hourControl"), timepickerPartSelector("minuteControl"));
  assert.match(timepickerPartSelector("hourControl"), /--hour/);
  assert.match(timepickerPartSelector("minuteControl"), /--minute/);
  // Composed from the parent the anatomy already declares, rather than from a second table.
  for (const part of timepickerTabOrder("12h")) {
    assert.ok(timepickerPartSelector(part), part);
  }
  assert.equal(timepickerPartSelector("nowhere"), null);
});
