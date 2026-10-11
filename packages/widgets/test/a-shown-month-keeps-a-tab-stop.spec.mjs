/**
 * Whatever month a calendar shows, its grid has a way in from the keyboard.
 *
 * The tab stop is the cell whose date is the focused date. Paging, choosing a month and choosing a
 * year change the shown month; when the focused date stays behind in a month that is no longer
 * shown, no cell carries it, and the grid is reachable only by pointer. So the focused date follows
 * the view: to the chosen day when it is in the shown month, otherwise to the same day of the month,
 * clamped to the month's length.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../../core/dist/index.js";
import { createDatepickerFieldController, createDaterangeFieldController } from "../dist/index.js";

const KINDS = [
  ["datepicker", (v) => createDatepickerFieldController({ handle: createForm({ value: field(v) }).f.value, widgetId: "w" })],
  [
    "daterange",
    (v) =>
      createDaterangeFieldController({
        handle: createForm({ value: field(v === null ? { start: null, end: null } : { start: v, end: v }) }).f.value,
        widgetId: "w",
      }),
  ],
];

/** The cells that take Tab, and that each one is in the month on screen. */
function tabStops(state) {
  const stops = state.cells.filter((c) => c.focused);
  for (const stop of stops) assert.equal(stop.inMonth, true, `tab stop ${stop.iso} is an outside day`);
  return stops.map((c) => c.iso);
}

const ACTS = [
  ["paging forward", (c) => c.dispatch({ type: "navigate-month", delta: 1 })],
  ["paging back", (c) => c.dispatch({ type: "navigate-month", delta: -1 })],
  ["choosing a month", (c) => c.dispatch({ type: "select-month", month: 2 })],
  ["choosing a year", (c) => c.dispatch({ type: "select-year", year: 2031 })],
  [
    "choosing a year, then a month",
    (c) => {
      c.dispatch({ type: "set-view-mode", mode: "years" });
      c.dispatch({ type: "select-year", year: 2031 });
      c.dispatch({ type: "select-month", month: 9 });
    },
  ],
];

for (const [kind, build] of KINDS) {
  for (const [label, act] of ACTS) {
    test(`${kind}: ${label} leaves exactly one tab stop, inside the shown month`, () => {
      const controller = build("2026-07-15");
      act(controller);
      const state = controller.state();
      assert.deepEqual(tabStops(state), [state.focusedDate]);
    });
  }

  test(`${kind}: the focused day keeps its number, clamped to a shorter month`, () => {
    const controller = build("2026-01-31");
    controller.dispatch({ type: "navigate-month", delta: 1 });
    assert.equal(controller.state().focusedDate, "2026-02-28");
    controller.dispatch({ type: "select-year", year: 2028 });
    assert.equal(controller.state().focusedDate, "2028-02-28", "the day carried is the one shown, not the one before");
    controller.dispatch({ type: "select-month", month: 4 });
    assert.equal(controller.state().focusedDate, "2028-04-28");
  });

  test(`${kind}: coming back to the chosen month lands on the chosen day`, () => {
    // A shorter month on the way clamps the carried day to 28, so only the chosen day can bring 31 back.
    const controller = build("2026-07-31");
    controller.dispatch({ type: "select-month", month: 2 });
    assert.equal(controller.state().focusedDate, "2026-02-28");
    controller.dispatch({ type: "select-year", year: 2030 });
    controller.dispatch({ type: "select-year", year: 2026 });
    controller.dispatch({ type: "select-month", month: 7 });
    assert.equal(controller.state().focusedDate, "2026-07-31");
  });

  test(`${kind}: following the view does not commit a value`, () => {
    const controller = build("2026-07-15");
    const before = JSON.stringify(controller.state().selectedDate ?? controller.state().value ?? null);
    for (const [, act] of ACTS) act(controller);
    assert.equal(JSON.stringify(controller.state().selectedDate ?? controller.state().value ?? null), before);
  });
}
