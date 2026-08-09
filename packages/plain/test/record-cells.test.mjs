/**
 * A record rendered cell by cell, in the shape a table produces.
 *
 * The controls of one row are mounted in different containers and at different times — which is what
 * a table rendering column by column does, and the case an indexed collection cannot serve. What is
 * asserted here is that the renderer needs to know nothing about it: it is handed a cell handle,
 * and the row it belongs to may arrive before or after.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, group, record, vanillaReactivity } = await import("@modyra/core");

const nameCell = (key) => ({ name: `name-${key}`, kind: "text", label: "Name" });
const qtyCell = (key) => ({ name: `qty-${key}`, kind: "number", label: "Qty" });

function column() {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
}

const inputOf = (container) => container.querySelector("input");

test("two columns render two cells of the same row, each in its own container", () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { rows: record(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );
  form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });

  const names = column();
  const quantities = column();
  renderField(names, nameCell("a3f9"), form.f.rows.cell("a3f9", "name"), rx);
  renderField(quantities, qtyCell("a3f9"), form.f.rows.cell("a3f9", "qty"), rx);

  assert.equal(inputOf(names).value, "Espresso");
  assert.equal(inputOf(quantities).value, "2");

  inputOf(names).value = "Ristretto";
  inputOf(names).dispatchEvent(new window.Event("input", { bubbles: true }));

  assert.equal(form.value().rows.a3f9.name, "Ristretto", "a cell writes into its row");
});

test("a cell rendered before its row is declared is empty, then follows the row", async () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { rows: record(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );

  const names = column();
  renderField(names, nameCell("late"), form.f.rows.cell("late", "name"), rx);

  assert.equal(inputOf(names).value, "", "nothing to show, and no row brought into being");
  assert.deepEqual(form.value().rows, {});

  form.f.rows.upsert("late", { name: "arrived", qty: 1 });
  await rx.flush();

  assert.equal(inputOf(names).value, "arrived", "the control binds when the row arrives");
});

test("unmounting a column keeps the values it was showing", () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { rows: record(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );
  form.f.rows.upsert("a", { name: "kept", qty: 7 });

  const names = column();
  const dispose = renderField(names, nameCell("a"), form.f.rows.cell("a", "name"), rx);
  dispose();
  names.remove();

  assert.equal(form.value().rows.a.name, "kept");
  assert.equal(form.f.rows.has("a"), true);
});

test("removing the row empties the cells still on screen", async () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { rows: record(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );
  form.f.rows.upsert("a", { name: "doomed", qty: 1 });

  const names = column();
  renderField(names, nameCell("a"), form.f.rows.cell("a", "name"), rx);
  assert.equal(inputOf(names).value, "doomed");

  form.f.rows.remove("a");
  await rx.flush();

  assert.equal(inputOf(names).value, "", "the control follows the row out of existence");
  assert.deepEqual(form.value().rows, {});
});
