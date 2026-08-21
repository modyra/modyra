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
  assert.deepEqual(timepickerTabOrder("12h"), ["hourControl", "minuteControl", "periodOption", "modeToggle", "action"]);
  assert.deepEqual(timepickerTabOrder("24h"), ["hourControl", "minuteControl", "modeToggle", "action"]);
});

test("Tab wraps at both ends, because the popup is a dialog", () => {
  // A picker whose Tab walked out of it left a confirm button behind and a draft nobody could commit.
  assert.equal(timepickerTabTarget("hourControl", "24h"), "minuteControl");
  assert.equal(timepickerTabTarget("action", "24h"), "hourControl", "the last returns to the first");
  assert.equal(timepickerTabTarget("hourControl", "24h", -1), "action", "and Shift+Tab the other way");
  assert.equal(timepickerTabTarget("minuteControl", "12h"), "periodOption");
  assert.equal(timepickerTabTarget("minuteControl", "24h"), "modeToggle", "which a 24-hour picker skips");
});

test("a press that arrives before focus was placed starts at an end", () => {
  assert.equal(timepickerTabTarget("nowhere", "24h"), "hourControl");
  assert.equal(timepickerTabTarget("nowhere", "24h", -1), "action");
});

test("the dial's handover has one declared timing", () => {
  // It was 0 in one renderer, 200 and 300 in another, 300 in the third — three answers to a question
  // about how long a person needs to see the number they just chose.
  assert.equal(typeof MDY_TIMEPICKER_ADVANCE_MS, "number");
  assert.ok(MDY_TIMEPICKER_ADVANCE_MS > 0 && MDY_TIMEPICKER_ADVANCE_MS < 1000);
});
