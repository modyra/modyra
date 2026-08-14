import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemo, createRoot } from "solid-js";
import { createSolidForm, field, required, useSolidForm } from "../dist/index.js";
import { array, createForm, group, record } from "../../core/dist/index.js";
import { solidReactivity } from "../dist/reactivity.js";

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

/**
 * A collection row declares every cell it has.
 *
 * Solid's computations run eagerly, so a row registered one cell at a time was read between two of
 * them — a row holding some of its cells, which is a shape the schema does not describe, and a read
 * that raised. One cell hid it; two is what any form ships. The whole adapter suite ran under
 * `--conditions=browser` without ever declaring a collection.
 */
test("a keyed row with several cells is declared, and reads back whole", () => {
  const form = createForm(
    { rows: record(group({ code: field(""), note: field(""), qty: field(0) })) },
    { reactivity: solidReactivity() },
  );

  form.f.rows.upsert("a", { code: "A" });

  assert.deepEqual(form.getValue().rows.a, { code: "A", note: "", qty: 0 });
  assert.deepEqual([...form.f.rows.keys()], ["a"]);
  form.destroy();
});

test("a positional row with several cells is declared, and reads back whole", () => {
  const form = createForm(
    { items: array(group({ code: field(""), note: field("") })) },
    { reactivity: solidReactivity() },
  );

  form.f.items.push({ code: "A", note: "N" });

  assert.deepEqual(form.getValue().items, [{ code: "A", note: "N" }]);
  assert.equal(form.f.items.length(), 1);
  form.destroy();
});
