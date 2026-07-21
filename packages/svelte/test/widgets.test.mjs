import { test } from "node:test";
import assert from "node:assert/strict";
import { get } from "svelte/store";
import { runCommandExecutionTests } from "@modyra/widgets/testing";
import { createSvelteForm, field, required } from "../dist/index.js";
import { useMdySelect, useMdyField, executeSvelteCommands } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("widget entrypoints expose expected symbols", () => {
  assert.equal(typeof useMdySelect, "function");
  assert.equal(typeof useMdyField, "function");
  assert.equal(typeof executeSvelteCommands, "function");
});

runCommandExecutionTests(test, assert, executeSvelteCommands, tick);

test("useMdySelect exposes reactive select stores", async () => {
  const api = useMdySelect({
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });

  assert.equal(get(api.state).open, false);
  assert.equal(get(api.state).selectedValue, null);
  assert.equal(get(api.view).parts.trigger.role, "combobox");

  const commands = api.dispatch({ type: "open", source: "keyboard" });
  assert.ok(commands.length > 0);
  await tick();
  assert.equal(get(api.state).open, true);

  api.dispatch({ type: "close", restoreFocus: true });
  await tick();
  assert.equal(get(api.state).open, false);

  api.setValue("b");
  await tick();
  assert.equal(get(api.state).selectedValue, "b");

  api.setOptions([{ value: "c", label: "C" }]);
  await tick();
  assert.ok(get(api.view).parts.c);
});

test("useMdyField exposes reactive field stores", async () => {
  const form = createSvelteForm({ email: field("", [required()]) });
  const api = useMdyField(form.f.email, { widgetId: "email", inputType: "email" });

  assert.equal(get(api.state).value, "");
  assert.equal(get(api.state).invalid, true);
  assert.equal(get(api.view).parts.input.attributes.type, "email");

  api.dispatch({ type: "input", value: "a@b.co" });
  await tick();
  assert.equal(get(api.state).value, "a@b.co");
  assert.equal(get(api.state).dirty, true);

  api.dispatch({ type: "blur" });
  await tick();
  assert.equal(get(api.state).touched, true);
  assert.equal(form.f.email.touched(), true);
});
