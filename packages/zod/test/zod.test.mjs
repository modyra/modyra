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

test("z.record(z.object()) becomes a keyed collection, not one opaque field", () => {
  // The engine has held keyed collections since ADR 0026, and a record derived from a schema has to
  // reach them: as a leaf the value was a single object no row could be added to — and, since a
  // record rejects null, a form invalid from its first moment.
  const form = createZodForm(
    z.object({ rates: z.record(z.string(), z.object({ price: z.number().min(1) })) }),
  );

  assert.deepEqual(form.getValue().rates, {}, "a record with no rows is an object, not null");
  assert.equal(form.state.valid(), true, "the form was born invalid with nothing wrong in it");

  form.f.rates.upsert("base", { price: 10 });
  form.f.rates.cell("base", "price").set(12);
  assert.deepEqual(form.getValue().rates, { base: { price: 12 } });
  assert.equal(Array.isArray(form.getValue().rates), false, "a keyed collection must not read as a list");

  // The schema's own rule still runs on the row.
  form.f.rates.cell("base", "price").set(0);
  assert.equal(form.state.valid(), false);

  form.f.rates.remove("base");
  assert.deepEqual(form.getValue().rates, {});
  assert.equal(form.state.valid(), true);
});

test("a record of scalars, a record in a group, and a record with a default", () => {
  const scalars = createZodForm(z.object({ m: z.record(z.string(), z.string().min(1)) }));
  scalars.f.m.upsert("k", "v");
  assert.deepEqual(scalars.getValue().m, { k: "v" });

  const nested = createZodForm(z.object({ g: z.object({ m: z.record(z.string(), z.string()) }) }));
  assert.deepEqual(nested.getValue(), { g: { m: {} } }, "a record inside a group stayed a leaf");

  // A default is what the piece parses `undefined` into — the rule arrays already follow.
  const seeded = createZodForm(z.object({ m: z.record(z.string(), z.string()).default({ a: "x" }) }));
  assert.deepEqual(seeded.getValue().m, { a: "x" });
});

test("only a record becomes a record: every other shape degrades as it did", () => {
  // The risk of teaching the adapter a new node is teaching it too much. The engine has no tuple, no
  // set and no map, and inventing a structure the schema does not declare would be worse than a leaf.
  const others = createZodForm(
    z.object({
      t: z.tuple([z.string()]),
      s: z.set(z.string()),
      nestedArrays: z.array(z.array(z.string())),
    }),
  );
  const value = others.getValue();
  assert.equal(value.t, null, "a tuple stopped being a leaf");
  assert.equal(value.s, null, "a set stopped being a leaf");
  assert.deepEqual(value.nestedArrays, [], "an array of arrays is still an array of leaves");
  assert.equal(typeof others.f.nestedArrays.push, "function");
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
