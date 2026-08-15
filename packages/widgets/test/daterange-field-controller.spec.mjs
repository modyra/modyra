/**
 * The three questions every renderer was answering for itself.
 *
 * Is this cell the start, is it the end, is it between them. Twenty-one duplicated bodies across
 * three packages existed because there was no controller to ask — and one of the three renderers
 * answered the last one by comparing ISO strings where the others compared dates, which is a
 * different answer nobody would have found except by using both.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import {
  createDaterangeFieldController,
} from "../dist/field/index.js";

function setup({ value = { start: null, end: null }, validators = [], ...rest } = {}) {
  const rx = vanillaReactivity();
  const form = createForm({ r: field(value, validators) }, { reactivity: rx });
  const controller = createDaterangeFieldController(
    { widgetId: "w", handle: form.f.r, ...rest },
    rx,
  );
  return { rx, form, controller };
}

const isoOf = (cells, iso) => cells.find((c) => c.iso === iso);

test("a range paints its ends and everything between them", () => {
  const { controller, form } = setup({ value: { start: "2026-07-10", end: "2026-07-14" } });
  const { cells } = controller.state();

  assert.equal(isoOf(cells, "2026-07-10").rangeStart, true);
  assert.equal(isoOf(cells, "2026-07-14").rangeEnd, true);
  assert.equal(isoOf(cells, "2026-07-12").inRange, true);
  // The ends are not "in range": they are the range's edges, and a theme paints them differently.
  assert.equal(isoOf(cells, "2026-07-10").inRange, false);
  assert.equal(isoOf(cells, "2026-07-14").inRange, false);
  assert.equal(isoOf(cells, "2026-07-15").inRange, false);
  controller.destroy(); form.destroy();
});

test("the first pick opens a range and commits nothing", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-10" });

  assert.deepEqual(form.f.r.value(), { start: null, end: null }, "half a range reached the form");
  assert.equal(controller.state().draft.start, "2026-07-10");
  assert.equal(controller.state().picking, "end");
  controller.destroy(); form.destroy();
});

test("the second pick closes the range, commits it and closes the overlay", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-10" });
  const commands = controller.dispatch({ type: "select-date", iso: "2026-07-14" });

  assert.deepEqual(form.f.r.value(), { start: "2026-07-10", end: "2026-07-14" });
  assert.equal(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "close-overlay"));
  assert.ok(commands.some((c) => c.type === "mark-dirty"));
  controller.destroy(); form.destroy();
});

test("picking backwards is a range that ends where it began", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-14" });
  controller.dispatch({ type: "select-date", iso: "2026-07-10" });
  // Ordered, not refused: a person dragging right to left picked the same five days.
  assert.deepEqual(form.f.r.value(), { start: "2026-07-10", end: "2026-07-14" });
  controller.destroy(); form.destroy();
});

test("the preview shows the range before it exists, and never commits it", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-10" });
  controller.dispatch({ type: "preview", iso: "2026-07-13" });

  const state = controller.state();
  assert.deepEqual(state.previewed, { start: "2026-07-10", end: "2026-07-13" });
  assert.deepEqual(state.draft, { start: "2026-07-10", end: null }, "a preview became a decision");
  assert.equal(isoOf(state.cells, "2026-07-12").inRange, true, "the preview painted no range");
  assert.deepEqual(form.f.r.value(), { start: null, end: null });

  // The pointer leaves the grid: the preview goes with it.
  controller.dispatch({ type: "preview", iso: null });
  assert.deepEqual(controller.state().previewed, { start: "2026-07-10", end: null });
  controller.destroy(); form.destroy();
});

test("closing on half a range keeps what the form already had", () => {
  const { controller, form } = setup({ value: { start: "2026-07-01", end: "2026-07-05" } });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-20" });
  controller.dispatch({ type: "cancel" });

  assert.deepEqual(form.f.r.value(), { start: "2026-07-01", end: "2026-07-05" });
  assert.deepEqual(controller.state().draft, { start: "2026-07-01", end: "2026-07-05" },
    "the abandoned draft outlived the overlay");
  controller.destroy(); form.destroy();
});

test("the keyboard previews the same way the pointer does", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-10" });
  const before = controller.state().previewed.end;
  controller.dispatch({ type: "keydown", key: "ArrowRight" });
  // Without this a keyboard user picks the second end having never seen the range they are making.
  assert.notEqual(controller.state().previewed.end, before);
  controller.destroy(); form.destroy();
});

test("bounds refuse a pick rather than silently moving it", () => {
  // Seeded with a value inside the window, so the grid opens on the month the bounds are in: a
  // picker with no value opens on today, and today is not where these bounds live.
  const { controller, form } = setup({
    value: { start: "2026-07-10", end: "2026-07-12" },
    minDate: "2026-07-05",
    maxDate: "2026-07-20",
  });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select-date", iso: "2026-07-01" });
  assert.equal(controller.state().draft.start, "2026-07-10",
    "a date outside the bounds was accepted as a new start");

  const { cells } = controller.state();
  assert.equal(isoOf(cells, "2026-07-01").disabled, true);
  assert.equal(isoOf(cells, "2026-07-10").disabled, false);
  controller.destroy(); form.destroy();
});

test("the grid opens where the range is, not where today is", () => {
  const { controller, form } = setup({ value: { start: "2026-02-10", end: "2026-02-14" } });
  controller.dispatch({ type: "open" });
  assert.equal(controller.state().viewMonth, 2, "the picker opened somewhere the range is not");
  assert.equal(controller.state().viewYear, 2026);
  controller.destroy(); form.destroy();
});

test("out of play, no verdict", () => {
  const { controller, form } = setup({ validators: [required()] });
  assert.equal(controller.state().invalid, true);
  form.setDisabled("r", () => true);
  assert.equal(controller.state().invalid, false, "a disabled range painted as failing");
  controller.destroy(); form.destroy();
});

test("a read-only range opens and picks nothing", () => {
  const { controller, form } = setup();
  controller.setReadonly(true);
  const commands = controller.dispatch({ type: "select-date", iso: "2026-07-10" });
  assert.deepEqual(commands, []);
  assert.deepEqual(controller.state().draft, { start: null, end: null });
  // Read-only blocks the write and not the reach: blur still marks touched.
  assert.deepEqual(controller.dispatch({ type: "blur" }), [{ type: "mark-touched" }]);
  controller.destroy(); form.destroy();
});

/**
 * The projection and the ids, named where they are asserted.
 *
 * A type nothing names is a type nothing notices changing, and this kind's whole surface arrived at
 * once. `MdyDaterangeFieldState`, `MdyDaterangeFieldIntent`, `MdyDaterangeFieldControllerOptions` and
 * `MdyDaterangeFieldController` are the four halves of what a host binds to.
 */
test("both ends are named, and the opener carries the combobox", async () => {
  const { projectDaterangeFieldA11y } = await import("../dist/field/index.js");
  const { daterangeFieldPartIds, daterangeFieldRootClasses } = await import(
    "../dist/field/daterange-field-a11y.js"
  );
  const { controller, form } = setup({ value: { start: "2026-07-10", end: "2026-07-14" } });

  /** @type {import("../dist/field/index.js").MdyDaterangeFieldState} */
  const state = controller.state();
  const ids = daterangeFieldPartIds("w");
  const a11y = projectDaterangeFieldA11y(state, form.f.r.errors(), { widgetId: "w" });

  assert.equal(a11y.startControl.id, ids.startId);
  assert.equal(a11y.endControl.id, ids.endId);
  // Two boxes under one label are two boxes a screen-reader user cannot tell apart.
  assert.notEqual(a11y.startControl.attributes["aria-label"], a11y.endControl.attributes["aria-label"]);
  assert.ok(a11y.startControl.attributes["aria-label"]);

  // The opener owns the overlay, not the inputs: one grid serves both ends, so one thing opens it
  // and one thing says whether it is open. The witness is the relation rather than a role — the
  // opener is a `<button>`, which has room for `aria-expanded` without one, and `MDY_POPUP_OPENERS`
  // declares a role only for the kinds whose opener is the control the value is typed into.
  assert.equal(a11y.toggle.attributes["aria-haspopup"], "grid");
  assert.equal(a11y.toggle.attributes["aria-expanded"], "false");
  assert.equal(a11y.startControl.attributes["aria-expanded"], undefined);
  assert.equal(a11y.startControl.attributes.role, undefined);

  // The label points at the start — the first thing a person fills.
  assert.equal(a11y.label.attributes.for, ids.startId);

  assert.ok(daterangeFieldRootClasses(state).length > 0);
  controller.destroy(); form.destroy();
});

test("the host can name each end in its own language", async () => {
  const { projectDaterangeFieldA11y } = await import("../dist/field/index.js");
  const { controller, form } = setup();
  const a11y = projectDaterangeFieldA11y(controller.state(), [], {
    widgetId: "w",
    startLabel: "Data di inizio",
    endLabel: "Data di fine",
  });
  assert.equal(a11y.startControl.attributes["aria-label"], "Data di inizio");
  assert.equal(a11y.endControl.attributes["aria-label"], "Data di fine");
  controller.destroy(); form.destroy();
});

test("the controller's own surface is what a host binds to", async () => {
  /** @type {import("../dist/field/index.js").MdyDaterangeFieldControllerOptions} */
  const options = { widgetId: "w", handle: undefined, firstDayOfWeek: 1 };
  assert.equal(options.firstDayOfWeek, 1);

  const { controller, form } = setup();
  /** @type {import("../dist/field/index.js").MdyDaterangeFieldController} */
  const bound = controller;
  assert.equal(typeof bound.setValue, "function");
  assert.equal(typeof bound.setReadonly, "function");

  /** @type {import("../dist/field/index.js").MdyDaterangeFieldIntent} */
  const intent = { type: "preview", iso: null };
  assert.deepEqual(bound.dispatch(intent), []);

  bound.setValue({ start: "2026-09-01", end: "2026-09-10" });
  assert.deepEqual(form.f.r.value(), { start: "2026-09-01", end: "2026-09-10" });
  controller.destroy(); form.destroy();
});
