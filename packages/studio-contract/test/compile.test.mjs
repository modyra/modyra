/**
 * P6 gate (.modyra/modyra-studio-caveman-plan.md section 14 P6): "checkout
 * strict-valid". These tests call the *real* @modyra/core `parseDynamicForm`
 * (imported directly, not mocked) to independently double-check what
 * compileToContract already verifies internally — this is the actual
 * "strict-parse with existing parser" requirement from plan section 10,
 * not just trusting this package's own diagnostics summary.
 */
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

  // The form validator (items.length >= 1) and the coupon's server validator have no
  // Contract v2 equivalent — must be reported, not silently dropped from the output.
  assert.ok(diagnostics.some((d) => d.code === "UNSUPPORTED_FEATURE" && d.validatorId === "val_items_min_one"));
  assert.ok(diagnostics.some((d) => d.code === "UNSUPPORTED_FEATURE" && d.validatorId === "val_coupon_server"));

  // No error-severity diagnostics — checkout is a genuinely valid, compilable project.
  assert.deepEqual(
    diagnostics.filter((d) => d.severity === "error"),
    [],
  );

  // Independent re-verification against the real parser (not just trusting compileToContract's word for it).
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
