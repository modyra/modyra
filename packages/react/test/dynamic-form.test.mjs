/**
 * "applies Contract value and validation semantics in
 * Angular+React." buildDynamicFormSchema/applyDynamicValidators are the
 * exact logic useMdyDynamicForm runs inside useMemo/useEffect — tested
 * directly against a real form built with the real createForm(), since
 * this package has no React-rendering test harness (matches how every
 * other hook here is only smoke-tested for its export, but these two
 * plain functions can be exercised for behavior the same way
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

test("uses default values per kind when initialValue is omitted", () => {
  const form = buildRealForm();
  // The kind's own table, from core: a number holds nothing, not zero, because zero is a number the
  // user may well mean — and a field defaulted to it is one `required` can never fail.
  assert.deepEqual(form.getValue(), {
    name: "",
    email: "",
    age: null,
    subscribe: false,
    country: null,
    interests: [],
  });
});

test("required, email and minimum errors from the Contract's validators, not a reimplementation", () => {
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

test("an empty field starts where core says it starts, for every kind", () => {
  // The kind decides what "empty" is, and it decides it once: a schema built here holds the same
  // initial value the same field holds under any other adapter. A number starting at 0 would be a
  // field `required` can never fail; a slider at 0 would sit outside a range it declares.
  const fields = [
    { name: "count", kind: "number", validators: { required: true } },
    { name: "level", kind: "slider", min: 10, max: 20 },
    { name: "when", kind: "daterange" },
    { name: "docs", kind: "file" },
    { name: "note", kind: "text" },
  ];
  const form = createForm(buildDynamicFormSchema(fields));
  applyDynamicValidators(form, fields);
  form.activate();

  assert.equal(form.getValue().count, null, "a number that starts at 0 can never fail `required`");
  assert.equal(form.f.count.valid(), false, "a required number starts filled");
  assert.equal(form.getValue().level, 10, "a slider starts outside the range it declares");
  assert.deepEqual(form.getValue().when, { start: null, end: null });
  assert.deepEqual(form.getValue().docs, []);
  assert.equal(form.getValue().note, "");
  form.deactivate();
});

test("a field named by path builds the structure the path describes", () => {
  // The dynamic contract carries a nested form as fields named by path. A schema built from those
  // names has to hold the shape they describe, or the form renders and then throws on the first read.
  const fields = [
    { name: "country", kind: "text" },
    { name: "shipping.city", kind: "text" },
  ];
  const form = createForm(buildDynamicFormSchema(fields));
  form.activate();
  assert.deepEqual(form.getValue(), { country: "", shipping: { city: "" } });
  form.deactivate();

  assert.throws(
    () => buildDynamicFormSchema([{ name: "x", kind: "text" }, { name: "x", kind: "text" }]),
    /x/,
    "two definitions sharing a name collapsed into one",
  );
});
