import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createZodForm, serverValidate } from "../dist/index.js";

test("schema-first form in plain Node: types, defaults, required, refinements", async () => {
  const form = createZodForm(
    z.object({
      email: z.string().email(),
      age: z.number().min(18).default(18),
      address: z.object({ city: z.string().min(1) }),
    }).refine((v) => v.age >= 21 || v.address.city !== "", {
      path: ["address", "city"],
      message: "City required under 21",
    }),
  );

  assert.equal(form.f.age.value(), 18); // default seeds the initial value
  assert.equal(form.f.email.required(), true);
  assert.equal(form.state.valid(), false);

  form.f.email.set("a@b.co");
  form.f.address.city.set("Rome");
  assert.equal(form.state.valid(), true);

  form.f.address.city.set("");
  assert.ok(form.f.address.city.errors().length >= 1); // piece + refinement paths
});

test("z.array(z.object()) becomes a typed field array", () => {
  const form = createZodForm(
    z.object({
      items: z.array(
        z.object({ name: z.string().min(1), qty: z.number().min(1) }),
      ).min(1),
    }),
  );

  assert.deepEqual(form.getValue().items, []);
  assert.equal(form.state.valid(), false); // min(1) on the empty array

  form.f.items.push({ name: "First", qty: 2 });
  assert.equal(form.f.items.length(), 1);
  assert.equal(form.state.valid(), true);

  form.f.items.rows()[0].name.set("");
  assert.ok(form.f.items.rows()[0].name.errors().length >= 1);
  assert.equal(form.state.valid(), false);

  form.f.items.remove(0);
  assert.deepEqual(form.getValue().items, []);
  assert.equal(form.state.valid(), false);
});

test("z.array() of a scalar becomes an array of leaf field handles", () => {
  const form = createZodForm(
    z.object({ tags: z.array(z.string().min(1)) }),
  );

  form.f.tags.push("a");
  form.f.tags.push("b");
  assert.deepEqual(form.getValue().tags, ["a", "b"]);
  assert.equal(form.f.tags.rows()[0].value(), "a");
});

test("serverValidate rejects a forged payload with submit-shaped errors", () => {
  const schema = z.object({
    email: z.string().email("Invalid email"),
    address: z.object({ city: z.string().min(1, "City required") }),
  });

  const errors = serverValidate(schema, {
    email: "not-an-email",
    address: { city: "" },
  });

  assert.deepEqual(
    errors.map((e) => ({ path: e.path, kind: e.kind, message: e.message })),
    [
      { path: "email", kind: "schema", message: "Invalid email" },
      { path: "address.city", kind: "schema", message: "City required" },
    ],
  );
});

test("serverValidate returns no errors for a valid payload", () => {
  const schema = z.object({ email: z.string().email() });
  assert.deepEqual(serverValidate(schema, { email: "a@b.co" }), []);
});
