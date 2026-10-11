import { test } from "node:test";
import assert from "node:assert/strict";
import { createForm, createVueForm, field, useMdyField, useMdySelect } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a field hook given a handle from a form on another runtime sees its writes", async () => {
  const form = createForm({ name: field("") });
  const api = useMdyField(form.f.name, { widgetId: "name" });

  form.f.name.set("Ada");
  await tick();

  assert.equal(api.state.value, "Ada");
  api.destroy();
});

test("a field hook's destroy releases what it started, with no owner to do it", async () => {
  const form = createVueForm({ name: field("") });
  const api = useMdyField(form.f.name, { widgetId: "name" });

  api.destroy();
  form.f.name.set("Ada");
  await tick();

  assert.equal(api.state.value, "");
});

test("a select hook can be destroyed, and stops following its controller", async () => {
  const api = useMdySelect({
    widgetId: "pick",
    options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
  });

  assert.equal(typeof api.destroy, "function");
  api.destroy();
  api.destroy();
  api.setValue("b");
  await tick();

  assert.equal(api.state.selectedValue, null);
});
