import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import * as v from "valibot";
import { array, field, group, required } from "@modyra/core";
import {
  buildStandardValidator,
  createStandardForm,
  serverValidate,
} from "../dist/index.js";

// The same use case expressed with two different Standard Schema vendors:
// the adapter must produce identical validation results.

const zodSchema = z.object({
  email: z.string().email("Invalid email"),
  age: z.number().min(18, "18+ only"),
});

const valibotSchema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email")),
  age: v.pipe(v.number(), v.minValue(18, "18+ only")),
});

function signupFields() {
  return {
    email: field(null),
    age: field(18),
  };
}

for (const [vendor, schema] of [
  ["zod", zodSchema],
  ["valibot", valibotSchema],
]) {
  test(`${vendor}: whole-schema validation gates state.valid and attributes issues to field paths`, () => {
    const form = createStandardForm(schema, signupFields());

    assert.equal(form.f.age.value(), 18); // declared initial preserved
    assert.equal(form.state.valid(), false); // email is null → schema rejects

    form.f.email.set("a@b.co");
    assert.equal(form.state.valid(), true);

    form.f.age.set(16);
    assert.equal(form.state.valid(), false);
    assert.deepEqual(
      form.errorsFor("age")().map((e) => e.message),
      ["18+ only"],
    );
    assert.deepEqual(
      form.f.age.errors().map((e) => e.message),
      ["18+ only"], // form-level issues land on the field handle too
    );
  });
}

for (const [vendor, schema] of [
  [
    "zod",
    z.object({
      name: z.string().default("Ada"),
      tags: z.array(z.string()).default(["news"]),
    }),
  ],
  [
    "valibot",
    v.object({
      name: v.optional(v.string(), "Ada"),
      tags: v.optional(v.array(v.string()), ["news"]),
    }),
  ],
]) {
  test(`${vendor}: schema defaults seed field and array initials`, () => {
    const form = createStandardForm(schema, {
      name: field(""),
      tags: array(field("")),
    });

    assert.equal(form.f.name.value(), "Ada");
    assert.deepEqual(form.getValue().tags, ["news"]);
    assert.equal(form.state.valid(), true);
  });
}

test("nested issues map to dotted group paths", () => {
  const schema = z.object({
    address: z.object({ city: z.string().min(1, "City required") }),
  });
  const form = createStandardForm(schema, {
    address: group({ city: field("") }),
  });

  assert.equal(form.state.valid(), false);
  assert.deepEqual(
    form.errorsFor("address.city")().map((e) => e.message),
    ["City required"],
  );
  assert.ok(
    form.f.address.city.errors().some((e) => e.message === "City required"),
  );

  form.f.address.city.set("Rome");
  assert.equal(form.state.valid(), true);
});

test("object-level refinements surface on the issue path", () => {
  const schema = z
    .object({ password: z.string(), confirm: z.string() })
    .refine((value) => value.password === value.confirm, {
      path: ["confirm"],
      message: "Passwords do not match",
    });
  const form = createStandardForm(schema, {
    password: field("", [required()]),
    confirm: field("", [required()]),
  });

  form.f.password.set("secret-1");
  form.f.confirm.set("secret-2");
  assert.equal(form.state.valid(), false);
  assert.deepEqual(
    form.f.confirm.errors().map((e) => e.message),
    ["Passwords do not match"],
  );

  form.f.confirm.set("secret-1");
  assert.equal(form.state.valid(), true);
});

test("array item issues map to indexed dotted paths", () => {
  const schema = z.object({
    items: z
      .array(z.object({ name: z.string().min(1, "Name required") }))
      .min(1, "Add at least one item"),
  });
  const form = createStandardForm(schema, {
    items: array(group({ name: field("") })),
  });

  assert.deepEqual(
    form.errorsFor("items")().map((e) => e.message),
    ["Add at least one item"], // empty array → min(1) on the array path
  );

  form.f.items.push({ name: "" });
  assert.deepEqual(
    form.errorsFor("items.0.name")().map((e) => e.message),
    ["Name required"], // indexed path reaches the row field
  );

  form.f.items.at(0).name.set("First");
  assert.equal(form.state.valid(), true);
});

test("fully-async schemas are rejected up front with a clear error", () => {
  const asyncSchema = v.objectAsync({
    email: v.pipeAsync(
      v.string(),
      v.checkAsync(async () => true),
    ),
  });
  assert.throws(
    () => createStandardForm(asyncSchema, { email: field(null) }),
    /async schemas are not supported/,
  );
});

test("input-dependent async branches hold the form invalid with a global error", () => {
  // This schema parses {} synchronously (email fails first), so the
  // creation-time probe cannot see the async refinement.
  const asyncSchema = z.object({
    email: z.string().refine(async () => true),
  });
  const form = createStandardForm(asyncSchema, { email: field(null) });

  form.f.email.set("a@b.co"); // reaches the async branch → Promise
  assert.equal(form.state.valid(), false);
  // Path "" addresses the form itself: global (path-less) errors.
  const globalErrors = form.errorsFor("")().map((e) => e.message);
  assert.ok(
    globalErrors.some((m) => m.includes("async schemas are not supported")),
  );
});

test("buildStandardValidator works standalone and reports global issues", () => {
  const validator = buildStandardValidator(
    z.object({}).refine(() => false, { message: "Always invalid" }),
  );
  const errors = validator({});
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, null); // no path → global form error
  assert.equal(errors[0].kind, "schema");
  assert.equal(errors[0].message, "Always invalid");
});

for (const [vendor, schema] of [
  ["zod", zodSchema],
  ["valibot", valibotSchema],
]) {
  test(`${vendor}: serverValidate rejects a forged payload with submit-shaped errors`, async () => {
    const errors = await serverValidate(schema, { email: "bad", age: 10 });
    assert.deepEqual(
      errors.map((e) => ({ path: e.path, kind: e.kind, message: e.message })),
      [
        { path: "email", kind: "schema", message: "Invalid email" },
        { path: "age", kind: "schema", message: "18+ only" },
      ],
    );
  });

  test(`${vendor}: serverValidate returns no errors for a valid payload`, async () => {
    const errors = await serverValidate(schema, {
      email: "a@b.co",
      age: 20,
    });
    assert.deepEqual(errors, []);
  });
}

test("serverValidate awaits async schemas (unlike the sync form-level validator)", async () => {
  const asyncSchema = v.objectAsync({
    email: v.pipeAsync(
      v.string(),
      v.checkAsync(async (value) => value.includes("@"), "Invalid email"),
    ),
  });

  assert.deepEqual(await serverValidate(asyncSchema, { email: "a@b.co" }), []);
  assert.deepEqual(
    (await serverValidate(asyncSchema, { email: "nope" })).map(
      (e) => e.message,
    ),
    ["Invalid email"],
  );
});
