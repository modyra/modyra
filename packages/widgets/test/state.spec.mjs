/**
 * The state vocabulary.
 *
 * A part's classes say what it is; its states say what it is doing. Both halves have to come from
 * the contract for a theme to be checkable against it — these assertions are why a rule for
 * `.mdy-datepicker__cell--in-range` can be trusted to match something, and why a renderer cannot
 * quietly invent `--inrange` alongside it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_CHIP_CLASSES,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  createCatalogWidgetController,
  multiselectChipClasses,
  partClasses,
  projectBooleanFieldA11y,
  projectOptionFieldA11y,
  projectTextFieldA11y,
  partStates,
  stateClass,
  widgetStateClasses,
} from "../dist/index.js";
import { MDY_STATE_MODIFIERS } from "../dist/vocabulary.js";

test("a state is spelled once, and the spelling is kebab-case", () => {
  for (const [name, modifier] of Object.entries(MDY_STATE_MODIFIERS)) {
    assert.match(modifier, /^[a-z]+(-[a-z]+)*$/, `${name} is not a kebab-case modifier`);
  }
  // The two that would otherwise be spelled four ways between three renderers.
  assert.equal(MDY_STATE_MODIFIERS.inRange, "in-range");
  assert.equal(MDY_STATE_MODIFIERS.hasError, "has-error");
});

test("a state hangs off the part's own class, not off whatever else it carries", () => {
  // A datepicker popup carries `mdy-popup` and `mdy-popup--surface` too, but `--above` belongs to
  // the datepicker's own popup class: the state modifies the part, not everything the part wears.
  assert.deepEqual(partClasses("datepicker", "popup", { above: true }), [
    "mdy-datepicker__popup", "mdy-popup", "mdy-popup--surface", "mdy-datepicker__popup--above",
  ]);
  assert.equal(stateClass("mdy-select__option", "selected"), "mdy-select__option--selected");
});

test("states compose, because a day really is several things at once", () => {
  assert.deepEqual(partClasses("datepicker", "gridcell", { today: true, selected: true, rangeStart: true }), [
    "mdy-datepicker__cell",
    "mdy-datepicker__cell--today",
    "mdy-datepicker__cell--selected",
    "mdy-datepicker__cell--range-start",
  ]);
});

test("a part that is the shell's takes the shell's class to hang its states on", () => {
  // `inputWrapper` carries no class of its own in the catalog; it is `mdy-input-wrapper`, and a
  // state on it has to land there rather than on nothing.
  assert.deepEqual(partClasses("text", "inputWrapper", { error: true }), [
    "mdy-input-wrapper", "mdy-input-wrapper--error",
  ]);
  assert.deepEqual(partClasses("text", "label", { filled: true }), ["mdy-label", "mdy-label--filled"]);
});

test("a widget that renames a shell part does not inherit the shell's states", () => {
  // A multiselect's `inputWrapper` is `mdy-multiselect`, the grid of chips — a different thing
  // wearing the same part name. Handing it `mdy-input-wrapper`'s states would mint
  // `mdy-multiselect--disabled`, which no theme styles and no renderer emits.
  assert.deepEqual(partStates("multiselect", "inputWrapper"), []);
  assert.deepEqual(partStates("text", "inputWrapper"), ["disabled", "error"]);
});

test("asking for a state a part never declared is refused, not silently emitted", () => {
  assert.throws(() => partClasses("text", "control", { selected: true }), /does not declare the state "selected"/);
  assert.throws(() => partClasses("select", "option", { today: true }), /does not declare the state "today"/);
  assert.throws(() => partClasses("select", "nonsense", {}), /has no part "nonsense"/);
});

test("a state that is off produces nothing", () => {
  assert.deepEqual(partClasses("datepicker", "gridcell"), ["mdy-datepicker__cell"]);
  assert.deepEqual(partClasses("datepicker", "gridcell", { today: false }), ["mdy-datepicker__cell"]);
});

test("every root can report open and touched, whatever the widget", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    assert.deepEqual(partStates(kind, "root"), ["open", "touched"], kind);
    assert.deepEqual(partClasses(kind, "root", { touched: true }).at(-1), "mdy-renderer--touched", kind);
  }
});

test("every popup reflects the placement the anchoring policy chose", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    if (!MDY_WIDGET_CONTRACTS[kind].capabilities.overlay) continue;
    // `right` joined them: which side a popup hangs from is a placement decision the anchoring
    // policy makes, and it was the one an adapter still had to spell as a literal.
    assert.deepEqual(partStates(kind, "popup"), ["above", "overlay", "right"], kind);
  }
});

test("the chip's selected state is the shared one, not a spelling of its own", () => {
  assert.equal(MDY_CHIP_CLASSES.selected, stateClass(MDY_CHIP_CLASSES.block, "selected"));
  assert.deepEqual(multiselectChipClasses({ selected: true }), ["mdy-chip", "mdy-chip--centered", "mdy-chip--selected"]);
  assert.deepEqual(multiselectChipClasses({ role: "value", removable: true }), ["mdy-chip", "mdy-chip--value", "mdy-chip--removable"]);
});

test("every declared state resolves to a class, on every part of every widget", () => {
  // A state declared on a part with no class to carry it would emit `undefined--selected`. This is
  // the assertion that stops the catalog from being able to say something unrenderable.
  for (const kind of MDY_WIDGET_KINDS) {
    for (const part of Object.keys(MDY_WIDGET_CONTRACTS[kind].parts)) {
      for (const state of partStates(kind, part)) {
        const classes = partClasses(kind, part, { [state]: true });
        assert.match(classes.at(-1), /^mdy-[a-z0-9_-]+--[a-z-]+$/, `${kind}.${part}.${state}`);
      }
    }
  }
});

test("a widget's full class surface is finite and derivable", () => {
  const datepicker = widgetStateClasses("datepicker");
  assert.ok(datepicker.includes("mdy-renderer--open"));
  assert.ok(datepicker.includes("mdy-datepicker__cell--in-range"));
  assert.ok(datepicker.includes("mdy-datepicker__grid"));
  // Nothing outside the contract creeps in, and the list is sorted so a diff of it reads.
  assert.deepEqual([...datepicker].sort(), [...datepicker]);
  for (const className of datepicker) assert.match(className, /^mdy-/);
});

test("a kind projects read-only only when its contract has the state", () => {
  // The two tables and the projections are three statements of one fact, and they had drifted:
  // `MDY_WIDGET_STATE_SUPPORT` says a boolean, a chooser and a range have no read-only rendering —
  // "either operable or disabled" — while the projections announced `aria-readonly="true"` anyway,
  // and the checkbox bound a native `readonly` that HTML ignores on a checkbox. The user was told
  // the control could not change, and space changed it.
  const readonly = { readonly: true, disabled: false, invalid: false, required: false, checked: false, errorIds: [], describedBy: null };

  const boolean = projectBooleanFieldA11y({ ...readonly }, [], { widgetId: "w", variant: "checkbox" });
  assert.equal(boolean.input.attributes["aria-readonly"], undefined);
  assert.equal(boolean.input.attributes.readonly, undefined);

  const option = projectOptionFieldA11y(
    { ...readonly, options: [] },
    [],
    { widgetId: "w", variant: "radio", optionCount: 0 },
  );
  assert.equal(option.group.attributes["aria-readonly"], undefined);

  // …and the kinds whose contract does have it keep both halves.
  const text = projectTextFieldA11y({ ...readonly, value: "" }, [], { widgetId: "w", kind: "text" });
  assert.equal(text.input.attributes["aria-readonly"], "true");
  assert.equal(text.input.attributes.readonly, true);

  // One projection draws several kinds, and the state belongs to the kind. A slider is a numeric
  // field structurally and declares no read-only rendering, so the same function must not announce
  // one for it — a renderer that draws its sliders through this projection exposes whatever it says.
  const slider = projectTextFieldA11y({ ...readonly, value: 0 }, [], { widgetId: "w", kind: "slider" });
  assert.equal(slider.input.attributes["aria-readonly"], null);
  assert.equal(slider.input.attributes.readonly, false);

  // A kind this contract does not know is not this contract's to police.
  const custom = projectTextFieldA11y({ ...readonly, value: "" }, [], { widgetId: "w", kind: "my-own-kind" });
  assert.equal(custom.input.attributes["aria-readonly"], "true");
});

test("aria-checked holds one of the three values the standard allows", () => {
  // The projection is published, so the state is the caller's to supply — but the attribute's value
  // is this contract's, and `aria-checked="undefined"` maps to nothing in any assistive technology,
  // on the single attribute that says whether the box is ticked.
  const base = { readonly: false, disabled: false, invalid: false, required: false, errorIds: [], describedBy: null };
  for (const checked of [undefined, null, "indeterminate", 0, "", "true"]) {
    const projected = projectBooleanFieldA11y({ ...base, checked }, [], { widgetId: "w", variant: "checkbox" });
    assert.ok(
      ["true", "false", "mixed"].includes(projected.input.attributes["aria-checked"]),
      `checked ${JSON.stringify(checked)} projected aria-checked=${JSON.stringify(projected.input.attributes["aria-checked"])}`,
    );
  }
  assert.equal(projectBooleanFieldA11y({ ...base, checked: true }, [], { widgetId: "w", variant: "checkbox" }).input.attributes["aria-checked"], "true");
  assert.equal(projectBooleanFieldA11y({ ...base, checked: false }, [], { widgetId: "w", variant: "checkbox" }).input.attributes["aria-checked"], "false");
});

test("a disabled widget can still be left, and is not left holding an overlay", () => {
  // The guard `if (value.disabled) return []` is right for intents that start something and wrong
  // for `close`, which ends something already happening. Every route out of an overlay goes through
  // it — Escape, a click away, choosing an option — so a field disabled while its picker was open
  // became a popup over a dead control with no way out.
  const controller = createCatalogWidgetController("select");

  controller.dispatch({ type: "open" });
  assert.equal(controller.state().open, true);

  // Disabling closes what it can no longer be used to close.
  const onDisable = controller.dispatch({ type: "disable", disabled: true });
  assert.deepEqual(onDisable.map((c) => c.type), ["close-overlay"]);
  assert.equal(controller.state().open, false);

  // Disabling a closed widget stays quiet, so no renderer gets a command on every disable.
  assert.deepEqual(controller.dispatch({ type: "disable", disabled: true }), []);

  // And a close while disabled is answered rather than swallowed, whatever left it open.
  controller.dispatch({ type: "disable", disabled: false });
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "disable", disabled: false });
  const escape = controller.dispatch({ type: "close", restoreFocus: true });
  assert.deepEqual(escape.map((c) => c.type), ["close-overlay", "restore-focus"]);

  // What the guard is for is untouched: a disabled widget does not start anything.
  controller.dispatch({ type: "disable", disabled: true });
  assert.deepEqual(controller.dispatch({ type: "open" }), []);
  assert.deepEqual(controller.dispatch({ type: "focus", part: "trigger" }), []);
});

test("a destroyed controller answers without acting", () => {
  // The rule the form engine already holds. A renderer may have torn its elements down, and
  // `close-overlay` for a widget that is gone is a command about nothing.
  const controller = createCatalogWidgetController("select");
  controller.dispatch({ type: "open" });
  controller.destroy();

  assert.deepEqual(controller.dispatch({ type: "close" }), []);
  assert.deepEqual(controller.dispatch({ type: "open" }), []);
  // Readable, like a destroyed form's value: what it last held.
  assert.equal(controller.state().open, true);
});
