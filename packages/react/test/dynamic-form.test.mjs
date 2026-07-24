/**
 * P13 gate: "same Contract, same value/validation/error semantics in
 * Angular+React." buildDynamicFormSchema/applyDynamicValidators are the
 * exact logic useMdyDynamicForm runs inside useMemo/useEffect — tested
 * directly against a real form built with the real createForm(), since
 * this package has no React-rendering test harness (matches how every
 * other hook here is only smoke-tested for its export, but these two
 * plain functions can be exercised for real behavior the same way
 * studio-preview's buildLiveForm already is).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDynamicValidators,
  buildDynamicFormSchema,
  createForm,
  parseDynamicForm,
  useMdyDynamicForm,
} from "../dist/index.js";

const CONTRACT = {
  version: 2,
  schema: {
    node: "group",
    children: {
      name: { node: "field", field: { kind: "text", validators: { required: true } } },
      email: { node: "field", field: { kind: "email", validators: { required: true, email: true } } },
      age: { node: "field", field: { kind: "number", validators: { min: 18 } } },
      subscribe: { node: "field", field: { kind: "checkbox" } },
      country: {
        node: "field",
        field: { kind: "select", options: [{ value: "IT", label: "Italy" }, { value: "FR", label: "France" }] },
      },
      interests: {
        node: "field",
        field: { kind: "multiselect", options: [{ value: "sports", label: "Sports" }, { value: "music", label: "Music" }] },
      },
    },
  },
};

function buildRealForm() {
  const { fields, ok, diagnostics } = parseDynamicForm(CONTRACT);
  assert.equal(ok, true, `expected a valid Contract, got diagnostics: ${JSON.stringify(diagnostics)}`);
  const form = createForm(buildDynamicFormSchema(fields));
  applyDynamicValidators(form, fields);
  return form;
}

test("useMdyDynamicForm is exported as a function", () => {
  assert.equal(typeof useMdyDynamicForm, "function");
});

test("builds real default values per kind when initialValue is omitted", () => {
  const form = buildRealForm();
  assert.deepEqual(form.getValue(), {
    name: "",
    email: "",
    age: 0,
    subscribe: false,
    country: null,
    interests: [],
  });
});

test("real required/email/min errors from the Contract's validators, not a reimplementation", () => {
  const form = buildRealForm();
  assert.equal(form.f.name.errors().length, 1);
  assert.equal(form.f.email.errors().length, 1);

  form.f.name.set("Ada");
  form.f.email.set("not-an-email");
  assert.equal(form.f.name.errors().length, 0);
  assert.equal(form.f.email.errors().length, 1);

  form.f.email.set("ada@example.com");
  assert.equal(form.f.email.errors().length, 0);

  form.f.age.set(10);
  assert.equal(form.f.age.errors().length, 1);
  form.f.age.set(30);
  assert.equal(form.f.age.errors().length, 0);
});

test("select/multiselect get the automatic anti-tampering whitelist (oneOf/eachOneOf), matching Angular's own dynamic form", () => {
  const form = buildRealForm();
  form.f.country.set("DE"); // not a real option
  assert.equal(form.f.country.errors().length, 1);
  form.f.country.set("IT");
  assert.equal(form.f.country.errors().length, 0);

  form.f.interests.set(["sports", "gardening"]); // "gardening" not a real option
  assert.equal(form.f.interests.errors().length, 1);
  form.f.interests.set(["sports", "music"]);
  assert.equal(form.f.interests.errors().length, 0);
});

test("applyDynamicValidators re-applying (e.g. a config change) replaces rather than accumulates duplicate errors", () => {
  const form = buildRealForm();
  const { fields } = parseDynamicForm(CONTRACT);
  applyDynamicValidators(form, fields);
  applyDynamicValidators(form, fields);
  assert.equal(form.f.name.errors().length, 1); // still exactly one "required" error, not three
});
