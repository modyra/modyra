import { test } from "node:test";
import assert from "node:assert/strict";
import { runCommandExecutionTests } from "@modyra/widgets/testing";
import { createVueForm, field, required } from "../dist/index.js";
import { useMdySelect, useMdyField, executeVueCommands } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("widget entrypoints expose expected symbols", () => {
  assert.equal(typeof useMdySelect, "function");
  assert.equal(typeof useMdyField, "function");
  assert.equal(typeof executeVueCommands, "function");
});

runCommandExecutionTests(test, assert, executeVueCommands, tick);

test("useMdySelect exposes reactive select API", () => {
  const api = useMdySelect({
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });

  assert.equal(api.state.open, false);
  assert.equal(api.state.selectedValue, null);
  assert.equal(api.view.parts.trigger.role, "combobox");

  const commands = api.dispatch({ type: "open", source: "keyboard" });
  assert.ok(commands.length > 0);
  assert.equal(api.state.open, true);

  api.dispatch({ type: "close", restoreFocus: true });
  assert.equal(api.state.open, false);

  api.setValue("b");
  assert.equal(api.state.selectedValue, "b");

  api.setOptions([{ value: "c", label: "C" }]);
  assert.ok(api.view.parts.c);
});

test("useMdyField exposes reactive field API", () => {
  const form = createVueForm({ email: field("", [required()]) });
  const api = useMdyField(form.f.email, { widgetId: "email", inputType: "email" });

  assert.equal(api.state.value, "");
  assert.equal(api.state.invalid, true);
  assert.equal(api.view.parts.input.attributes.type, "email");

  api.dispatch({ type: "input", value: "a@b.co" });
  assert.equal(api.state.value, "a@b.co");
  assert.equal(api.state.dirty, true);

  api.dispatch({ type: "blur" });
  assert.equal(api.state.touched, true);
  assert.equal(form.f.email.touched(), true);
});
