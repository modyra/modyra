/**
 * The month and year views, which two renderers had invented separately and the contract had never
 * named.
 *
 * The check is not that the classes exist — they did, in both renderers, identical and unowned. It
 * is that the *state* lives in one place and the semantics are answered once: which view is showing
 * is the controller's, and a chosen month announces itself rather than only looking chosen.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "@modyra/core";
import {
  MDY_CALENDAR_VIEW_MODES,
  MDY_WIDGET_CONTRACTS,
  calendarViewAfterPick,
  createDatepickerFieldController,
  projectCalendarPeriodCellA11y,
  projectCalendarViewA11y,
} from "../dist/index.js";

function setup(initial = "2026-07-15") {
  const rx = vanillaReactivity();
  const value = rx.signal(initial);
  const errors = rx.signal([]);
  const flag = () => rx.signal(false);
  const disabled = flag();
  const readonly = flag();
  const handle = {
    path: "when",
    value,
    errors,
    touched: flag(),
    dirty: flag(),
    valid: rx.computed(() => errors().length === 0),
    pending: flag(),
    required: flag(),
    constraints: rx.signal({}),
    interactivity: rx.computed(() => (disabled() ? "disabled" : readonly() ? "readonly" : "enabled")),
    disabled,
    readonly,
    set: (v) => value.set(v),
    markAsTouched: () => undefined,
    markAsDirty: () => undefined,
  };
  return { controller: createDatepickerFieldController({ widgetId: "w", handle }, rx), handle };
}

test("which view is showing is state, and choosing narrows towards the days", () => {
  const { controller } = setup();
  assert.deepEqual([...MDY_CALENDAR_VIEW_MODES], ["days", "months", "years"]);
  assert.equal(controller.state().viewMode, "days", "a calendar opens on its days");

  controller.dispatch({ type: "set-view-mode", mode: "years" });
  assert.equal(controller.state().viewMode, "years");

  // Choosing a year lands on that year's months, not back on the grid: the funnel is the contract's
  // so one renderer cannot walk it while another skips a step.
  controller.dispatch({ type: "select-year", year: 2030 });
  assert.equal(controller.state().viewMode, "months");
  assert.equal(controller.state().viewYear, 2030);
  assert.equal(calendarViewAfterPick("years"), "months");

  controller.dispatch({ type: "select-month", month: 2 });
  assert.equal(controller.state().viewMode, "days");
  assert.equal(controller.state().viewMonth, 2);
  assert.equal(calendarViewAfterPick("months"), "days");
});

test("choosing in a view does not commit a value", () => {
  const { controller, handle } = setup("2026-07-15");
  controller.dispatch({ type: "set-view-mode", mode: "years" });
  controller.dispatch({ type: "select-year", year: 2030 });
  controller.dispatch({ type: "select-month", month: 2 });
  // Navigating is not picking: the form still holds what it held.
  assert.equal(handle.value(), "2026-07-15");
});

test("every opening starts on the days", () => {
  const { controller } = setup();
  controller.dispatch({ type: "set-view-mode", mode: "years" });
  controller.dispatch({ type: "close" });
  controller.dispatch({ type: "open" });
  assert.equal(controller.state().viewMode, "days", "the popup resumed where the last one left it");
});

test("the two views carry the structure the day grid already had", () => {
  assert.equal(projectCalendarViewA11y("days", { kind: "datepicker", widgetId: "w" }), null);
  for (const [mode, part] of [["months", "monthPicker"], ["years", "yearPicker"]]) {
    const view = projectCalendarViewA11y(mode, { kind: "datepicker", widgetId: "w" });
    assert.equal(view.attributes.role, "grid", `${mode} is a grid, like the days it replaces`);
    assert.equal(view.attributes["aria-labelledby"], "w__label", "a grid nobody names is a table of numbers");
    assert.deepEqual(view.classes, [...MDY_WIDGET_CONTRACTS.datepicker.parts[part].classes]);
  }
});

test("a chosen period announces itself, and a refused one is unavailable", () => {
  const chosen = projectCalendarPeriodCellA11y(
    "months",
    { value: 3, label: "Mar", selected: true, disabled: false },
    { kind: "daterange", widgetId: "w" },
  );
  assert.equal(chosen.attributes.role, "gridcell");
  assert.equal(chosen.attributes["aria-selected"], "true", "selected was a class and nothing else");
  assert.ok(chosen.classes.includes("mdy-datepicker__month-cell--selected"));

  const refused = projectCalendarPeriodCellA11y(
    "years",
    { value: 1900, label: "1900", selected: false, disabled: true },
    { kind: "datepicker", widgetId: "w" },
  );
  assert.equal(refused.attributes["aria-disabled"], "true");
  assert.equal(refused.attributes.disabled, true, "and out of the tab order natively");
  assert.equal(refused.attributes["aria-selected"], "false");
});

/**
 * Where the header's control goes, which two renderers agreed on by accident and a third, written
 * later against the same contract, got the other way round.
 */
test("the header opens the top of the funnel, and closes back to the days", async () => {
  const { calendarViewOnToggle } = await import("../dist/index.js");
  assert.equal(calendarViewOnToggle("days"), "years", "a header reached for is a date far from here");
  assert.equal(calendarViewOnToggle("months"), "days");
  assert.equal(calendarViewOnToggle("years"), "days");

  // Toggling twice from the days is a round trip, not a walk down the funnel.
  assert.equal(calendarViewOnToggle(calendarViewOnToggle("days")), "days");
});
