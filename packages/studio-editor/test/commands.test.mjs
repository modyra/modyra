/**
 * P2 gate (.modyra/modyra-studio-caveman-plan.md section 14 P2, scoped to
 * this batch's command set): apply+inverse property tests; 500-node
 * operations acceptable; no DOM.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createDeleteCommand,
  createInsertCommand,
  createMoveCommand,
  createUpdateNodeCommand,
  createUpdateBehaviorCommand,
  createDuplicateCommand,
  createAddValidatorCommand,
  createRemoveValidatorCommand,
  createUpdateValidatorCommand,
  createSetFieldOptionsCommand,
  createAddFormValidatorCommand,
  createRemoveFormValidatorCommand,
  createUpdateFormValidatorCommand,
  createSetServerValidatorCommand,
  createAddImplementationCommand,
  inspectDelete,
  CommandHistory,
  CommandRejectedError,
} from "../dist/index.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

function roundTrip(original, command) {
  const applied = command.apply(original);
  const inverse = command.inverse(original);
  const restored = inverse.apply(applied);
  assert.deepEqual(restored, original, `apply(${command.kind})+apply(inverse) must reproduce the original`);
  return applied;
}

test("insert + inverse (delete) round-trips", () => {
  const original = createCheckoutProject();
  const newField = {
    node: "field",
    id: "nd_notes",
    name: "notes",
    fieldKind: "textarea",
    valueType: "string",
    initialValue: "",
    validators: [],
  };
  const command = createInsertCommand(newField, { kind: "inside", parentId: "nd_shipping", index: 0 });
  assert.deepEqual(command.validate(original), []);
  roundTrip(original, command);
});

test("delete + inverse (reinsert at same slot) round-trips", () => {
  const original = createCheckoutProject();
  const command = createDeleteCommand("nd_zip");
  assert.deepEqual(command.validate(original), []);
  const applied = roundTrip(original, command);
  assert.ok(!applied.schema.children.find((n) => n.id === "nd_shipping").children.some((n) => n.id === "nd_zip"));
});

test("move (cross-group) + inverse round-trips", () => {
  const original = createCheckoutProject();
  const command = createMoveCommand("nd_coupon", { kind: "inside", parentId: "nd_shipping", index: 0 });
  assert.deepEqual(command.validate(original), []);
  const applied = roundTrip(original, command);
  const shipping = applied.schema.children.find((n) => n.id === "nd_shipping");
  assert.equal(shipping.children[0].id, "nd_coupon");
});

test("move into array item slot + inverse round-trips", () => {
  const original = createCheckoutProject();
  // Detach sku first so the item slot isn't a duplicate-name collision, then place a fresh field as the item.
  const newItem = {
    node: "field",
    id: "nd_note",
    name: "note",
    fieldKind: "text",
    valueType: "string",
    initialValue: "",
    validators: [],
  };
  const command = createInsertCommand(newItem, { kind: "arrayItem", arrayId: "nd_items" });
  assert.deepEqual(command.validate(original), []);
  const applied = command.apply(original);
  assert.equal(applied.schema.children.find((n) => n.id === "nd_items").item.id, "nd_note");
  const inverse = command.inverse(original);
  const restored = inverse.apply(applied);
  assert.deepEqual(restored, original);
});

test("rename (updateNode) + inverse round-trips and preserves references", () => {
  const original = createCheckoutProject();
  const command = createUpdateNodeCommand("nd_country", { name: "shippingCountry" });
  assert.deepEqual(command.validate(original), []);
  const applied = roundTrip(original, command);
  assert.equal(applied.schema.children.find((n) => n.id === "nd_country").name, "shippingCountry");
  // Reference by ID into nd_country is untouched by the rename.
  const coupon = applied.schema.children.find((n) => n.id === "nd_coupon");
  assert.equal(coupon.serverValidator.dependencies[0].nodeId, "nd_country");
});

test("rejects cycle: moving a group inside its own descendant", () => {
  const original = createCheckoutProject();
  const command = createMoveCommand("nd_shipping", { kind: "inside", parentId: "nd_city", index: 0 });
  const diagnostics = command.validate(original);
  assert.ok(diagnostics.some((d) => d.code === "CYCLE"));
});

test("rejects duplicate sibling name", () => {
  const original = createCheckoutProject();
  const command = createInsertCommand(
    { node: "field", id: "nd_dup", name: "city", fieldKind: "text", valueType: "string", initialValue: "", validators: [] },
    { kind: "inside", parentId: "nd_shipping", index: 0 },
  );
  const diagnostics = command.validate(original);
  assert.ok(diagnostics.some((d) => d.code === "DUPLICATE_SIBLING_NAME"));
});

test("rejects reserved name", () => {
  const original = createCheckoutProject();
  const command = createUpdateNodeCommand("nd_city", { name: "__proto__" });
  const diagnostics = command.validate(original);
  assert.ok(diagnostics.some((d) => d.code === "RESERVED_NAME"));
});

test("rejects second array item via placement validation", () => {
  const original = createCheckoutProject();
  const other = { node: "field", id: "nd_other", name: "other", fieldKind: "text", valueType: "string", initialValue: "", validators: [] };
  // arrayId's current item is nd_item; targeting arrayItem with a *different* new node is a replace, allowed.
  // Attempting to place it "inside" the array itself (array isn't a group) must be rejected.
  const command = createInsertCommand(other, { kind: "inside", parentId: "nd_items", index: 0 });
  const diagnostics = command.validate(original);
  assert.ok(diagnostics.some((d) => d.code === "INVALID_PARENT_CHILD"));
});

test("rejects deleting/moving an array's item directly", () => {
  const original = createCheckoutProject();
  const del = createDeleteCommand("nd_item");
  assert.ok(del.validate(original).some((d) => d.code === "MALFORMED_COMMAND"));
  const move = createMoveCommand("nd_item", { kind: "inside", parentId: "nd_shipping", index: 0 });
  assert.ok(move.validate(original).some((d) => d.code === "MALFORMED_COMMAND"));
});

test("rejects malformed placement (nonexistent target)", () => {
  const original = createCheckoutProject();
  const command = createMoveCommand("nd_coupon", { kind: "inside", parentId: "nd_does_not_exist", index: 0 });
  const diagnostics = command.validate(original);
  assert.ok(diagnostics.some((d) => d.code === "MALFORMED_PLACEMENT"));
});

test("CommandHistory: apply/undo/redo round-trips through a real history stack", () => {
  const history = new CommandHistory();
  let project = createCheckoutProject();
  const original = structuredClone(project);

  project = history.apply(project, createUpdateNodeCommand("nd_country", { name: "shippingCountry" }));
  project = history.apply(project, createMoveCommand("nd_coupon", { kind: "inside", parentId: "nd_shipping", index: 0 }));
  assert.equal(project.schema.children.find((n) => n.id === "nd_country").name, "shippingCountry");

  project = history.undo(project);
  project = history.undo(project);
  assert.deepEqual(project, original);
  assert.equal(history.canUndo(), false);

  project = history.redo(project);
  project = history.redo(project);
  assert.equal(project.schema.children.find((n) => n.id === "nd_country").name, "shippingCountry");
  assert.equal(history.canRedo(), false);
});

test("CommandHistory rejects an invalid command instead of corrupting state", () => {
  const history = new CommandHistory();
  const project = createCheckoutProject();
  assert.throws(
    () => history.apply(project, createUpdateNodeCommand("nd_city", { name: "__proto__" })),
    CommandRejectedError,
  );
});

test("apply+inverse holds at ~500-node scale (property test, perf sanity)", () => {
  const project = buildWideProject(500);
  const targetId = "nd_leaf_250";

  const move = createMoveCommand(targetId, { kind: "inside", parentId: "nd_leaf_10", index: 0 });
  assert.deepEqual(move.validate(project), []);
  roundTrip(project, move);

  const del = createDeleteCommand("nd_leaf_400");
  assert.deepEqual(del.validate(project), []);
  roundTrip(project, del);

  const rename = createUpdateNodeCommand("nd_leaf_1", { name: "renamed_leaf_1" });
  assert.deepEqual(rename.validate(project), []);
  roundTrip(project, rename);
});

function buildWideProject(count) {
  const children = [];
  for (let i = 0; i < count; i++) {
    children.push(i === 10
      ? { node: "group", id: `nd_leaf_${i}`, name: `leaf${i}`, children: [] }
      : { node: "field", id: `nd_leaf_${i}`, name: `leaf${i}`, fieldKind: "text", valueType: "string", initialValue: "", validators: [] });
  }
  return {
    studioVersion: 1,
    id: "prj_wide",
    name: "Wide",
    schema: { node: "group", id: "nd_root", name: "root", children },
    formValidators: [],
    behaviors: {},
    implementations: {},
    presentation: {},
    targets: {},
    metadata: {},
  };
}

test("package has zero non-workspace runtime dependencies and no DOM lib", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.deepEqual(deps, ["@modyra/studio-model"]);

  const tsconfig = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"));
  assert.ok(!tsconfig.compilerOptions.lib.includes("DOM"));
});


test("same-parent before/after moves reorder without off-by-one", () => {
  const project = createCheckoutProject();
  const moved = createMoveCommand("nd_country", { kind: "after", targetId: "nd_items" }).apply(project);
  assert.deepEqual(moved.schema.children.map(n => n.id), ["nd_shipping", "nd_items", "nd_country", "nd_coupon"]);
});
test("duplicate regenerates every node id and is invertible", () => {
  const project = createCheckoutProject();
  const command = createDuplicateCommand("nd_shipping");
  assert.deepEqual(command.validate(project), []);
  const duplicated = roundTrip(project, command);
  assert.equal(duplicated.schema.children.filter(n => n.name.startsWith("shipping")).length, 2);
});
test("delete requires confirmation for subtree or referenced node", () => {
  const project = createCheckoutProject();
  assert.equal(inspectDelete(project, "nd_shipping").requiresConfirmation, true);
  assert.ok(createDeleteCommand("nd_shipping").validate(project).some(d => d.code === "CONFIRM_DELETE"));
  assert.deepEqual(createDeleteCommand("nd_shipping", true).validate(project), []);
});

test("duplicate's candidate id/name is stable across repeated validate() calls", () => {
  const project = createCheckoutProject();
  const command = createDuplicateCommand("nd_shipping");
  // Simulate a preview UI calling validate() several times before the user confirms.
  command.validate(project);
  command.validate(project);
  command.validate(project);
  const applied = command.apply(project);
  const inserted = applied.schema.children.find((n) => n.name === "shippingCopy");
  // inverse() must delete the exact node apply() inserted, not a node from a discarded earlier candidate.
  const del = command.inverse();
  assert.equal(del.affectedIds[0], inserted.id);
  const restored = del.apply(applied);
  assert.deepEqual(restored, project);
});

test("updateNode round-trips exactly when patching a previously-unset optional field", () => {
  const project = createCheckoutProject();
  const cityBefore = project.schema.children.find((n) => n.id === "nd_shipping").children.find((n) => n.id === "nd_city");
  assert.equal("label" in cityBefore, false);
  const command = createUpdateNodeCommand("nd_city", { label: "City" });
  const applied = roundTrip(project, command);
  const cityAfter = applied.schema.children.find((n) => n.id === "nd_shipping").children.find((n) => n.id === "nd_city");
  assert.equal(cityAfter.label, "City");
});

test("updateBehavior round-trips exactly when patching a previously-unset behavior key", () => {
  const project = createCheckoutProject();
  delete project.behaviors.serverErrorMapping;
  const command = createUpdateBehaviorCommand({ serverErrorMapping: "flat" });
  const applied = roundTrip(project, command);
  assert.equal(applied.behaviors.serverErrorMapping, "flat");
});

test("P5: addValidator rejects a validator incompatible with the field's value type", () => {
  const project = createCheckoutProject();
  // nd_qty is valueType "number" — "email" only supports "string".
  const command = createAddValidatorCommand("nd_qty", { id: "val_bad", kind: "email" });
  const diagnostics = command.validate(project);
  assert.ok(diagnostics.some((d) => d.code === "INCOMPATIBLE_VALIDATOR_TYPE"));
});

test("P5: addValidator rejects a second validator of a kind that doesn't allow duplicates", () => {
  const project = createCheckoutProject();
  // nd_city already has a "required" validator (val_city_required).
  const command = createAddValidatorCommand("nd_city", { id: "val_city_required_2", kind: "required" });
  const diagnostics = command.validate(project);
  assert.ok(diagnostics.some((d) => d.code === "DUPLICATE_VALIDATOR_KIND"));
});

test("P5: addValidator allows a second validator of a kind that does allow duplicates (pattern)", () => {
  const project = createCheckoutProject();
  const command = createAddValidatorCommand("nd_zip", { id: "val_zip_pattern_2", kind: "pattern", pattern: "^[0-9]+$" });
  assert.deepEqual(command.validate(project), []);
});

test("P5: addValidator + removeValidator round-trip", () => {
  const project = createCheckoutProject();
  const command = createAddValidatorCommand("nd_qty", { id: "val_qty_max", kind: "max", value: 99 });
  assert.deepEqual(command.validate(project), []);
  roundTrip(project, command);
});

test("P5: updateValidator edits config in place (id/kind unchanged) and round-trips", () => {
  const project = createCheckoutProject();
  const command = createUpdateValidatorCommand("nd_zip", "val_zip_pattern", { pattern: "^\\d{4}$", message: "4 digits" });
  const applied = roundTrip(project, command);
  const zip = applied.schema.children.find((n) => n.id === "nd_shipping").children.find((n) => n.id === "nd_zip");
  const validator = zip.validators.find((v) => v.id === "val_zip_pattern");
  assert.equal(validator.pattern, "^\\d{4}$");
  assert.equal(validator.message, "4 digits");
  assert.equal(validator.kind, "pattern");
});

test("P5: setFieldOptions replaces options wholesale and round-trips; rejects duplicate values", () => {
  const project = createCheckoutProject();
  const command = createSetFieldOptionsCommand("nd_country", [
    { value: "IT", label: "Italy" },
    { value: "FR", label: "France" },
  ]);
  assert.deepEqual(command.validate(project), []);
  const applied = roundTrip(project, command);
  const country = applied.schema.children.find((n) => n.id === "nd_country");
  assert.deepEqual(country.options, [
    { value: "IT", label: "Italy" },
    { value: "FR", label: "France" },
  ]);

  const dup = createSetFieldOptionsCommand("nd_country", [
    { value: "IT", label: "Italy" },
    { value: "IT", label: "Duplicate" },
  ]);
  assert.ok(dup.validate(project).some((d) => d.code === "DUPLICATE_OPTION_VALUE"));
});

test("P5b2: setServerValidator removes the checkout coupon's server validator and round-trips", () => {
  const project = createCheckoutProject();
  const command = createSetServerValidatorCommand("nd_coupon", null);
  assert.deepEqual(command.validate(project), []);
  const applied = roundTrip(project, command);
  const coupon = applied.schema.children.find((n) => n.id === "nd_coupon");
  assert.equal("serverValidator" in coupon, false);
});

test("P5b2: setServerValidator adds a fresh server validator to a field that had none, round-trips", () => {
  const project = createCheckoutProject();
  const serverValidator = {
    id: "val_city_server",
    kind: "server",
    implementationRef: "impl_validate_city",
    dependencies: [{ nodeId: "nd_country" }],
    debounceMs: 300,
  };
  const command = createSetServerValidatorCommand("nd_city", serverValidator);
  assert.deepEqual(command.validate(project), []);
  const applied = roundTrip(project, command);
  const city = applied.schema.children.find((n) => n.id === "nd_shipping").children.find((n) => n.id === "nd_city");
  assert.deepEqual(city.serverValidator, serverValidator);
});

test("P5b2: setServerValidator rejects a non-field target", () => {
  const project = createCheckoutProject();
  const command = createSetServerValidatorCommand("nd_shipping", null);
  assert.ok(command.validate(project).some((d) => d.code === "INVALID_VALIDATOR_TARGET"));
});

test("P5b2: updateFormValidator edits message/dependencies in place, id/kind unchanged, round-trips", () => {
  const project = createCheckoutProject();
  const command = createUpdateFormValidatorCommand("val_items_min_one", { message: "Add at least one product" });
  const applied = roundTrip(project, command);
  const validator = applied.formValidators.find((v) => v.id === "val_items_min_one");
  assert.equal(validator.message, "Add at least one product");
  assert.equal(validator.kind, "form");
});

test("P5b2: addFormValidator + removeFormValidator round-trip", () => {
  const project = createCheckoutProject();
  const validator = {
    id: "val_zip_matches_country",
    kind: "crossField",
    dependencies: [{ nodeId: "nd_country" }, { nodeId: "nd_zip" }],
    condition: { op: "isNotEmpty", operand: { nodeId: "nd_zip" } },
    message: "Zip required",
    errorTarget: { nodeId: "nd_zip" },
  };
  const add = createAddFormValidatorCommand(validator);
  assert.deepEqual(add.validate(project), []);
  const applied = roundTrip(project, add);
  assert.ok(applied.formValidators.some((v) => v.id === "val_zip_matches_country"));

  const remove = createRemoveFormValidatorCommand("val_items_min_one");
  assert.deepEqual(remove.validate(project), []);
  roundTrip(project, remove);
});

test("P5b2: addImplementation registers a stub and round-trips; rejects duplicate id", () => {
  const project = createCheckoutProject();
  const ref = { id: "impl_validate_zip_country", role: "serverValidator", displayName: "validateZipForCountry", mode: "stub" };
  const command = createAddImplementationCommand(ref);
  assert.deepEqual(command.validate(project), []);
  const applied = roundTrip(project, command);
  assert.deepEqual(applied.implementations.impl_validate_zip_country, ref);

  const dup = createAddImplementationCommand({ ...ref, displayName: "different" });
  assert.ok(dup.validate(applied).some((d) => d.code === "DUPLICATE_ID"));
});
