/**
 * A typed schema and a document, three levels deep.
 *
 * `keyed-form` compares the two paths on one flat collection. Everything a document can say about
 * nesting — a record whose rows hold an array whose rows hold another array — was outside that
 * comparison, and it is the part where the two paths have the most room to disagree: the typed
 * schema builds descriptors directly and the document is parsed, validated and compiled first.
 *
 * This is the contract → form leg. The studio → contract leg lives in Studio's own suite, because
 * its packages are deliberately absent from the workspace root and a test is not a reason to
 * overturn that. So this says nothing about what a compiler emits — only that a document in the
 * shape one emits produces the same form a maintainer would have written by hand.
 */

import { buildDynamicFormSchema, createForm, flattenDynamicForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual, expectSameObservation } from "../../harness/assertions.mjs";
import { canonicalObservation } from "../../harness/canonical-snapshot.mjs";
import { buildSchema, NESTED_ORDERS_SPEC } from "../../models/schemas.mjs";

const DOCUMENT = Object.freeze({
  version: 3,
  id: "orders",
  schema: {
    node: "group",
    children: {
      orders: {
        node: "record",
        item: {
          node: "group",
          children: {
            ref: { node: "field", field: { kind: "text", label: "Ref", initialValue: "R" } },
            lines: {
              node: "array",
              item: {
                node: "group",
                children: {
                  sku: { node: "field", field: { kind: "text", label: "Sku", required: true } },
                  allocations: {
                    node: "array",
                    item: {
                      node: "group",
                      children: {
                        bin: { node: "field", field: { kind: "text", label: "Bin" } },
                        qty: { node: "field", field: { kind: "text", label: "Qty", initialValue: "0" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

/**
 * The same document with one row declared at every level.
 *
 * `flattenDynamicForm` walks a collection through its own `initialValue`, so what it can report is
 * what the document says exists. A document with no rows has no concrete paths, which is why the
 * empty one names only the outermost collection.
 */
function withRows(schema) {
  return {
    ...schema,
    children: {
      ...schema.children,
      orders: {
        ...schema.children.orders,
        initialValue: {
          o1: { ref: "R1", lines: [{ sku: "S1", allocations: [{ bin: "A", qty: "1" }] }] },
        },
      },
    },
  };
}

/** The same structural story both paths have to tell: build it, move it, rename over it. */
function drive(schema) {
  const form = createForm(schema, { devWarnings: false });
  form.f.orders.upsert("o1", {
    ref: "R1",
    lines: [
      { sku: "S1", allocations: [{ bin: "A", qty: "1" }] },
      { sku: "S2", allocations: [{ bin: "B", qty: "2" }, { bin: "C", qty: "3" }] },
    ],
  });
  form.f.orders.upsert("o2", { ref: "R2", lines: [] });
  form.f.orders.row("o1").lines.move(0, 1);
  form.f.orders.rename("o1", "o9");
  form.f.orders.remove("o2");
  const state = canonicalObservation({ form, collections: { orders: form.f.orders } });
  form.destroy();
  return state;
}

battle(
  {
    claims: ["DYN-001", "DYN-002", "COL-001", "COL-007", "SUB-002"],
    title: "a typed schema and a document agree three levels down",
    environments: ["node"],
  },
  async (ctx) => {
    const parsed = parseDynamicForm(DOCUMENT);
    ctx.log.note("a document nesting a record over two arrays", { diagnostics: parsed.diagnostics.length });

    expectClaim(parsed.ok && parsed.diagnostics.length === 0, {
      claimIds: ["DYN-001"],
      what: "a document nesting two positional levels does not parse",
      detail: JSON.stringify(parsed.diagnostics),
    });

    const typed = drive(buildSchema(NESTED_ORDERS_SPEC).schema);
    const fromDocument = drive(buildDynamicFormSchema(DOCUMENT.schema));

    // The control: the story has to have left a renamed order holding two reordered lines, or the
    // two paths agree about a form neither of them built.
    expectClaim(typed.collections[0].keys.length === 1 && typed.collections[0].keys[0] === "o9", {
      claimIds: ["COL-007"],
      what: "the sequence left the renamed order and nothing else",
      detail: JSON.stringify(typed.collections[0].keys),
    });

    expectSameObservation(fromDocument, typed, {
      claimIds: ["DYN-001", "COL-001", "COL-007", "SUB-002"],
      ignore: [],
      what: "the document-built form diverged from the typed one three levels down",
    });

    // The kind survives flattening. The comparison above is the stronger evidence for `DYN-002` —
    // both forms were reconstructed and agree three levels down, which is the round trip the claim
    // is about — and this is the summary a consumer reads without building anything.
    const flat = flattenDynamicForm(DOCUMENT.schema);
    const kinds = Object.fromEntries((flat.collections ?? []).map((each) => [each.path, each.kind]));
    ctx.log.note("the collections a flattened document declares", kinds);

    expectClaim(kinds["orders"] === "record", {
      claimIds: ["DYN-002"],
      what: "the keyed collection did not survive flattening as a record",
      detail: JSON.stringify(kinds),
    });

    // The summary is exhaustive over the rows the document declares, and only over those: the walk
    // descends into a collection through its own `initialValue`, so a document with no rows has no
    // concrete paths to report. That is scope rather than loss — reconstruction never reads this
    // list, which is why the two forms above agree at a depth the empty document does not mention.
    // Declared rows make every level appear.
    const seeded = flattenDynamicForm(withRows(DOCUMENT.schema));
    ctx.log.note("the collections a document with rows declares", {
      paths: seeded.collections.map((each) => each.path),
    });

    expectEqual(seeded.collections, [
      { path: "orders", kind: "record" },
      { path: "orders.o1.lines", kind: "array" },
      { path: "orders.o1.lines.0.allocations", kind: "array" },
    ], {
      claimIds: ["DYN-002"],
      what: "a document that declares its rows does not report every collection under them",
    });

    expectEqual(seeded.fields.map((each) => each.name), [
      "orders.o1.ref",
      "orders.o1.lines.0.sku",
      "orders.o1.lines.0.allocations.0.bin",
      "orders.o1.lines.0.allocations.0.qty",
    ], {
      claimIds: ["DYN-002", "SUB-002"],
      what: "the leaves under those collections are not reported, or not in schema order",
    });
  },
);
