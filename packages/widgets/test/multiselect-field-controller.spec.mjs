/**
 * Multiselect field controller conformance tests.
 *
 * Two selection semantics over one array value: `"single"` is a toggle-set, `"multi"` a bag that
 * counts repeats. See multiselect-field-controller.ts for the behaviour these assert.
 */

import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import {
  createMultiselectFieldController,
} from "../dist/field/index.js";
import { MDY_VALUE_CONTRACTS } from "../../core/dist/index.js";

const options = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large", disabled: true },
];

function setup(mode = "single", initialValue = []) {
  const rx = vanillaReactivity();
  const value = rx.signal(initialValue);
  const errors = rx.signal([]);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const valid = rx.computed(() => errors().length === 0);
  const pending = rx.signal(false);
  const required = rx.signal(false);
  const disabled = rx.signal(false);
  const readonly = rx.signal(false);
  // Derived exactly as the engine derives it, so a stand-in handle cannot describe a state the
  // real one can never be in.
  const interactivity = rx.computed(() =>
    disabled() ? "disabled" : readonly() ? "readonly" : "enabled");

  const handle = {
    path: "sizes",
    value,
    errors,
    touched,
    dirty,
    valid,
    pending,
    required,
    disabled,
    readonly,
    interactivity,
    set(v) {
      value.set(v);
    },
    markAsTouched() {
      touched.set(true);
    },
    markAsDirty() {
      dirty.set(true);
    },
  };

  const controller = createMultiselectFieldController(
    { widgetId: "sizes", handle, options, mode },
    rx,
  );

  return { controller, handle, rx };
}

test("initial state is empty", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.deepStrictEqual(state.selectedValues, []);
  assert.strictEqual(state.selectedKeys.size, 0);
  assert.strictEqual(state.touched, false);
});

test("single mode: toggle adds then removes, marks dirty/touched", () => {
  const { controller, handle } = setup("single");
  controller.dispatch({ type: "toggle", optionKey: "medium" });
  assert.deepStrictEqual(handle.value(), ["medium"]);
  assert.strictEqual(controller.state().selectedKeys.has("medium"), true);
  assert.strictEqual(handle.dirty(), true);
  assert.strictEqual(handle.touched(), true);

  controller.dispatch({ type: "toggle", optionKey: "medium" });
  assert.deepStrictEqual(handle.value(), []);
  assert.strictEqual(controller.state().selectedKeys.has("medium"), false);
});

test("single mode: toggling a disabled option is ignored", () => {
  const { controller, handle } = setup("single");
  controller.dispatch({ type: "toggle", optionKey: "large" });
  assert.deepStrictEqual(handle.value(), []);
  assert.strictEqual(handle.dirty(), false);
});

test("multi mode: increment appends, allowing repeats; decrement removes one", () => {
  const { controller, handle } = setup("multi");
  controller.dispatch({ type: "increment", optionKey: "small" });
  controller.dispatch({ type: "increment", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), ["small", "small"]);
  assert.strictEqual(controller.state().counts.get("small"), 2);

  controller.dispatch({ type: "decrement", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), ["small"]);
  assert.strictEqual(controller.state().counts.get("small"), 1);
});

test("multi mode: increment then decrement leaves the array as it started, order and all", () => {
  const { controller, handle } = setup("multi", ["small", "small", "small", "medium"]);
  controller.dispatch({ type: "increment", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), ["small", "small", "small", "small", "medium"]);
  controller.dispatch({ type: "decrement", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), ["small", "small", "small", "medium"]);
});

test("decrementing an option not present is a no-op", () => {
  const { controller, handle } = setup("multi");
  const commands = controller.dispatch({ type: "decrement", optionKey: "medium" });
  assert.deepStrictEqual(handle.value(), []);
  assert.deepStrictEqual(commands, []);
});

test("decrementing a disabled option is refused, as toggling it is", () => {
  const { controller, handle } = setup("multi", ["large"]);
  const commands = controller.dispatch({ type: "decrement", optionKey: "large" });
  assert.deepStrictEqual(handle.value(), ["large"]);
  assert.deepStrictEqual(commands, []);
  assert.strictEqual(handle.dirty(), false);
});

test("a programmatic setValue spends the way back a clear had offered", () => {
  const { controller, handle } = setup("single", ["small", "medium"]);
  controller.dispatch({ type: "clear" });
  assert.strictEqual(controller.state().wayBack?.act, "clear");
  controller.setValue(["medium"]);
  assert.strictEqual(controller.state().wayBack, null);
  controller.dispatch({ type: "undo" });
  assert.deepStrictEqual(handle.value(), ["medium"]);
});

test("clear resets to an empty array", () => {
  const { controller, handle } = setup("single", ["small", "medium"]);
  controller.dispatch({ type: "clear" });
  assert.deepStrictEqual(handle.value(), []);
});

// A leaving is not an answer: Tab is how a person reads a form, so a traversal that changed
// nothing leaves the field silent. What makes it answerable is a change to the value. ADR 0167.
test("leaving alters neither the value nor the verdict", () => {
  const { controller, handle } = setup();
  const before = handle.value();
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(handle.touched(), false);
  assert.deepEqual(handle.value(), before);
  assert.deepEqual(commands, []);
});

test("search filters filteredOptions by label, case-insensitive, without touching selection", () => {
  const { controller, handle } = setup("single", ["small"]);
  controller.dispatch({ type: "search", query: "lar" });
  assert.deepStrictEqual(controller.filteredOptions().map((o) => o.value), ["large"]);
  assert.deepStrictEqual(handle.value(), ["small"]); // search never mutates the field
});

test("disabled controller ignores toggle/increment/decrement/clear", () => {
  const { controller, handle } = setup("single");
  handle.disabled.set(true);
  controller.dispatch({ type: "toggle", optionKey: "small" });
  assert.deepStrictEqual(handle.value(), []);
  assert.strictEqual(handle.dirty(), false);
});

test("view exposes chip-group ARIA contract (role=group, not listbox)", () => {
  const { controller } = setup("single", ["medium"]);
  const view = controller.view();
  assert.strictEqual(view.parts.group.attributes.role, "group");
  // The chip group is the popup's content; the trigger is the control that opens it, and carries
  // its own class rather than the field box's — one class naming two elements is how the label came
  // to name a box instead of a control.
  assert.strictEqual(view.parts.group.classes.includes("mdy-multiselect__options"), true);
  assert.strictEqual(view.parts.trigger.classes.includes("mdy-multiselect__trigger"), true);
  assert.strictEqual(view.parts.medium.attributes["aria-pressed"], "true");
  assert.strictEqual(view.parts.small.attributes["aria-pressed"], "false");
  assert.strictEqual(view.parts.large.attributes["aria-disabled"], "true");
});

test("multi mode view exposes data-count instead of aria-pressed", () => {
  const { controller } = setup("multi");
  controller.dispatch({ type: "increment", optionKey: "small" });
  controller.dispatch({ type: "increment", optionKey: "small" });
  const view = controller.view();
  assert.strictEqual(view.parts.small.attributes["data-count"], 2);
  assert.strictEqual("aria-pressed" in view.parts.small.attributes, false);
});

test("the options live in an overlay the trigger controls", () => {
  const { controller } = setup();
  assert.strictEqual(controller.state().open, false);
  assert.strictEqual(controller.view().parts.popup.attributes.hidden, true);

  const opened = controller.dispatch({ type: "toggleOpen" });
  assert.strictEqual(controller.state().open, true);
  assert.strictEqual(controller.view().parts.trigger.attributes["aria-expanded"], "true");
  assert.strictEqual(controller.view().parts.popup.attributes.hidden, false);
  // Opening moves focus into the filter field, exactly like select's overlay does.
  assert.deepStrictEqual(opened.map((c) => c.type), ["open-overlay", "focus"]);

  // Picking does not close: a multiselect exists to take more than one choice.
  controller.dispatch({ type: "toggle", optionKey: "small" });
  assert.strictEqual(controller.state().open, true);

  // Closing carries the mark: opening the list and leaving it is an act on the value, the panel's
  // version of typing and deleting. ADR 0167.
  const closed = controller.dispatch({ type: "close", restoreFocus: true });
  assert.strictEqual(controller.state().open, false);
  assert.deepStrictEqual(closed.map((c) => c.type), ["close-overlay", "mark-touched", "restore-focus"]);
});

test("closing clears the filter so reopening shows every option", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "search", query: "sma" });
  assert.strictEqual(controller.filteredOptions().length, 1);
  controller.dispatch({ type: "close" });
  assert.strictEqual(controller.state().query, "");
  assert.strictEqual(controller.filteredOptions().length, 3);
});

test("a disabled multiselect does not open", () => {
  const { controller, handle } = setup();
  handle.disabled.set(true);
  assert.deepStrictEqual(controller.dispatch({ type: "open" }), []);
  assert.strictEqual(controller.state().open, false);
});

test("setValue updates state programmatically", () => {
  const { controller, handle } = setup();
  controller.setValue(["small", "large"]);
  assert.deepStrictEqual(handle.value(), ["small", "large"]);
  assert.strictEqual(controller.state().selectedKeys.has("large"), true);
});

/* ── Loose identity (ADR 0051) ──────────────────────────────────────────────────
 * A draft, a refetch or an import hands the field a fresh object that *is* an option's value
 * without *being* it. `optionsWithUnrecognizedValues` already recognises the choice loosely, so
 * no placeholder is added; the selection projection has to recognise it too, or the model holds
 * a value no chip admits to.
 */
function setupObjects(initialValue) {
  const rx = vanillaReactivity();
  const objectOptions = [
    { value: { id: "a" }, label: "Ada" },
    { value: { id: "b" }, label: "Bia" },
  ];
  const value = rx.signal(initialValue);
  const errors = rx.signal([]);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const handle = {
    path: "people",
    value,
    errors,
    touched,
    dirty,
    valid: rx.computed(() => errors().length === 0),
    pending: rx.signal(false),
    required: rx.signal(false),
    disabled: rx.signal(false),
    readonly: rx.signal(false),
    interactivity: rx.computed(() => "enabled"),
    set(v) {
      value.set(v);
    },
    markAsTouched() {
      touched.set(true);
    },
    markAsDirty() {
      dirty.set(true);
    },
  };
  const controller = createMultiselectFieldController(
    { widgetId: "people", handle, options: objectOptions, mode: "multi" },
    rx,
  );
  return { controller, handle, rx };
}

test("a fresh object holding an option's value is selected, counted and reachable", () => {
  const { controller, handle } = setupObjects([{ id: "a" }, { id: "a" }, { id: "b" }]);
  const state = controller.state();
  // No unrecognised placeholder: each value loosely matches a declared option.
  assert.strictEqual(state.options.length, 2);
  assert.strictEqual(state.selectedKeys.has('{"id":"a"}'), true);
  assert.strictEqual(state.selectedKeys.has('{"id":"b"}'), true);
  assert.strictEqual(state.counts.get('{"id":"a"}'), 2);
  assert.strictEqual(state.counts.get('{"id":"b"}'), 1);

  // Increment groups with the occurrences already held, it does not start a second group.
  controller.dispatch({ type: "increment", optionKey: '{"id":"b"}' });
  assert.deepStrictEqual(handle.value().map((v) => v.id), ["a", "a", "b", "b"]);

  // Decrement finds the loosely held value and removes its last occurrence.
  controller.dispatch({ type: "decrement", optionKey: '{"id":"a"}' });
  assert.deepStrictEqual(handle.value().map((v) => v.id), ["a", "b", "b"]);

  // Move carries the loosely held group as one thing.
  controller.dispatch({ type: "move-selected", optionKey: '{"id":"b"}', to: 0 });
  assert.deepStrictEqual(handle.value().map((v) => v.id), ["b", "b", "a"]);
});

/* ── The declared commit mode ───────────────────────────────────────────────────
 * The other half of what `MDY_VALUE_CONTRACTS` distinguishes: a `live` kind writes through on the
 * interaction itself. Asserting only the `confirm` side would leave the two modes indistinguishable
 * — a contract where every kind behaved the same would still pass.
 */
test("a live-mode kind writes through on the interaction itself", () => {
  assert.strictEqual(MDY_VALUE_CONTRACTS.multiselect.commit, "live");

  const { controller, handle } = setup();
  const before = handle.value();

  controller.dispatch({ type: "toggle", optionKey: "medium" });

  assert.notDeepStrictEqual(handle.value(), before, "the interaction did not reach the field");
});

/**
 * Where the cursor stands the moment the list is shown. ADR 0179.
 *
 * A panel raised from the keyboard is about to be given a keypress, so it opens with somewhere for
 * that press to land. Empty, the first arrow is spent picking a starting point — showing nothing,
 * and indistinguishable by ear from an arrow that did not work — and the key meaning "choose this
 * one" has no target at all, which is what two renderers were answering from the trigger instead.
 */
test("a keyboard opening leaves the cursor on the first value already chosen", () => {
  const { controller } = setup("single", ["medium"]);
  controller.dispatch({ type: "open", by: "keyboard" });
  assert.strictEqual(controller.state().activeKey, "medium",
    "the cursor did not land on the value this person already has, so changing it costs them the "
    + "walk down the list that opening on it was meant to save");
});

test("with nothing chosen it is the first option on screen", () => {
  const { controller } = setup("single", []);
  controller.dispatch({ type: "open", by: "keyboard" });
  assert.strictEqual(controller.state().activeKey, "small");
});

test("a pointer opening leaves nothing singled out", () => {
  const { controller } = setup("single", ["medium"]);
  controller.dispatch({ type: "open", by: "pointer" });
  assert.strictEqual(controller.state().activeKey, null,
    "a click was about to be followed by another click, and the control drew a ring on an option "
    + "nobody touched");
});

test("saying nothing is the pointer answer, not a third one", () => {
  const { controller } = setup("single", ["medium"]);
  controller.dispatch({ type: "open" });
  assert.strictEqual(controller.state().activeKey, null);
});

test("the cursor is primed afresh each showing, never carried over", () => {
  const { controller } = setup("single", []);
  controller.dispatch({ type: "open", by: "keyboard" });
  controller.dispatch({ type: "move", target: "last" });
  const walked = controller.state().activeKey;
  assert.notStrictEqual(walked, "small", "the move did not move, so nothing below is being tested");

  controller.dispatch({ type: "close" });
  controller.dispatch({ type: "open", by: "keyboard" });
  assert.strictEqual(controller.state().activeKey, "small",
    "the next showing started where the last one was left, which is a position this person never "
    + "chose in this one");
});
