/**
 * What survives a renderer's own lifecycle.
 *
 * A cell is disposed while its row is being edited, a whole mount is torn down mid-edit: neither is
 * an edit, and neither may take a value with it. The row belongs to the form, and the form outlives
 * whatever happens to be drawing it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField, mountMdyForm } = await import("../dist/index.js");
const { createForm, field, group, record, vanillaReactivity } = await import("@modyra/core");

const column = () => {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

test("disposing a cell mid-edit keeps what was typed", async () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { rows: record(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );
  form.f.rows.upsert("a", { name: "Espresso", qty: 2 });

  const host = column();
  const dispose = renderField(host, { name: "cell", kind: "text" }, form.f.rows.cell("a", "name"), rx);
  const input = host.querySelector("input");
  input.value = "Ristretto";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await rx.flush();

  dispose();
  host.remove();

  assert.equal(form.value().rows.a.name, "Ristretto", "the edit is the form's, not the control's");
  assert.equal(form.f.rows.has("a"), true);
});

test("a whole mount torn down leaves the collection standing", async () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { rows: record(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );
  form.f.rows.setAll({ a: { name: "one", qty: 1 }, b: { name: "two", qty: 2 } });

  const host = column();
  const mounted = mountMdyForm(host, [{ name: "unrelated", kind: "text", label: "Other" }]);
  const cellDispose = renderField(host, { name: "cell", kind: "text" }, form.f.rows.cell("b", "name"), rx);

  mounted.dispose();
  cellDispose();

  assert.deepEqual([...form.f.rows.keys()], ["a", "b"]);
  assert.equal(form.value().rows.b.name, "two");
});

test("a cell rendered twice and disposed once still reads the row", async () => {
  const rx = vanillaReactivity();
  const form = createForm({ rows: record(group({ name: field("") })) }, { reactivity: rx });
  form.f.rows.upsert("a", { name: "shared" });

  const first = column();
  const second = column();
  const disposeFirst = renderField(first, { name: "c1", kind: "text" }, form.f.rows.cell("a", "name"), rx);
  renderField(second, { name: "c2", kind: "text" }, form.f.rows.cell("a", "name"), rx);

  disposeFirst();
  first.remove();

  const remaining = second.querySelector("input");
  assert.equal(remaining.value, "shared", "the column still on screen is unaffected");

  form.f.rows.cell("a", "name").set("changed");
  await rx.flush();
  assert.equal(remaining.value, "changed", "and still follows the row");
});
