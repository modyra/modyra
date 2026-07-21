import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemo, createRoot } from "solid-js";
import { createSolidForm, field, required, useSolidForm } from "../dist/index.js";

test("form state participates in Solid reactivity", () => {
  createRoot((dispose) => {
    const form = createSolidForm({ email: field("", [required()]) });
    // A Solid memo over form state re-evaluates when the field changes.
    const label = createMemo(() =>
      form.f.email.valid() ? "ok" : `${form.f.email.errors().length} errors`,
    );
    assert.equal(label(), "1 errors");
    form.f.email.set("a@b.co");
    assert.equal(label(), "ok");
    assert.equal(form.state.valid(), true);
    dispose();
  });
});

test("effects (async validators) run on the Solid graph", async () => {
  const form = createSolidForm({
    user: field("", [], {
      asyncValidators: [async (v) => (v === "taken" ? ["Name taken"] : [])],
    }),
  });
  form.f.user.set("taken");
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(form.f.user.errors().map((e) => e.message), ["Name taken"]);
});

test("useSolidForm auto-destroys when its owner is disposed", () => {
  let form;
  const dispose = createRoot((d) => {
    form = useSolidForm({ email: field("", [required()]) });
    return d;
  });
  assert.ok(form);
  assert.equal(form.destroyed, false);
  dispose();
  assert.equal(form.destroyed, true);
});
