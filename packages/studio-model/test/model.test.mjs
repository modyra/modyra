/**
 * P1 gate (.modyra/modyra-studio-caveman-plan.md section 14 P1):
 * checkout lossless; move/rename preserve refs; bad/polluted input
 * rejected; no framework dependency.
 */
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

  // Manual rename (no command engine yet — P2). Mutate the clone directly.
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
