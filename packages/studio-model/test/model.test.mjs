import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildIndexes, loadProject, normalize, serializeProject, StudioModelError } from "../dist/index.js";
import { createCheckoutProject } from "./fixtures/checkout.fixture.mjs";

test("checkout round-trips losslessly through load -> serialize -> load", () => {
  const original = createCheckoutProject();
  const first = loadProject(original);
  assert.deepEqual(first.diagnostics, []);

  const serialized = serializeProject(first.project);
  const second = loadProject(JSON.parse(serialized));

  assert.deepEqual(second.project, first.project);
  assert.deepEqual(second.project, original);
});

test("serialize is deterministic regardless of input key order", () => {
  const a = loadProject(createCheckoutProject()).project;
  const reversedTopLevel = Object.fromEntries(Object.entries(createCheckoutProject()).reverse());
  const b = loadProject(reversedTopLevel).project;
  assert.equal(serializeProject(a), serializeProject(b));
});

test("loadProject never mutates its input", () => {
  const original = createCheckoutProject();
  const snapshotJson = JSON.stringify(original);
  loadProject(original);
  assert.equal(JSON.stringify(original), snapshotJson);
});

test("rename preserves every ID-based reference", () => {
  const { project } = loadProject(createCheckoutProject());
  const before = buildIndexes(project);
  assert.equal(before.pathByNode.get("nd_country"), "country");

  // Manual rename (no command engine yet — ). Mutate the clone directly.
  const countryNode = project.schema.children.find((n) => n.id === "nd_country");
  countryNode.name = "shippingCountry";

  const { project: renormalized, diagnostics } = normalizeAndCheck(project);
  const after = buildIndexes(renormalized);

  assert.equal(after.pathByNode.get("nd_country"), "shippingCountry");
  assert.notEqual(after.pathByNode.get("nd_country"), before.pathByNode.get("nd_country"));

  // The coupon server validator's dependency still resolves by ID — path change didn't break it.
  const couponNode = findNode(renormalized.schema, "nd_coupon");
  assert.equal(couponNode.serverValidator.dependencies[0].nodeId, "nd_country");
  assert.ok(after.nodeById.has("nd_country"));
  assert.deepEqual(
    diagnostics.filter((d) => d.code === "BROKEN_REFERENCE"),
    [],
  );
});

test("move preserves every ID-based reference (coupon moved into shipping group)", () => {
  const { project } = loadProject(createCheckoutProject());
  const root = project.schema;
  const couponIndex = root.children.findIndex((n) => n.id === "nd_coupon");
  const [coupon] = root.children.splice(couponIndex, 1);
  const shipping = root.children.find((n) => n.id === "nd_shipping");
  shipping.children.push(coupon);

  const { project: renormalized, diagnostics } = normalizeAndCheck(project);
  const idx = buildIndexes(renormalized);

  assert.equal(idx.pathByNode.get("nd_coupon"), "shipping.coupon");
  assert.equal(idx.parentById.get("nd_coupon"), "nd_shipping");

  // Every reference into/out of nd_coupon (draft.exclude, server validator id) is untouched.
  assert.ok(idx.nodeById.has("nd_coupon"));
  assert.deepEqual(renormalized.behaviors.draft.exclude, [{ nodeId: "nd_coupon" }]);
  const formValidator = renormalized.formValidators.find((v) => v.id === "val_items_min_one");
  assert.equal(formValidator.errorTarget.nodeId, "nd_items");
  assert.deepEqual(
    diagnostics.filter((d) => d.code === "BROKEN_REFERENCE"),
    [],
  );
});

test("structurally malformed input is rejected, not silently accepted", () => {
  assert.throws(() => loadProject({}), StudioModelError);
  assert.throws(() => loadProject({ studioVersion: 1 }), StudioModelError);
  assert.throws(() => loadProject(null), StudioModelError);
  assert.throws(() => loadProject("not a project"), StudioModelError);
  assert.throws(
    () => loadProject({ ...createCheckoutProject(), studioVersion: 999 }),
    StudioModelError,
  );
});

test("polluted/semantically invalid project surfaces diagnostics instead of silently normalizing", () => {
  const project = createCheckoutProject();
  // Duplicate sibling name: rename zip to city.
  project.schema.children.find((n) => n.id === "nd_shipping").children.find(
    (n) => n.id === "nd_zip",
  ).name = "city";
  // Reserved name.
  project.schema.children.find((n) => n.id === "nd_country").name = "__proto__";
  // Broken reference: form validator depends on a node that doesn't exist.
  project.formValidators.push({
    id: "val_broken",
    kind: "form",
    dependencies: [{ nodeId: "nd_does_not_exist" }],
    condition: { op: "isEmpty", operand: { nodeId: "nd_does_not_exist" } },
    message: "broken on purpose",
  });
  // Missing implementation.
  project.behaviors.submit = { implementationRef: "impl_does_not_exist" };

  const { diagnostics } = normalize(project);
  const codes = diagnostics.map((d) => d.code).sort();

  assert.ok(codes.includes("DUPLICATE_SIBLING_NAME"));
  assert.ok(codes.includes("RESERVED_NAME"));
  assert.ok(codes.includes("BROKEN_REFERENCE"));
  assert.ok(codes.includes("MISSING_IMPLEMENTATION"));
});

test("bad regex pattern, select without options, and an un-excluded sensitive field are all diagnosed", () => {
  const project = createCheckoutProject();
  const shipping = project.schema.children.find((n) => n.id === "nd_shipping");
  shipping.children.find((n) => n.id === "nd_zip").validators.find((v) => v.kind === "pattern").pattern = "([unclosed";
  project.schema.children.find((n) => n.id === "nd_country").options = [];
  project.schema.children.push({
    node: "field",
    id: "nd_password",
    name: "password",
    fieldKind: "text",
    valueType: "string",
    initialValue: "",
    validators: [],
  });

  const { diagnostics } = normalize(project);
  const codes = diagnostics.map((d) => d.code);

  assert.ok(diagnostics.some((d) => d.code === "BAD_PATTERN" && d.nodeId === "nd_zip"));
  assert.ok(diagnostics.some((d) => d.code === "SELECT_WITHOUT_OPTIONS" && d.nodeId === "nd_country"));
  assert.ok(diagnostics.some((d) => d.code === "SENSITIVE_FIELD_IN_DRAFT" && d.nodeId === "nd_password"));
  assert.equal(codes.filter((c) => c === "SENSITIVE_FIELD_IN_DRAFT").length, 1); // coupon is excluded from draft already
});

test("excluding a sensitive field from the draft silences the warning", () => {
  const project = createCheckoutProject();
  project.schema.children.push({
    node: "field",
    id: "nd_secret_code",
    name: "secretCode",
    fieldKind: "text",
    valueType: "string",
    initialValue: "",
    validators: [],
  });
  project.behaviors.draft.exclude.push({ nodeId: "nd_secret_code" });

  const { diagnostics } = normalize(project);
  assert.ok(!diagnostics.some((d) => d.code === "SENSITIVE_FIELD_IN_DRAFT" && d.nodeId === "nd_secret_code"));
});

test("package has zero runtime dependencies (framework-neutral model layer)", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {});
});

function findNode(node, id) {
  if (node.id === id) return node;
  if (node.node === "group") {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  } else if (node.node === "array") {
    return findNode(node.item, id);
  }
  return null;
}

function normalizeAndCheck(project) {
  return normalize(project);
}

test("a condition holding something a condition cannot hold is reported when the project is read", () => {
  // The other end of the same defect. A condition is compiled into source a consumer builds, so an
  // operand outside the declared kinds is not a display problem — and the project that carries it
  // was accepted with nothing said. Reported rather than thrown: a project that cannot be opened
  // cannot be repaired in the editor that reports this.
  const withOperand = (operand) => ({
    studioVersion: 1, id: "p", name: "P",
    schema: { node: "group", id: "root", name: "root", children: [
      { node: "field", id: "nd_a", name: "a", fieldKind: "text", valueType: "string", initialValue: "", validators: [] },
    ] },
    formValidators: [{
      id: "fv_1", message: "no", dependencies: [],
      condition: { op: "equals", operands: [{ nodeId: "nd_a" }, operand] },
    }],
    behaviors: {}, implementations: {}, presentation: {}, targets: {}, metadata: {},
  });

  const codesFor = (operand) => loadProject(withOperand(operand)).diagnostics.map((d) => d.code);

  assert.deepEqual(codesFor(["globalThis.taken = 1"]), ["BAD_CONDITION_OPERAND"]);
  // A plain object rather than one carrying a function: the project goes through a structured
  // clone on the way in, so a function operand never reaches this check — it is refused earlier, by
  // the clone, which is a different door and already closed.
  assert.deepEqual(codesFor({ nested: { deep: true } }), ["BAD_CONDITION_OPERAND"]);

  // And every kind a condition does hold is accepted in silence.
  for (const operand of ["a string", 42, true, null, { nodeId: "nd_a" }]) {
    assert.deepEqual(codesFor(operand), [], `${JSON.stringify(operand)} was reported`);
  }
});
