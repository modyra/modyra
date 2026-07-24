/**
 * Pure logic, no DOM: schema/validator building from a flat Contract
 * field list, against a real @modyra/core form.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "@modyra/core";
import { buildForm, buildFormSchema } from "../dist/schema.js";

const fields = [
  { name: "email", kind: "email", validators: { required: true, email: true } },
  { name: "age", kind: "number", validators: { min: 18 } },
  { name: "subscribe", kind: "checkbox" },
  { name: "country", kind: "select", options: [{ value: "IT", label: "Italy" }, { value: "FR", label: "France" }] },
];

test("buildFormSchema gives every field kind its real default value", () => {
  const schema = buildFormSchema(fields);
  assert.equal(schema.email.initial, "");
  assert.equal(schema.age.initial, 0);
  assert.equal(schema.subscribe.initial, false);
  assert.equal(schema.country.initial, null);
});

test("buildForm produces a real form with the configured validators wired", () => {
  const form = buildForm(fields, vanillaReactivity());
  form.f.email.set("");
  assert.equal(form.f.email.valid(), false);
  form.f.email.set("not-an-email");
  assert.equal(form.f.email.valid(), false);
  form.f.email.set("real@example.com");
  assert.equal(form.f.email.valid(), true);

  form.f.age.set(10);
  assert.equal(form.f.age.valid(), false);
  form.f.age.set(20);
  assert.equal(form.f.age.valid(), true);

  form.deactivate();
});

test("select field gets an automatic oneOf whitelist from its declared options", () => {
  const form = buildForm(fields, vanillaReactivity());
  form.f.country.set("DE"); // not in the declared options
  assert.equal(form.f.country.valid(), false);
  form.f.country.set("IT");
  assert.equal(form.f.country.valid(), true);
  form.deactivate();
});
