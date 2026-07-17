import { effectScope, computed as vueComputed } from "@vue/reactivity";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createVueForm, field, required, useVueForm } from "../dist/index.js";

test("form state participates in Vue reactivity", () => {
  const form = createVueForm({ email: field("", [required()]) });
  // A Vue computed over form state re-evaluates when the field changes.
  const label = vueComputed(() =>
    form.f.email.valid() ? "ok" : `${form.f.email.errors().length} errors`,
  );
  assert.equal(label.value, "1 errors");
  form.f.email.set("a@b.co");
  assert.equal(label.value, "ok");
  assert.equal(form.state.valid(), true);
});

test("effects (async validators) run on the Vue graph", async () => {
  const form = createVueForm({
    user: field("", [], {
      asyncValidators: [async (v) => (v === "taken" ? ["Name taken"] : [])],
    }),
  });
  form.f.user.set("taken");
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(form.f.user.errors().map((e) => e.message), ["Name taken"]);
});

test("useVueForm auto-destroys when scope is disposed", () => {
  const scope = effectScope();
  const form = scope.run(() => useVueForm({ email: field("", [required()]) }));
  assert.ok(form);
  assert.equal(form?.destroyed, false);
  scope.stop();
  assert.equal(form?.destroyed, true);
});
