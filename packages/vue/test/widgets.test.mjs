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

test("useMdySelect exposes reactive select API", async () => {
  const api = useMdySelect({
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });

  assert.equal(api.state.open, false);
  assert.equal(api.state.selectedValue, null);
  assert.equal(api.view.parts.trigger.role, "combobox");

  // useMdySelect syncs api.state from an internal reactivity.effect() —
  // now that Vue's effect() is microtask-scheduled (real batch()/flush()
  // instead of always-synchronous), state.* only reflects a dispatch()
  // after that microtask settles. Same tick() already imported above for
  // runCommandExecutionTests.
  const commands = api.dispatch({ type: "open", source: "keyboard" });
  assert.ok(commands.length > 0);
  await tick();
  assert.equal(api.state.open, true);

  api.dispatch({ type: "close", restoreFocus: true });
  await tick();
  assert.equal(api.state.open, false);

  api.setValue("b");
  await tick();
  assert.equal(api.state.selectedValue, "b");

  api.setOptions([{ value: "c", label: "C" }]);
  await tick();
  assert.ok(api.view.parts.c);
});

test("useMdyField exposes reactive field API", async () => {
  const form = createVueForm({ email: field("", [required()]) });
  const api = useMdyField(form.f.email, { widgetId: "email", inputType: "email" });

  assert.equal(api.state.value, "");
  assert.equal(api.state.invalid, true);
  assert.equal(api.view.parts.input.attributes.type, "email");

  // Same reasoning as the select test above: api.state syncs via an
  // internal effect, now microtask-scheduled.
  api.dispatch({ type: "input", value: "a@b.co" });
  await tick();
  assert.equal(api.state.value, "a@b.co");
  assert.equal(api.state.dirty, true);

  api.dispatch({ type: "blur" });
  await tick();
  assert.equal(api.state.touched, true);
  assert.equal(form.f.email.touched(), true);
});
