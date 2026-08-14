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
const { array, createLitForm, field, group, record } = await import("../dist/adapter.js");
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

test("an element bound inside a list inside a list follows a reorder above it", async () => {
  // The keyed case above is the one the elements were written against. A positional level names its
  // rows by where they sit, so a move at the outer level rebuilds everything below it — and a cell
  // handle taken before the move has to keep addressing the row it was taken from.
  const form = createLitForm({
    orders: array(group({
      customer: field(""),
      lines: array(group({ sku: field("") })),
    })),
  });
  form.f.orders.push({ customer: "Ada", lines: [{ sku: "A-1" }] });
  form.f.orders.push({ customer: "Grace", lines: [{ sku: "G-1" }] });

  const cell = await mount("mdy-text-field", (el) => {
    el.field = form.f.orders.at(0).lines.at(0).sku;
  });
  assert.equal(inputOf(cell).value, "A-1");

  form.f.orders.move(0, 1);
  await settled(cell);

  // Position 0 now holds Grace's order, and the element bound to position 0 shows its line.
  assert.deepEqual(form.value().orders.map((o) => o.customer), ["Grace", "Ada"]);
  assert.equal(inputOf(cell).value, "G-1");

  inputOf(cell).value = "G-typed";
  inputOf(cell).dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(form.value().orders[0].lines[0].sku, "G-typed");
});
