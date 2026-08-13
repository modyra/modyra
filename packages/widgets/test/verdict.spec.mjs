/**
 * Out of play, no verdict — asserted where it is actually shown.
 *
 * The rule is two functions, and a test of the two functions proves almost nothing: what matters is
 * that every controller and every accessibility projection asks them. The four faces of the same
 * question — the state class on the wrapper, the state on the label, `aria-invalid`, and whether the
 * error text exists at all — are in six different files, which is what lets them disagree.
 *
 * So each check below drives a real controller into *invalid and disabled at once* and asserts the
 * whole surface goes quiet together. A kind that forgets the rule fails here by name.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "@modyra/core";
import {
  errorsVisible,
  shownErrors,
  shownErrorsOf,
  showsAsInvalid,
} from "../dist/index.js";
import {
  createBooleanFieldController,
  createDatepickerFieldController,
  createTextFieldController,
  createMultiselectFieldController,
  createOptionFieldController,
  createTimepickerFieldController,
  projectBooleanFieldA11y,
  projectDatepickerFieldA11y,
  projectTextFieldA11y,
  projectFieldShellA11y,
  projectMultiselectFieldA11y,
  projectOptionFieldA11y,
  projectTimepickerFieldA11y,
} from "../dist/field/index.js";

const ERRORS = [{ kind: "required", message: "Required" }];

/** A field handle whose invalidity and interactivity can be driven from a test. */
function makeHandle(rx, initialValue) {
  const value = rx.signal(initialValue);
  const errors = rx.signal(ERRORS);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const pending = rx.signal(false);
  const required = rx.signal(true);
  const disabled = rx.signal(false);
  const readonly = rx.signal(false);
  const valid = rx.computed(() => errors().length === 0);
  // Derived exactly as the engine derives it: a stand-in must not be able to describe a state the
  // real handle can never be in.
  const interactivity = rx.computed(() =>
    disabled() ? "disabled" : readonly() ? "readonly" : "enabled");
  return {
    path: "f",
    value, errors, touched, dirty, pending, required, disabled, readonly, valid, interactivity,
    set(v) { value.set(v); },
    markAsTouched() { touched.set(true); },
    markAsDirty() { dirty.set(true); },
    _disabled: disabled,
  };
}

// ─── the rule itself ──────────────────────────────────────────────────────────

test("in play, the errors are the field's; out of play, there are none", () => {
  assert.deepEqual(shownErrors({ disabled: false }, ERRORS), ERRORS);
  assert.deepEqual(shownErrors({ disabled: true }, ERRORS), []);
});

test("painting as failing needs both halves", () => {
  assert.equal(showsAsInvalid({ valid: false, disabled: false }), true);
  assert.equal(showsAsInvalid({ valid: false, disabled: true }), false, "out of play cannot fail");
  assert.equal(showsAsInvalid({ valid: true, disabled: false }), false);
  assert.equal(showsAsInvalid({ valid: true, disabled: true }), false);
});

test("the error text waits for the person to have had a turn", () => {
  assert.equal(errorsVisible({ disabled: false, touched: false }, ERRORS), false,
    "an untouched required field holds an error and must show none");
  assert.equal(errorsVisible({ disabled: false, touched: true }, ERRORS), true);
  assert.equal(errorsVisible({ disabled: true, touched: true }, ERRORS), false);
  assert.equal(errorsVisible({ disabled: false, touched: true }, []), false);
});

test("the errors are forgotten by nobody — the field still holds them", () => {
  const rx = vanillaReactivity();
  const handle = makeHandle(rx, "");
  handle._disabled.set(true);
  assert.deepEqual(shownErrorsOf(handle), [], "nothing is shown");
  assert.deepEqual(handle.errors(), ERRORS, "and nothing is lost");
  handle._disabled.set(false);
  assert.deepEqual(shownErrorsOf(handle), ERRORS, "they come back with the field");
});

// ─── every controller asks it ─────────────────────────────────────────────────

const CONTROLLERS = [
  ["text", () => "", (h, rx) => createTextFieldController({ widgetId: "w", handle: h, kind: "text" }, rx)],
  ["checkbox", () => false, (h, rx) => createBooleanFieldController({ widgetId: "w", handle: h, kind: "checkbox" }, rx)],
  ["radio", () => null, (h, rx) => createOptionFieldController(
    { widgetId: "w", handle: h, kind: "radio", options: [{ value: "a", label: "A" }] }, rx)],
  ["multiselect", () => [], (h, rx) => createMultiselectFieldController(
    { widgetId: "w", handle: h, options: [{ value: "a", label: "A" }] }, rx)],
  ["datepicker", () => null, (h, rx) => createDatepickerFieldController({ widgetId: "w", handle: h }, rx)],
  ["timepicker", () => null, (h, rx) => createTimepickerFieldController({ widgetId: "w", handle: h }, rx)],
];

for (const [kind, initial, make] of CONTROLLERS) {
  test(`${kind}: the controller reports no verdict while the form is not asking`, () => {
    const rx = vanillaReactivity();
    const handle = makeHandle(rx, initial());
    const controller = make(handle, rx);

    assert.equal(controller.state().invalid, true, `${kind} in play and failing must say so`);
    handle._disabled.set(true);
    assert.equal(controller.state().invalid, false,
      `${kind} paints as failing while disabled — the form does not validate it`);
    handle._disabled.set(false);
    assert.equal(controller.state().invalid, true, `${kind} must recover the verdict`);
    controller.destroy();
  });
}

// ─── every projection asks it ─────────────────────────────────────────────────

/**
 * The state handed to a projection is the one its own controller produces, not one written here.
 * A fixture invented in a test can describe a state the controller never reaches, and then it is
 * the fixture being checked.
 */
const PROJECTIONS = [
  ["text", projectTextFieldA11y, CONTROLLERS[0]],
  ["checkbox", projectBooleanFieldA11y, CONTROLLERS[1]],
  ["radio", projectOptionFieldA11y, CONTROLLERS[2]],
  ["multiselect", projectMultiselectFieldA11y, CONTROLLERS[3]],
  ["datepicker", projectDatepickerFieldA11y, CONTROLLERS[4]],
  ["timepicker", projectTimepickerFieldA11y, CONTROLLERS[5]],
];

/** Every `aria-invalid` and `aria-describedby` the projection put on any part. */
function ariaOf(projection) {
  const parts = Object.values(projection);
  return {
    invalid: parts.map((p) => p?.attributes?.["aria-invalid"]).filter((v) => v !== undefined),
    describedBy: parts.map((p) => p?.attributes?.["aria-describedby"]).filter((v) => v != null),
  };
}

for (const [name, project, [, initial, make]] of PROJECTIONS) {
  test(`${name}: the projection names no error list while the form is not asking`, () => {
    const rx = vanillaReactivity();
    const handle = makeHandle(rx, initial());
    const controller = make(handle, rx);

    const inPlay = ariaOf(project(controller.state(), handle.errors(), { widgetId: "w" }));
    assert.ok(
      inPlay.invalid.some((v) => v === "true" || v === true),
      `${name} in play and failing must announce aria-invalid, or this check proves nothing`,
    );

    handle._disabled.set(true);
    const outOfPlay = ariaOf(project(controller.state(), handle.errors(), { widgetId: "w" }));
    assert.ok(
      !outOfPlay.invalid.some((v) => v === "true" || v === true),
      `${name} announced aria-invalid on a field the form is not asking about`,
    );
    assert.ok(
      !outOfPlay.describedBy.some((v) => String(v).includes("error")),
      `${name} pointed aria-describedby at an error list a disabled field does not show`,
    );
    controller.destroy();
  });
}

test("the shared shell answers the same as the kinds that sit in it", () => {
  const inPlay = ariaOf(projectFieldShellA11y(
    { disabled: false, touched: true, required: true, invalid: true, readonly: false },
    ERRORS, { widgetId: "w", kind: "text" },
  ));
  assert.ok(inPlay.invalid.some((v) => v === "true" || v === true));

  const outOfPlay = ariaOf(projectFieldShellA11y(
    { disabled: true, touched: true, required: true, invalid: true, readonly: false },
    ERRORS, { widgetId: "w", kind: "text" },
  ));
  assert.ok(!outOfPlay.invalid.some((v) => v === "true" || v === true));
  assert.ok(!outOfPlay.describedBy.some((v) => String(v).includes("error")));
});
