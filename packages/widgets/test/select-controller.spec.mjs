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

test("open intent opens listbox and activates first enabled option", () => {
  const { controller } = setup();
  const commands = controller.dispatch({ type: "open", source: "keyboard" });
  assert.strictEqual(controller.state().open, true);
  assert.strictEqual(controller.state().activeKey, "rome");
  assert.ok(commands.some((c) => c.type === "open-overlay"));
  assert.ok(commands.some((c) => c.type === "scroll-into-view" && c.target.key === "rome"));
});

test("move next wraps within enabled options and skips disabled", () => {
  const { controller } = setup();
  controller.dispatch({ type: "open", source: "keyboard" });
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
  assert.strictEqual(view.parts.trigger.attributes["aria-expanded"], false);
  assert.strictEqual(view.parts.listbox.role, "listbox");
  assert.strictEqual(view.parts.paris.role, "option");
  assert.strictEqual(view.parts.paris.attributes["aria-selected"], true);
  assert.strictEqual(view.parts.rome.attributes["aria-selected"], false);
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
