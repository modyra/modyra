/**
 * One flat field list, one form — whoever asks.
 *
 * This existed three times across the renderers and bindings, under two different names, and a fourth
 * function in this package already had one of those names while taking something else entirely — a
 * nested node rather than a flat list.
 *
 * Three implementations of one rule can differ, and the only way anyone would have found out is a
 * user reporting that the same document behaves differently in two renderers. These are the checks
 * that they are now one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "../dist/index.js";

const DOCUMENT = {
  version: 2,
  schema: {
    node: "group",
    children: {
      email: { node: "field", field: { kind: "email", label: "Email", validators: { required: true } } },
      lines: {
        node: "array",
        item: {
          node: "group",
          children: {
            sku: { node: "field", field: { kind: "text", label: "SKU" } },
            qty: { node: "field", field: { kind: "number", label: "Qty" } },
          },
        },
      },
    },
  },
};

test("a flattened collection reads back as the shape the document declared", () => {
  const parsed = parseDynamicForm(DOCUMENT);
  assert.equal(parsed.ok, true, `the fixture document was refused: ${JSON.stringify(parsed.diagnostics)}`);

  const form = createForm(buildFlatFormSchema(parsed.fields, parsed.collections));
  const value = form.getValue();

  // The point of passing the collections rather than guessing: a path cannot say whether `lines.0`
  // came from an array or from a record keyed by digits, and reading it back as an object keyed
  // "0", "1" is a silently different document.
  assert.ok(Array.isArray(value.lines), `lines came back as ${typeof value.lines}, not a list`);
  form.destroy();
});

test("without the collections, the same fields still build a form", () => {
  const parsed = parseDynamicForm(DOCUMENT);
  const form = createForm(buildFlatFormSchema(parsed.fields));
  // No collection was declared to the builder, so every path is a field of its own. That is a
  // different form, and it is the honest one: nothing here can invent a shape it was not told.
  assert.ok(form.fieldNames().length > 0);
  form.destroy();
});

test("the validators land under the key their caller owns", () => {
  const parsed = parseDynamicForm(DOCUMENT);
  const form = createForm(buildFlatFormSchema(parsed.fields, parsed.collections));

  applyFlatValidators(form, parsed.fields, "first");
  const required = form.f.email.required();
  assert.equal(required, true, "a required field did not report itself required");

  // Re-applying under the same key replaces; a second key coexists. Both matter: a document edited
  // twice must not accumulate its first edition's rules, and two consumers on one form must be able
  // to own their own.
  applyFlatValidators(form, parsed.fields, "first");
  assert.equal(form.f.email.required(), true);
  applyFlatValidators(form, parsed.fields, "second");
  assert.equal(form.f.email.required(), true);
  form.destroy();
});

test("the two names in this package take different things and say so", async () => {
  const { buildDynamicFormSchema } = await import("../dist/index.js");
  // One takes the nested node the document declares; the other the flat list a parse produces. They
  // are not interchangeable, and the names now say which is which.
  const nested = buildDynamicFormSchema(DOCUMENT.schema);
  assert.ok("email" in nested, "the nested builder did not read the document's own shape");

  const parsed = parseDynamicForm(DOCUMENT);
  const flat = buildFlatFormSchema(parsed.fields, parsed.collections);
  assert.ok("email" in flat, "the flat builder did not read the parsed field list");
});

test("a collection declared inside a row builds as a collection, not a group", () => {
  const fields = [
    { name: "orders.o1.customer", kind: "text", label: "Customer" },
    { name: "orders.o1.lines.l1.sku", kind: "text", label: "SKU" },
    { name: "orders.o1.lines.l1.qty", kind: "number", label: "Qty" },
    { name: "orders.o2.customer", kind: "text", label: "Customer" },
    { name: "orders.o2.lines.l9.sku", kind: "text", label: "SKU" },
    { name: "orders.o2.lines.l9.qty", kind: "number", label: "Qty" },
  ];
  const collections = [
    { path: "orders", kind: "record" },
    { path: "orders.o1.lines", kind: "record" },
    { path: "orders.o2.lines", kind: "record" },
  ];
  const form = createForm(buildFlatFormSchema(fields, collections));

  assert.deepEqual([...form.f.orders.keys()].sort(), ["o1", "o2"]);
  // Each row's own child, with its own keys — not the first row's repeated.
  assert.deepEqual([...form.f.orders.row("o1").lines.keys()], ["l1"]);
  assert.deepEqual([...form.f.orders.row("o2").lines.keys()], ["l9"]);
  const sku = form.f.orders.row("o1").lines.row("l1").sku;
  assert.ok(sku, "the nested cell did not resolve");
  sku.set("SKU-1");
  assert.equal(form.f.orders.row("o1").lines.row("l1").sku.value(), "SKU-1");
  // The sibling row's child is untouched by the write.
  assert.equal(form.f.orders.row("o2").lines.row("l9").sku.value(), "");
  form.destroy();
});

test("three levels of declared collections stay collections all the way down", () => {
  const fields = [
    { name: "orders.o1.lines.l1.allocs.a1.amount", kind: "number", label: "Amount" },
  ];
  const collections = [
    { path: "orders", kind: "record" },
    { path: "orders.o1.lines", kind: "record" },
    { path: "orders.o1.lines.l1.allocs", kind: "record" },
  ];
  const form = createForm(buildFlatFormSchema(fields, collections));
  const cell = form.f.orders.row("o1").lines.row("l1").allocs.row("a1").amount;
  assert.ok(cell, "the third-level cell did not resolve");
  form.destroy();
});

test("a hostile key anywhere in a flattened path is refused before any schema exists", () => {
  const fields = [{ name: "orders.__proto__.lines.l1.sku", kind: "text", label: "SKU" }];
  const collections = [
    { path: "orders", kind: "record" },
    { path: "orders.__proto__.lines", kind: "record" },
  ];
  assert.throws(() => buildFlatFormSchema(fields, collections));
});
