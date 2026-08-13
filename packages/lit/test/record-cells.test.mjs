/**
 * A record rendered cell by cell with the Lit elements.
 *
 * The element is handed a cell handle and nothing else — it does not know which row it belongs to,
 * nor whether that row exists yet. Two elements of the same row are mounted separately here, which
 * is the arrangement a table rendering column by column produces.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, group, record } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const schema = () => ({ rows: record(group({ name: field(""), qty: field(0) })) });
const inputOf = (element) => element.querySelector("input");
/** Effects on the vanilla graph settle on a macrotask; the element re-renders after that. */
const settled = async (element) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
};

test("two elements render two cells of one row, mounted apart", async () => {
  const form = createLitForm(schema());
  form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });

  const nameCell = await mount("mdy-text-field", (el) => {
    el.field = form.f.rows.cell("a3f9", "name");
  });
  const qtyCell = await mount("mdy-number-field", (el) => {
    el.field = form.f.rows.cell("a3f9", "qty");
  });

  assert.equal(inputOf(nameCell).value, "Espresso");
  assert.equal(inputOf(qtyCell).value, "2");

  inputOf(nameCell).value = "Ristretto";
  inputOf(nameCell).dispatchEvent(new window.Event("input", { bubbles: true }));

  assert.equal(form.value().rows.a3f9.name, "Ristretto");
});

test("an element mounted before its row waits, and binds when the row arrives", async () => {
  const form = createLitForm(schema());

  const cell = await mount("mdy-text-field", (el) => {
    el.field = form.f.rows.cell("late", "name");
  });

  assert.equal(inputOf(cell).value, "", "empty, and no row was created by rendering it");
  assert.deepEqual(form.value().rows, {});

  form.f.rows.upsert("late", { name: "arrived", qty: 1 });
  await settled(cell);

  assert.equal(inputOf(cell).value, "arrived");
});

test("removing the row empties an element still mounted on it", async () => {
  const form = createLitForm(schema());
  form.f.rows.upsert("a", { name: "doomed", qty: 1 });

  const cell = await mount("mdy-text-field", (el) => {
    el.field = form.f.rows.cell("a", "name");
  });
  assert.equal(inputOf(cell).value, "doomed");

  form.f.rows.remove("a");
  await settled(cell);

  assert.equal(inputOf(cell).value, "");
  assert.deepEqual(form.value().rows, {});
});

test("an element bound two collections deep follows its own row's subtree", async () => {
  const form = createLitForm({
    orders: record(group({
      customer: field(""),
      lines: record(group({ sku: field(""), qty: field(0) })),
    })),
  });
  form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "SKU-1", qty: 2 } } });

  const cell = await mount("mdy-text-field", (el) => {
    el.field = form.f.orders.row("o1").lines.row("l1").sku;
  });
  assert.equal(inputOf(cell).value, "SKU-1");

  inputOf(cell).value = "SKU-typed";
  inputOf(cell).dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(form.value().orders.o1.lines.l1.sku, "SKU-typed");

  // Removing the order takes the subtree; the mounted element goes inert rather than throwing.
  form.f.orders.remove("o1");
  await settled(cell);
  assert.deepEqual(form.value().orders, {});
});
