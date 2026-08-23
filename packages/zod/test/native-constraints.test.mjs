/**
 * A schema written in Zod reaches the keyboard.
 *
 * `.min(3).max(8)` already says what the field accepts; asking the author to write the same numbers
 * again on the control is how the two come to disagree. Only the checks with a native counterpart
 * are read — everything else stays a rule that runs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { createZodForm } from "../dist/index.js";

test("lengths, bounds, integers and an unflagged pattern cross over", () => {
  const form = createZodForm(
    z.object({
      code: z.string().min(3).max(8).regex(/^[A-Z]+$/),
      qty: z.number().int().min(0).max(255),
    }),
  );

  assert.deepEqual(
    { ...form.getField("code")().constraints() },
    {
      min: null, max: null, step: null,
      // Wrapped: what a control offers is the rule said the way an anchored attribute reads one.
      minLength: 3, maxLength: 8, pattern: "^[A-Z]+$",
      inputMode: null,
    },
  );
  assert.deepEqual(
    { ...form.getField("qty")().constraints() },
    {
      min: 0, max: 255, step: 1,
      minLength: null, maxLength: null, pattern: null,
      inputMode: null,
    },
  );
});

test("a piece that rejects empty still marks the field required", () => {
  const form = createZodForm(z.object({ name: z.string().min(1) }));
  assert.equal(form.getField("name")().required(), true);
});

test("what has no native counterpart declares nothing and still runs", () => {
  const form = createZodForm(
    z.object({ even: z.number().refine((n) => n % 2 === 0, "Must be even") }),
  );

  const constraints = form.getField("even")().constraints();
  assert.equal(constraints.min, null);
  assert.equal(constraints.step, null, "a refinement is not a step");

  form.f.even.set(3);
  assert.equal(form.getField("even")().valid(), false);
});

test("an exclusive bound is not offered, because a native one is inclusive", () => {
  const form = createZodForm(z.object({ over: z.number().gt(10) }));

  assert.equal(
    form.getField("over")().constraints().min,
    null,
    "min=10 would admit exactly the value the schema refuses",
  );
  form.f.over.set(10);
  assert.equal(form.getField("over")().valid(), false, "and the rule still refuses it");
});
