import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseDynamicForm } from "../../core/dist/dynamic-config.js";
import { compileToContract } from "../dist/index.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

test("checkout compiles to a strict-valid Contract v2, with its unmappable pieces reported (not silently dropped)", () => {
  const { contract, diagnostics } = compileToContract(createCheckoutProject());

  assert.ok(contract, "expected a non-null contract");
  assert.equal(contract.version, 2);
  assert.equal(contract.schema.node, "group");

  // The form validator (items.length >= 1) is carried, not dropped: the contract gained a
  // `validations` slot precisely so a cross-field rule with a message has somewhere to go.
  assert.ok(!diagnostics.some((d) => d.validatorId === "val_items_min_one"), "no longer unsupported");
  assert.equal(contract.validations?.length, 1);
  assert.equal(contract.validations[0].message, createCheckoutProject().formValidators[0].message);
  // Node ids do not survive the boundary; the condition is stated in paths a form can read.
  assert.equal(JSON.stringify(contract.validations[0].when).includes("nodeId"), false);

  // The coupon's server validator still has no Contract v2 equivalent — a target-generation concern,
  // not schema data — and must be reported rather than silently dropped.
  assert.ok(diagnostics.some((d) => d.code === "UNSUPPORTED_FEATURE" && d.validatorId === "val_coupon_server"));

  // No error-severity diagnostics — checkout is a valid, compilable project.
  assert.deepEqual(
    diagnostics.filter((d) => d.severity === "error"),
    [],
  );

  // Independent re-verification against the parser (not just trusting compileToContract's word for it).
  const reparsed = parseDynamicForm(contract, { mode: "strict" });
  assert.equal(reparsed.ok, true);
  assert.deepEqual(reparsed.diagnostics, []);
});

test("checkout's array row (items.initialRows has one seeded row) flattens to indexed paths", () => {
  const { contract } = compileToContract(createCheckoutProject());
  const reparsed = parseDynamicForm(contract, { mode: "strict" });
  const names = reparsed.fields.map((f) => f.name).sort();
  // flattenDynamicSchema expands array rows by index, one row seeded in the fixture's initialRows.
  assert.deepEqual(names, ["country", "coupon", "items.0.qty", "items.0.sku", "shipping.city", "shipping.zip"]);
});

test("a select field with no options is reported UNCOMPILABLE_FIELD and blocks compilation", () => {
  const project = createCheckoutProject();
  project.schema.children.find((n) => n.id === "nd_country").options = [];

  const { contract, diagnostics } = compileToContract(project);

  assert.equal(contract, null);
  assert.ok(diagnostics.some((d) => d.code === "UNCOMPILABLE_FIELD" && d.nodeId === "nd_country"));
  // studio-model's own standing diagnostic for the same root cause is present too.
  assert.ok(diagnostics.some((d) => d.code === "SELECT_WITHOUT_OPTIONS" && d.nodeId === "nd_country"));
});

test("oneOf/eachOneOf/customRef validators are reported unsupported but don't block compilation", () => {
  const project = createCheckoutProject();
  project.schema.children.find((n) => n.id === "nd_country").validators.push({
    id: "val_country_oneof",
    kind: "oneOf",
  });

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, "unsupported validators are warnings, not blockers");
  assert.ok(diagnostics.some((d) => d.code === "UNSUPPORTED_VALIDATOR" && d.validatorId === "val_country_oneof"));
});

test("array validator min/max map to minItems/maxItems; other kinds are reported unsupported", () => {
  const project = createCheckoutProject();
  const items = project.schema.children.find((n) => n.id === "nd_items");
  items.validators.push({ id: "val_items_min", kind: "min", value: 1 });
  items.validators.push({ id: "val_items_custom", kind: "customRef" });

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract);
  const itemsNode = contract.schema.children.items;
  assert.equal(itemsNode.node, "array");
  assert.equal(itemsNode.minItems, 1);
  assert.ok(diagnostics.some((d) => d.code === "UNSUPPORTED_VALIDATOR" && d.validatorId === "val_items_custom"));
});

test("a non-group schema root is diagnosed and blocks compilation", () => {
  const project = createCheckoutProject();
  project.schema = {
    node: "field",
    id: "nd_root_field",
    name: "root",
    fieldKind: "text",
    valueType: "string",
    initialValue: "",
    validators: [],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.equal(contract, null);
  assert.ok(diagnostics.some((d) => d.code === "ROOT_MUST_BE_GROUP"));
});

test("package depends only on the workspace's own studio-model and core (no external runtime deps)", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["@modyra/core", "@modyra/studio-model"]);
});

test("a layout that cannot compile is dropped, never the form", async () => {
  // A layout slot pointing at a deleted node used to make the whole contract null, which is
  // what put "The live form is unavailable" on screen for a purely cosmetic problem.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [
      { kind: "columns", id: "row", columns: [[{ nodeId: "nd_city" }], [{ nodeId: "nd_gone" }]] },
    ],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, "the form must still compile");
  assert.equal(contract.layout, undefined, "the unusable row is omitted");
  assert.ok(diagnostics.some((d) => d.code === "LAYOUT_UNKNOWN_NODE" && d.severity === "warning"));
  assert.ok(!diagnostics.some((d) => d.severity === "error"));
});

test("a valid layout compiles node IDs into Contract field names", async () => {
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{ kind: "columns", id: "row", columns: [[{ nodeId: "nd_city" }], [{ nodeId: "nd_zip" }]] }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract);
  assert.deepEqual(contract.layout, [
    { kind: "columns", id: "row", columns: [["shipping.city"], ["shipping.zip"]] },
  ]);
  assert.ok(!diagnostics.some((d) => d.severity === "error"));
});

test("a group in a column occupies one column, as a section", async () => {
  // The row has to hold the group as a single child. Expanding it to `shipping.city` and
  // `shipping.zip` would put two things in a cell built for one, and the group would stop existing
  // in the contract the renderer draws — which is why a group could never be put beside a control.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{ kind: "columns", id: "row", columns: [[{ nodeId: "nd_country" }], [{ nodeId: "nd_shipping" }]] }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract);
  assert.deepEqual(contract.layout, [
    {
      kind: "columns",
      id: "row",
      columns: [
        ["country"],
        [{ kind: "section", id: "nd_shipping", label: "Shipping address", children: ["shipping.city", "shipping.zip"] }],
      ],
    },
  ]);
  assert.ok(!diagnostics.some((d) => d.severity === "error"));
});

test("a group slot keeps its identity outside a row too", async () => {
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{ kind: "section", id: "sec", label: "Where", children: [{ nodeId: "nd_shipping" }] }],
  };

  const { contract } = compileToContract(project);

  assert.ok(contract);
  assert.deepEqual(contract.layout, [
    {
      kind: "section",
      id: "sec",
      label: "Where",
      children: [
        { kind: "section", id: "nd_shipping", label: "Shipping address", children: ["shipping.city", "shipping.zip"] },
      ],
    },
  ]);
});

test("a per-breakpoint placement raises the contract to v3; nothing else does", async () => {
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{
      kind: "columns",
      id: "row",
      columns: [[{ nodeId: "nd_country" }], [{ nodeId: "nd_coupon", at: { base: { hidden: true }, md: { column: 2 } } }]],
      at: { sm: 2 },
    }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, JSON.stringify(diagnostics));
  assert.equal(contract.version, 3, "a slot that places itself needs v3 to say so");
  assert.deepEqual(contract.layout, [{
    kind: "columns",
    id: "row",
    columns: [["country"], [{ ref: "coupon", at: { base: { hidden: true }, md: { column: 2 } } }]],
    at: { sm: 2 },
  }]);
  assert.ok(!diagnostics.some((d) => d.severity === "error"));
});

test("a row's track counts ride v2, so an unplaced form stays a v2 document", async () => {
  // The version is the lowest one that can say what the project says. Authoring a breakpoint count
  // is v2's own feature, so it must not drag a form onto v3 and every reader of it with it.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{ kind: "columns", id: "row", columns: [[{ nodeId: "nd_city" }], [{ nodeId: "nd_zip" }]], at: { sm: 2 } }],
  };

  const { contract } = compileToContract(project);

  assert.ok(contract);
  assert.equal(contract.version, 2);
  assert.deepEqual(contract.layout[0].at, { sm: 2 });
});

test("placement a row could not honour is dropped, never the form", async () => {
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{
      kind: "columns",
      id: "row",
      // A count past the row's two tracks, and a size that says nothing: both are what a
      // half-finished edit in the canvas leaves behind, and neither may take the form down.
      columns: [[{ nodeId: "nd_city" }], [{ nodeId: "nd_zip", at: { sm: {} } }]],
      at: { sm: 9 },
    }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, JSON.stringify(diagnostics));
  assert.equal(contract.version, 2, "nothing placeable survived, so nothing needed v3");
  assert.equal(contract.layout[0].at, undefined);
  assert.deepEqual(contract.layout[0].columns, [["shipping.city"], ["shipping.zip"]]);
});

test("a group in a row can be hidden at a size, and the placement rides its section", async () => {
  // In a row the section *is* the column, so the placement belongs on it. Without this, Studio could
  // author "hide this group on a phone" and the compiler would drop it without a word.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{
      kind: "columns",
      id: "row",
      columns: [[{ nodeId: "nd_country" }], [{ nodeId: "nd_shipping", at: { base: { hidden: true } } }]],
    }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, JSON.stringify(diagnostics));
  assert.equal(contract.version, 3);
  assert.deepEqual(contract.layout[0].columns[1][0], {
    kind: "section",
    id: "nd_shipping",
    label: "Shipping address",
    children: ["shipping.city", "shipping.zip"],
    at: { base: { hidden: true } },
  });
});

test("placement outside a row is dropped, not compiled into a contract nothing accepts", async () => {
  // A project whose row was later turned back into a section keeps the override in its slot. The
  // Contract refuses `at` outside a row, so emitting it would fail the strict parse and cost the
  // author their whole layout — over an override that could never have been seen.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{ kind: "section", id: "sec", children: [{ nodeId: "nd_city", at: { md: { hidden: true } } }] }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, JSON.stringify(diagnostics));
  assert.equal(contract.version, 2);
  assert.deepEqual(contract.layout, [{ kind: "section", id: "sec", children: ["shipping.city"] }]);
  assert.ok(!diagnostics.some((d) => d.code === "LAYOUT_DROPPED"), "the layout must survive");
});

test("a column the row no longer has is trimmed, and the version falls back with it", async () => {
  // A row narrows whenever a field is deleted from it, and every other slot's `column` keeps
  // pointing past its end. The Contract refuses that, so leaving it in place would take the whole
  // layout down; and once the last placement is gone, nothing in the document needs v3 any more.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{
      kind: "columns",
      id: "row",
      columns: [
        [{ nodeId: "nd_country" }],
        [{ nodeId: "nd_coupon", at: { md: { column: 4 }, lg: { column: 2, hidden: true } } }],
      ],
    }],
  };

  const { contract, diagnostics } = compileToContract(project);

  assert.ok(contract, JSON.stringify(diagnostics));
  assert.equal(contract.version, 3, "lg still says something a row can honour");
  assert.deepEqual(contract.layout[0].columns[1][0], { ref: "coupon", at: { lg: { column: 2, hidden: true } } });

  // With nothing left that the row can honour, the slot goes back to being a name and so does v2.
  project.presentation.layout[0].columns[1][0].at = { md: { column: 4 } };
  const trimmed = compileToContract(project);
  assert.ok(trimmed.contract);
  assert.equal(trimmed.contract.version, 2);
  assert.deepEqual(trimmed.contract.layout[0].columns[1], ["coupon"]);
});

test("every kind Studio offers is a kind the widget catalog knows", async () => {
  // Studio's field kinds are its own vocabulary — `date`, `time` — but what they compile to must be
  // the catalog's. A target the catalog does not have would produce a contract that every renderer
  // refuses to draw, and the failure would surface as a blank field in the preview.
  const { MDY_WIDGET_KINDS } = await import("@modyra/widgets");
  const project = createCheckoutProject();
  const { contract } = compileToContract(project);
  assert.ok(contract, "the sample project must compile");
  const kinds = [];
  const walk = (node, name) => {
    if (node.node === "field") { kinds.push([name, node.field.kind]); return; }
    for (const [childName, child] of Object.entries(node.children ?? {})) walk(child, childName);
    if (node.item) walk(node.item, name);
  };
  walk(contract.schema, "root");
  assert.ok(kinds.length > 0, "the sample project must carry some fields");
  for (const [name, kind] of kinds) {
    assert.ok(MDY_WIDGET_KINDS.includes(kind), `${name} compiles to "${kind}", which is not a widget kind`);
  }
});

test("the catalog kinds Studio does not offer are listed, not merely absent", async () => {
  // A record rather than a rule: Studio's editor has no way to author these yet, and saying so is
  // what keeps "not offered" from being confused with "forgotten". Adding one to Studio means
  // deleting it from here.
  const { MDY_WIDGET_KINDS } = await import("@modyra/widgets");
  const OFFERED = ["text", "textarea", "email", "password", "number", "slider", "checkbox", "toggle", "select", "radio", "segmented", "multiselect", "datepicker", "timepicker"];
  const notOffered = MDY_WIDGET_KINDS.filter((kind) => !OFFERED.includes(kind));
  assert.deepEqual([...notOffered].sort(), ["colors", "daterange", "file"]);
});

/** A project whose rows hold collections: keyed lines under a keyed order, and a keyed row per shipment. */
function createNestedProject() {
  const project = createCheckoutProject();
  return {
    ...project,
    schema: {
      ...project.schema,
      children: [
        {
          node: "record",
          id: "nd_orders",
          name: "orders",
          label: "Orders",
          item: {
            node: "group",
            id: "nd_order",
            name: "order",
            children: [
              {
                node: "record",
                id: "nd_lines",
                name: "lines",
                label: "Lines",
                item: {
                  node: "field",
                  id: "nd_sku2",
                  name: "sku",
                  fieldKind: "text",
                  valueType: "string",
                  initialValue: "",
                  validators: [],
                },
                initialRows: {},
                validators: [],
              },
            ],
          },
          initialRows: { "tmp:1": { lines: {} } },
          validators: [],
        },
        {
          node: "array",
          id: "nd_shipments",
          name: "shipments",
          label: "Shipments",
          item: {
            node: "record",
            id: "nd_serials",
            name: "serials",
            item: {
              node: "field",
              id: "nd_serial",
              name: "serial",
              fieldKind: "text",
              valueType: "string",
              initialValue: "",
              validators: [],
            },
            initialRows: {},
            validators: [],
          },
          initialRows: [],
          validators: [],
        },
      ],
    },
    // The checkout fixture's references name its own nodes; a schema of new nodes keeps none of them.
    formValidators: [],
    behaviors: {},
    implementations: [],
    layout: [],
    presentation: { ...project.presentation, layout: [] },
  };
}

test("a record compiles to the contract's record node, and a keyed row may sit under a positional one", () => {
  const { contract, diagnostics } = compileToContract(createNestedProject());

  assert.ok(contract, "expected a non-null contract");
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error"), []);
  const orders = contract.schema.children.orders;
  assert.equal(orders.node, "record");
  assert.equal(orders.item.children.lines.node, "record", "a keyed collection inside a keyed row");
  assert.deepEqual(orders.initialValue, { "tmp:1": { lines: {} } }, "the declared rows survive the boundary");
  assert.equal(contract.schema.children.shipments.item.node, "record", "the row itself may be the collection");

  // The parser is the other half of the claim: what Studio emits is a document a form can run.
  const parsed = parseDynamicForm({ version: 2, schema: contract.schema });
  assert.deepEqual(parsed.diagnostics.filter((d) => d.severity === "error"), []);
});

test("an array below another array is emitted, as any other nesting is", () => {
  const project = createNestedProject();
  const nested = {
    ...project,
    schema: {
      ...project.schema,
      children: [
        {
          node: "array",
          id: "nd_outer",
          name: "outer",
          item: {
            node: "array",
            id: "nd_inner",
            name: "inner",
            item: {
              node: "field",
              id: "nd_leaf",
              name: "leaf",
              fieldKind: "text",
              valueType: "string",
              initialValue: "",
              validators: [],
            },
            initialRows: [],
            validators: [],
          },
          initialRows: [],
          validators: [],
        },
      ],
    },
  };

  const { contract, diagnostics } = compileToContract(nested);
  assert.deepEqual(
    diagnostics.filter((d) => d.severity === "error"),
    [],
    "a second positional level is addressable, so nothing is refused",
  );

  const outer = contract?.schema.children.outer;
  assert.equal(outer?.node, "array", "the outer collection is emitted");
  assert.equal(outer?.item.node, "array", "and its row is the collection it declares");
  assert.equal(outer?.item.item.node, "field", "down to the leaf");
});

test("a project may nest collections of either kind, as deep as it declares them", () => {
  // Three levels, both kinds, with the positional one inside a keyed row and another positional one
  // inside that: the shape ADR 0043 unlocked, compiled rather than refused.
  const project = createNestedProject();
  const deep = {
    ...project,
    schema: {
      ...project.schema,
      children: [
        {
          node: "record",
          id: "nd_orders",
          name: "orders",
          item: {
            node: "array",
            id: "nd_lines",
            name: "lines",
            item: {
              node: "array",
              id: "nd_allocations",
              name: "allocations",
              item: {
                node: "field",
                id: "nd_bin",
                name: "bin",
                fieldKind: "text",
                valueType: "string",
                initialValue: "",
                validators: [],
              },
              initialRows: [],
              validators: [],
            },
            initialRows: [],
            validators: [],
          },
          initialRows: {},
          validators: [],
        },
      ],
    },
  };

  const { contract, diagnostics } = compileToContract(deep);
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error"), []);

  const orders = contract?.schema.children.orders;
  assert.equal(orders?.node, "record");
  assert.equal(orders?.item.node, "array", "a keyed row holds a positional collection");
  assert.equal(orders?.item.item.node, "array", "which holds another one");
  assert.equal(orders?.item.item.item.node, "field", "down to the leaf");
});

/**
 * A project, compiled, parsed and run — the whole way down, two collections deep.
 *
 * Three artefacts sit between what an author draws and what a user types into: the project, the
 * contract it compiles to, and the form built from that contract. Each leg is covered on its own,
 * and until nesting was unlocked (ADR 0043) the deep shapes could not cross any of them. What this
 * asserts is the end of the chain: the form a compiled project produces holds the rows the project
 * declared, at every level, and answers for them.
 */
test("a project two collections deep compiles into a form that runs", async () => {
  const { createForm } = await import("../../core/dist/index.js");
  const { buildDynamicFormSchema } = await import("../../core/dist/dynamic-config.js");

  const project = createNestedProject();
  const deep = {
    ...project,
    schema: {
      ...project.schema,
      children: [
        {
          node: "record",
          id: "nd_orders",
          name: "orders",
          item: {
            node: "group",
            id: "nd_order",
            name: "order",
            children: [
              {
                node: "field",
                id: "nd_ref",
                name: "ref",
                fieldKind: "text",
                valueType: "string",
                initialValue: "",
                validators: [],
              },
              {
                node: "array",
                id: "nd_lines",
                name: "lines",
                item: {
                  node: "array",
                  id: "nd_allocations",
                  name: "allocations",
                  item: {
                    node: "field",
                    id: "nd_bin",
                    name: "bin",
                    fieldKind: "text",
                    valueType: "string",
                    initialValue: "",
                    validators: [],
                  },
                  initialRows: [],
                  validators: [],
                },
                initialRows: [],
                validators: [],
              },
            ],
          },
          initialRows: {},
          validators: [],
        },
      ],
    },
  };

  const { contract, diagnostics } = compileToContract(deep);
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error"), [], "the project compiles");

  const parsed = parseDynamicForm(contract);
  assert.deepEqual(parsed.diagnostics, [], "and the contract it emitted parses");

  const form = createForm(buildDynamicFormSchema(contract.schema));
  try {
    form.f.orders.upsert("o1", { ref: "R1", lines: [[{ bin: "A" }], []] });
    form.f.orders.row("o1").lines.at(1).push({ bin: "B" });

    assert.deepEqual(form.getValue().orders.o1, {
      ref: "R1",
      lines: [[{ bin: "A" }], [{ bin: "B" }]],
    }, "the form holds what was written at every level the project declared");
    assert.deepEqual(form.submitValue().orders.o1.lines[1], [{ bin: "B" }]);
  } finally {
    form.destroy();
  }
});

test("a row count that is not a finite number is left out rather than written as null", () => {
  // The contract is JSON, so NaN and both infinities serialise to `null` — and they have a number's
  // type, so a `typeof` gate let them through. The author's rule left the project as
  // `"minItems": null`, absent from the output with nothing between the project and the engine
  // saying so. The wrong *type* was already dropped, which is what shows the gate was too narrow
  // rather than the handling missing.
  const compiled = (value) => {
    const project = createCheckoutProject();
    const items = project.schema.children.find((n) => n.id === "nd_items");
    items.validators.push({ id: "val_items_min", kind: "min", value });
    return compileToContract(project).contract.schema.children.items;
  };

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "3"]) {
    const node = compiled(value);
    assert.equal("minItems" in node, false, `${String(value)} reached the contract`);
  }

  // The control: a whole number reaches it, and a collection with no rule carries none.
  assert.equal(compiled(2).minItems, 2);
  const untouched = compileToContract(createCheckoutProject()).contract.schema.children.items;
  assert.equal("minItems" in untouched, false);
});
