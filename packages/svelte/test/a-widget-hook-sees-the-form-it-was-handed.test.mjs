import { test } from "node:test";
import assert from "node:assert/strict";
import { get } from "svelte/store";
import { createForm, field, useMdyField, useMdySelect } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a field hook's store follows a write to the form it was handed", async () => {
  const form = createForm({ name: field("") });
  const api = useMdyField(form.f.name, { widgetId: "name" });
  const seen = [];
  const stop = api.state.subscribe((state) => seen.push(state.value));

  form.f.name.set("Ada");
  await tick();
  stop();

  assert.deepEqual(seen, ["", "Ada"]);
  assert.equal(get(api.state).value, "Ada");
  api.destroy();
});

test("a select hook can be destroyed, like every other hook", () => {
  const api = useMdySelect({ widgetId: "pick", options: [{ value: "a", label: "A" }] });

  assert.equal(typeof api.destroy, "function");
  api.destroy();
  api.destroy();
});
