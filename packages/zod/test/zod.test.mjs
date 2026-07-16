import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createZodForm } from "../dist/index.js";

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
