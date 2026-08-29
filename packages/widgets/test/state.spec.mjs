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
  projectCalendarDayCellA11y,
  MDY_CHIP_CLASSES,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  createCatalogWidgetController,
  defaultOptionKey,
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

test("no kind gives a shell part's name to something else", () => {
  // `inputWrapper` is the shell's box, and it means the shell's box for every kind — including the
  // multiselect, which used to give the name to its own layout box instead. One name for two
  // different elements is not a naming inconvenience: a height comparison that resolved the part
  // per kind read the shell for three kinds and the inner box for the fourth, and reported the
  // border a theme draws on one of them as a two-pixel defect.
  //
  // The multiselect's own box is `box`, which is a part of its own and carries no shell state.
  // `readonly` beside `disabled` and `error`: a locked field is in play and a disabled one is not,
  // and a person has to be able to tell which they are looking at.
  for (const kind of ["text", "multiselect", "select", "datepicker"]) {
    assert.deepEqual(
      partStates(kind, "inputWrapper"),
      ["disabled", "error", "readonly"],
      `${kind} does not take the shell's states on the shell's part`,
    );
  }
  assert.deepEqual(partStates("multiselect", "box"), []);
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
  // The two tables and the projections are three statements of one fact. What each says has moved
  // once, and the reason is what to read: a widget announces read-only where its own controller
  // refuses the change, and stays silent where nothing refuses it. Every kind with a value refuses
  // it now — `blocksValueChange` is consulted before any intent is carried out — so the ARIA is
  // true where it was once a claim the DOM contradicted.
  //
  // The half that does not move: the native attribute, on a control HTML ignores it for. A
  // `readonly` bound to a checkbox binds nothing, and a checkbox that says it cannot change and
  // then changes is worse than one that says nothing.
  const readonly = { readonly: true, disabled: false, invalid: false, required: false, checked: false, errorIds: [], describedBy: null };

  const boolean = projectBooleanFieldA11y({ ...readonly }, [], { widgetId: "w", variant: "checkbox" });
  assert.equal(boolean.input.attributes["aria-readonly"], "true");
  // Never the native half: HTML ignores `readonly` on a checkbox.
  assert.equal(boolean.input.attributes.readonly, undefined);

  const option = projectOptionFieldA11y(
    { ...readonly, options: [] },
    [],
    { widgetId: "w", variant: "radio", optionCount: 0 },
  );
  assert.equal(option.group.attributes["aria-readonly"], "true");

  // …and the kinds whose contract does have it keep both halves.
  const text = projectTextFieldA11y({ ...readonly, value: "" }, [], { widgetId: "w", kind: "text" });
  assert.equal(text.input.attributes["aria-readonly"], "true");
  assert.equal(text.input.attributes.readonly, true);

  // One projection draws several kinds, and the state belongs to the kind — which is still asked of
  // the contract rather than assumed from the file the projection lives in. A slider announces it
  // and does not bind it: `<input type="range">` ignores the attribute, and what refuses the drag is
  // the renderer asking `blocksValueChange`.
  const slider = projectTextFieldA11y({ ...readonly, value: 0 }, [], { widgetId: "w", kind: "slider" });
  assert.equal(slider.input.attributes["aria-readonly"], "true");
  assert.equal(slider.input.attributes.readonly, false);

  // The kind that declares no read-only state at all: a file picker is the browser's, and its
  // element's role has no attribute to carry this.
  const file = projectTextFieldA11y({ ...readonly, value: "" }, [], { widgetId: "w", kind: "file" });
  assert.equal(file.input.attributes["aria-readonly"], null);

  // A kind this contract does not know is not this contract's to police.
  const custom = projectTextFieldA11y({ ...readonly, value: "" }, [], { widgetId: "w", kind: "my-own-kind" });
  assert.equal(custom.input.attributes["aria-readonly"], "true");
});

test("aria-checked is the switch's, and holds one of the values the standard allows", () => {
  // The projection is published, so the state is the caller's to supply — but the attribute's value
  // is this contract's, and `aria-checked="undefined"` maps to nothing in any assistive technology,
  // on the single attribute that says whether a switch is on.
  const base = { readonly: false, disabled: false, invalid: false, required: false, errorIds: [], describedBy: null };
  for (const checked of [undefined, null, "indeterminate", 0, "", "true"]) {
    const projected = projectBooleanFieldA11y({ ...base, checked }, [], { widgetId: "w", variant: "switch" });
    assert.ok(
      ["true", "false", "mixed"].includes(projected.input.attributes["aria-checked"]),
      `checked ${JSON.stringify(checked)} projected aria-checked=${JSON.stringify(projected.input.attributes["aria-checked"])}`,
    );
  }
  assert.equal(projectBooleanFieldA11y({ ...base, checked: true }, [], { widgetId: "w", variant: "switch" }).input.attributes["aria-checked"], "true");
  assert.equal(projectBooleanFieldA11y({ ...base, checked: false }, [], { widgetId: "w", variant: "switch" }).input.attributes["aria-checked"], "false");

  // And not the box's. A native `<input type="checkbox">` puts its own `checked` into the
  // accessibility tree; the attribute beside it is a second source for one fact, and when the two
  // disagree the ARIA one wins and is the one that went stale. Three renderers disagreed about
  // writing it, which is what a redundant attribute invites.
  const box = projectBooleanFieldA11y({ ...base, checked: true }, [], { widgetId: "w", variant: "checkbox" });
  // `null` and not an absent key: this contract says "no attribute" with `null` everywhere, and a key
  // simply left out reads as `undefined` to anything asking the object what the field says.
  assert.equal(box.input.attributes["aria-checked"], null);
  assert.equal(box.input.attributes.checked, true, "the box still says it is ticked, in the way HTML says it");
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

test("the default option key is reachable from the package a consumer imports", () => {
  // A consumer writing their own `keyFor` needs the default to fall back to, and ADR 0054 says this
  // is exported. It was added to the wrong export block and the barrel carried nothing — the deep
  // path worked, so nothing in this package noticed.
  assert.equal(typeof defaultOptionKey, "function");
  assert.notEqual(defaultOptionKey({ id: 1 }), defaultOptionKey({ id: 2 }));
  // A primitive keys exactly as it always did, which is what makes the change safe for existing ids.
  assert.equal(defaultOptionKey("en"), "en");
  assert.equal(defaultOptionKey(3), "3");
});

/**
 * The day a calendar is always asked about, said rather than only painted.
 *
 * `today` has been a declared state on the cell for as long as the part has existed, and the day
 * cell had no projection: three renderers wrote its semantics by hand and one of the three marked
 * today. A person hearing the grid gets thirty-one numbers and no anchor without it.
 */
test("a day cell says which day is today, and says it as a date", () => {
  const at = (over) => projectCalendarDayCellA11y(
    { selected: false, disabled: false, today: false, focused: false, outside: false, ...over },
    { kind: "datepicker", widgetId: "w" },
  );
  assert.equal(at({ today: true }).attributes["aria-current"], "date");
  // `date` and not `true`: the token names what kind of current this is, which is what a reader
  // announces. And absent on every other day — `aria-current="false"` on thirty of them is noise.
  assert.equal(at({}).attributes["aria-current"], undefined);
  assert.ok(at({ today: true }).classes.includes("mdy-datepicker__cell--today"),
    "the state the contract declares is painted as well as announced");

  // The rest of the cell's answers come from the same door, which is the point of having one.
  assert.equal(at({ selected: true }).attributes["aria-selected"], "true");
  assert.equal(at({ disabled: true }).attributes["aria-disabled"], "true");
  assert.equal(at({ focused: true }).attributes.tabindex, "0");
  assert.equal(at({}).attributes.tabindex, "-1");
});
