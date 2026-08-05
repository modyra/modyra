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
  MDY_STATE_MODIFIERS,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  multiselectChipClasses,
  partClasses,
  partStates,
  stateClass,
  widgetStateClasses,
} from "../dist/index.js";

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
