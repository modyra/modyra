/**
 * A path that crosses two collections mounts a real control (jsdom).
 *
 * The demo drives nested collections through handles; a document drives them through paths. This is
 * the path side: `orders.o1.lines.l1.sku` names a field inside a record inside a record's row, and
 * the mount must resolve it the way each collection is addressed — not as object properties, which
 * is what it silently did when only one level existed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const FIELDS = [
  { name: "orders.o1.customer", kind: "text", label: "Customer" },
  { name: "orders.o1.lines.l1.sku", kind: "text", label: "SKU" },
  { name: "orders.o1.lines.l1.qty", kind: "number", label: "Qty" },
];
const COLLECTIONS = [
  { path: "orders", kind: "record" },
  { path: "orders.o1.lines", kind: "record" },
];

test("a field two collections deep mounts, and typing reaches the nested cell", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const handle = mountMdyForm(container, FIELDS, { collections: COLLECTIONS, submitLabel: null });

  const input = [...container.querySelectorAll("input")].find((i) => i.id.includes("sku"));
  assert.ok(input, "no control mounted for the nested field");

  input.value = "SKU-9";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await handle.reactivity.flush();

  assert.equal(handle.form.f.orders.row("o1").lines.row("l1").sku.value(), "SKU-9");
  handle.dispose();
  container.remove();
});

test("removing the parent row leaves the nested value gone from the form's value", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const handle = mountMdyForm(container, FIELDS, { collections: COLLECTIONS, submitLabel: null });

  handle.form.f.orders.remove("o1");
  await handle.reactivity.flush();
  const value = handle.form.value();
  assert.deepEqual(value.orders ?? {}, {}, "the removed row's subtree survived in the value");
  handle.dispose();
  container.remove();
});

test("a hostile key in the middle of a path refuses the whole mount, container untouched", () => {
  const container = document.createElement("div");
  container.append(document.createElement("p"));
  assert.throws(() =>
    mountMdyForm(container, [{ name: "orders.__proto__.lines.l1.sku", kind: "text", label: "x" }], {
      collections: [
        { path: "orders", kind: "record" },
        { path: "orders.__proto__.lines", kind: "record" },
      ],
    }),
  );
  assert.equal(container.querySelectorAll("p").length, 1, "a refused mount must not clear the container");
});

test("a field three positional collections deep mounts, and typing reaches its cell", async () => {
  // The nesting above is keyed at every level, and a keyed row is seeded from an object — so it
  // never exercised the shape a list needs. A document made of arrays flattens its rows to "0",
  // "1", and a collection seeded with those digits holds no rows at all: the value was right in
  // structure and empty in fact, and the screen showed one control out of three.
  const fields = [
    { name: "orders.0.customer", kind: "text", label: "Customer" },
    { name: "orders.0.lines.0.sku", kind: "text", label: "SKU" },
    { name: "orders.0.lines.0.allocations.0.qty", kind: "number", label: "Qty" },
  ];
  const collections = [
    { path: "orders", kind: "array" },
    { path: "orders.0.lines", kind: "array" },
    { path: "orders.0.lines.0.allocations", kind: "array" },
  ];
  const container = document.createElement("div");
  document.body.append(container);
  const handle = mountMdyForm(container, fields, { collections, submitLabel: null });

  const mounted = [...container.querySelectorAll("input")].map((i) => i.id);
  assert.equal(mounted.length, 3, `expected a control per field, mounted ${mounted.join(", ")}`);

  const qty = [...container.querySelectorAll("input")].find((i) => i.id.includes("qty"));
  qty.value = "7";
  qty.dispatchEvent(new window.Event("input", { bubbles: true }));
  await handle.reactivity.flush();

  assert.deepEqual(handle.form.getValue().orders, [
    { customer: "", lines: [{ sku: "", allocations: [{ qty: 7 }] }] },
  ]);
  handle.dispose();
  container.remove();
});
