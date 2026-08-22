/**
 * Select controller conformance tests.
 */

import assert from "node:assert";
import test from "node:test";

import { createSelectController } from "../dist/select/index.js";

const options = [
  { value: "rome", label: "Rome" },
  { value: "paris", label: "Paris" },
  { value: "london", label: "London", disabled: true },
  { value: "berlin", label: "Berlin" },
];

function setup() {
  const changes = [];
  const controller = createSelectController({
    widgetId: "city",
    options,
    onChange: (value) => changes.push(value),
  });
  return { controller, changes };
}

test("initial state is closed and empty", () => {
  const { controller } = setup();
  const state = controller.state();
  assert.strictEqual(state.open, false);
  assert.strictEqual(state.activeKey, null);
  assert.strictEqual(state.selectedValue, null);
  assert.strictEqual(state.touched, false);
  assert.strictEqual(state.dirty, false);
});

/**
 * Opening puts the reading position where the value is, and nowhere when there is none.
 *
 * This test asserted the opposite — that opening activates the first option — and the keyboard
 * policy beside the controller asserted this one in words: *the list opens with nothing active, and
 * the next arrow lands where the direction says*. Two statements of one rule, disagreeing.
 *
 * The policy wins, for a reason outside either: with the first option pre-activated, `ArrowDown`
 * from nothing-active and `ArrowUp` from nothing-active could never run, and those two branches are
 * how a list opens onto its first or its last option. What a person got instead was a first press
 * that stepped *past* the option the list had silently put them on — and only in the two renderers
 * built on this controller, so one document reached different values on different adapters.
 */
test("opening activates nothing when nothing is chosen", () => {
  const { controller } = setup();
  const commands = controller.dispatch({ type: "open", source: "keyboard" });
  assert.strictEqual(controller.state().open, true);
  assert.strictEqual(controller.state().activeKey, null);
  assert.ok(commands.some((c) => c.type === "open-overlay"));
});

test("opening activates the chosen option when there is one", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  controller.dispatch({ type: "select", optionKey: "paris" });
  const commands = controller.dispatch({ type: "open", source: "keyboard" });
  assert.strictEqual(controller.state().activeKey, "paris");
  assert.ok(commands.some((c) => c.type === "scroll-into-view" && c.target.key === "paris"));
});

test("move next wraps within enabled options and skips disabled", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  // From nothing active, the first step arrives at the first option rather than passing it.
  controller.dispatch({ type: "move", target: "next" });
  assert.strictEqual(controller.state().activeKey, "rome");
  controller.dispatch({ type: "move", target: "next" });
  assert.strictEqual(controller.state().activeKey, "paris");
  controller.dispatch({ type: "move", target: "next" });
  assert.strictEqual(controller.state().activeKey, "berlin");
  controller.dispatch({ type: "move", target: "next" });
  assert.strictEqual(controller.state().activeKey, "berlin");
});

test("select updates value and closes overlay", () => {
  const { controller, changes } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  const commands = controller.dispatch({ type: "select", optionKey: "paris" });
  assert.strictEqual(controller.state().selectedValue, "paris");
  assert.strictEqual(controller.state().open, false);
  assert.strictEqual(controller.state().dirty, true);
  assert.deepStrictEqual(changes, ["paris"]);
  assert.ok(commands.some((c) => c.type === "close-overlay"));
  assert.ok(commands.some((c) => c.type === "restore-focus"));
});

test("select disabled option is ignored", () => {
  const { controller, changes } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  controller.dispatch({ type: "select", optionKey: "london" });
  assert.strictEqual(controller.state().selectedValue, null);
  assert.deepStrictEqual(changes, []);
});

test("blur marks touched and closes", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  const commands = controller.dispatch({ type: "blur" });
  assert.strictEqual(controller.state().touched, true);
  assert.strictEqual(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "mark-touched"));
});

test("blur does not pull focus back to the trigger", () => {
  // Focus has already gone where the user sent it. Restoring it here takes it off whatever they
  // just tabbed or clicked onto, and the trigger regaining `:focus` a tick after the arrow starts
  // rotating back is what makes the close look like it stuttered.
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  const commands = controller.dispatch({ type: "blur" });
  assert.ok(commands.some((c) => c.type === "close-overlay"));
  assert.ok(!commands.some((c) => c.type === "restore-focus"), "blur must not restore focus");
});

test("Escape still restores focus — the user is still in the widget", () => {
  // The contrast that makes the rule above legible: Escape has nowhere else to send focus.
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  const commands = controller.dispatch({ type: "close", restoreFocus: true });
  assert.deepStrictEqual(commands.map((c) => c.type), ["close-overlay", "restore-focus"]);
});

test("search filters options and activates first match", () => {
  const { controller } = setup();
  const commands = controller.dispatch({ type: "search", query: "ber" });
  assert.strictEqual(controller.state().open, true);
  assert.strictEqual(controller.state().query, "ber");
  assert.strictEqual(controller.state().activeKey, "berlin");
  assert.ok(commands.some((c) => c.type === "scroll-into-view" && c.target.key === "berlin"));
});

test("view exposes ARIA contract", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
  controller.dispatch({ type: "select", optionKey: "paris" });
  const view = controller.view();
  assert.strictEqual(view.parts.trigger.role, "combobox");
  assert.strictEqual(view.parts.trigger.attributes["aria-expanded"], "false");
  assert.strictEqual(view.parts.options.role, "listbox");
  assert.strictEqual(view.parts.paris.role, "option");
  assert.strictEqual(view.parts.paris.attributes["aria-selected"], "true");
  assert.strictEqual(view.parts.rome.attributes["aria-selected"], "false");
});

test("disabled controller ignores interactions", () => {
  const controller = createSelectController({
    widgetId: "city",
    options,
    value: "paris",
    disabled: true,
  });
  controller.dispatch({ type: "open", source: "keyboard" });
  assert.strictEqual(controller.state().open, false);
  controller.dispatch({ type: "select", optionKey: "rome" });
  assert.strictEqual(controller.state().selectedValue, "paris");
});

test("option reconciliation repairs the representation and never the model", async () => {
  const { reconcileSelectValue } = await import("../dist/select/index.js");

  // A value that matches an option loosely — as one read from JSON does — takes the option's own
  // value, so the model holds what the list holds and identity comparisons work.
  const normalized = reconcileSelectValue({ value: "1", parkedValue: null }, [{ value: 1, label: "One" }]);
  assert.deepStrictEqual(normalized, { value: 1, parkedValue: null });

  // A value no option matches is kept. It is a value the form holds and the rules can judge;
  // erasing it destroys the one thing that would let the user fix it.
  const unrecognized = reconcileSelectValue({ value: "missing", parkedValue: null }, [{ value: "one", label: "One" }]);
  assert.deepStrictEqual(unrecognized, { value: "missing", parkedValue: null });

  // A value parked by an earlier version is still restored when its option arrives.
  const restored = reconcileSelectValue({ value: null, parkedValue: "missing" }, [{ value: "missing", label: "Loaded" }]);
  assert.deepStrictEqual(restored, { value: "missing", parkedValue: null });

  // Options that have not loaded are not a list that refuses the value.
  const loading = reconcileSelectValue({ value: "pending", parkedValue: null }, []);
  assert.deepStrictEqual(loading, { value: "pending", parkedValue: null });
});

test("the rendered list makes room for a value the options do not contain", async () => {
  const { optionsWithUnrecognizedValue } = await import("../dist/select/index.js");
  const options = [{ value: "one", label: "One" }, { value: "two", label: "Two" }];

  assert.deepStrictEqual(
    optionsWithUnrecognizedValue(options, "missing"),
    [{ value: "missing", label: "missing" }, ...options],
    "labelled by the value itself — the only honest name for what the list cannot name",
  );
  assert.deepStrictEqual(optionsWithUnrecognizedValue(options, "one"), options, "a known value adds nothing");
  assert.deepStrictEqual(optionsWithUnrecognizedValue(options, null), options, "and neither does no value");
  assert.deepStrictEqual(
    optionsWithUnrecognizedValue([], "pending"),
    [],
    "options that have not loaded would otherwise flash a placeholder on every load",
  );
  // There is no label hook: an application that wants a readable name gives the value an option,
  // and at that point the value is not unrecognised at all.
  assert.deepStrictEqual(
    optionsWithUnrecognizedValue([{ value: "missing", label: "Da importare" }, ...options], "missing"),
    [{ value: "missing", label: "Da importare" }, ...options],
  );
});

test("an option value that is an object is matched by identity, never by its text", async () => {
  const { optionsWithUnrecognizedValue, reconcileSelectValue } = await import("../dist/select/index.js");
  const espresso = { id: 1, name: "Espresso" };
  const cornetto = { id: 2, name: "Cornetto" };
  const options = [{ value: espresso, label: "Espresso" }];

  // Every plain object renders as "[object Object]", so a comparison through text says these two
  // entities are the same one — and the reconciliation then puts the option's entity in the model,
  // silently replacing the user's.
  const held = reconcileSelectValue({ value: cornetto, parkedValue: null }, options);
  assert.strictEqual(held.value, cornetto, "the model keeps the entity it held");

  const recognized = reconcileSelectValue({ value: espresso, parkedValue: null }, options);
  assert.strictEqual(recognized.value, espresso, "and the same entity is still recognised");

  assert.strictEqual(
    optionsWithUnrecognizedValue(options, cornetto).length,
    2,
    "an entity the list does not offer is shown, as any unrecognised value is",
  );

  // The looseness that exists for a reason survives: a value read from JSON arrives as text.
  const normalized = reconcileSelectValue({ value: "1", parkedValue: null }, [{ value: 1, label: "One" }]);
  assert.strictEqual(normalized.value, 1);
});
