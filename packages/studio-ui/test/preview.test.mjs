/**
 * P11 gate: "Preview reads model/Contract, not generated source." These
 * are pure-function tests against a real live form (buildLiveForm from
 * @modyra/studio-preview) — no DOM, no mountStudio — the same pattern
 * `serverValidatorMarkup`/`formValidatorsMarkup` already use.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLiveForm } from "../../studio-preview/dist/index.js";
import { previewBodyMarkup, previewFieldMarkup, previewNodeMarkup, getPreviewHandle, defaultRowValue } from "../dist/index.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

test("previewFieldMarkup renders a real bound input with the live value and a real required error", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);
  const cityNode = project.schema.children.find((c) => c.name === "shipping").children.find((c) => c.name === "city");

  const markup = previewFieldMarkup(cityNode, "shipping.city", form, {});
  assert.match(markup, /data-preview-field="shipping\.city"/);
  assert.match(markup, /This field is required/);

  form.f.shipping.city.set("Rome");
  const afterMarkup = previewFieldMarkup(cityNode, "shipping.city", form, {});
  assert.match(afterMarkup, /value="Rome"/);
  assert.doesNotMatch(afterMarkup, /This field is required/);
});

test("previewFieldMarkup renders a select's real options, and a server-validated field gets a mock-mode selector", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);
  const countryNode = project.schema.children.find((c) => c.name === "country");
  const couponNode = project.schema.children.find((c) => c.name === "coupon");

  const countryMarkup = previewFieldMarkup(countryNode, "country", form, {});
  assert.match(countryMarkup, /<option value="IT"[^>]*selected[^>]*>Italy<\/option>/);

  const couponMarkup = previewFieldMarkup(couponNode, "coupon", form, {});
  assert.match(couponMarkup, /data-preview-mock-mode="impl_validate_coupon"/);
  assert.match(couponMarkup, /<option value="success" selected>/);
});

test("previewNodeMarkup renders the real checkout.items array with its one initial row", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);
  const itemsNode = project.schema.children.find((c) => c.name === "items");

  const markup = previewNodeMarkup(itemsNode, "items", form, {});
  assert.match(markup, /Items \(1\)/);
  assert.match(markup, /data-preview-field="items\.0\.sku"/);
  assert.match(markup, /value="TSHIRT-BLK-M"/);
  assert.match(markup, /data-preview-array-remove="items" data-preview-array-index="0"/);
  assert.match(markup, /data-preview-array-push="items"/);
});

test("previewBodyMarkup: Invalid + Submit disabled initially, Valid + Submit enabled once required fields are set", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);

  const before = previewBodyMarkup(project, form, {});
  assert.match(before, /preview-status-badge invalid">Invalid/);
  assert.match(before, /data-preview-submit disabled/);

  form.f.shipping.city.set("Rome");
  form.f.shipping.zip.set("00100");
  form.f.items.at(0).sku.set("TSHIRT-BLK-M");
  form.f.items.at(0).qty.set(2);

  const after = previewBodyMarkup(project, form, {});
  assert.match(after, /preview-status-badge valid">Valid/);
  assert.doesNotMatch(after, /data-preview-submit disabled/);
});

test("previewBodyMarkup notes when no submit action is configured, and omits the note when checkout's real one is", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);
  // checkout.behaviors.submit already references impl_create_order — the hint must not appear.
  assert.doesNotMatch(previewBodyMarkup(project, form, {}), /No submit action configured/);

  project.behaviors.submit = undefined;
  assert.match(previewBodyMarkup(project, form, {}), /No submit action configured/);
});

test("previewBodyMarkup with no live form (invalid root) reports the reason instead of throwing", () => {
  const project = createCheckoutProject();
  project.schema = { node: "array", id: "bad", name: "bad", item: { node: "field", id: "x", name: "x", fieldKind: "text", valueType: "string", initialValue: "", validators: [] }, initialRows: [], validators: [] };
  assert.match(previewBodyMarkup(project, null, {}), /Preview needs a group at the schema root/);
});

test("getPreviewHandle walks nested group and array paths, returning null for an unknown path instead of throwing", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);
  assert.ok(getPreviewHandle(form, "shipping.city"));
  assert.ok(getPreviewHandle(form, "items.0.sku"));
  assert.equal(getPreviewHandle(form, "does.not.exist"), null);
  assert.equal(getPreviewHandle(null, "country"), null);
});

test("defaultRowValue builds a new array row from the item schema's own field defaults", () => {
  const project = createCheckoutProject();
  const itemsNode = project.schema.children.find((c) => c.name === "items");
  assert.deepEqual(defaultRowValue(itemsNode.item), { sku: "", qty: 1 });
});
