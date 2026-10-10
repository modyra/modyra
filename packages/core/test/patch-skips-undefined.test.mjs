/**
 * `patchValue` and `setValue` agree that `undefined` states nothing: the field keeps its value.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../dist/index.js";

test("patchValue ignores an undefined entry, as setValue does", () => {
  const form = createForm({ a: field("x"), b: field("y") });
  form.patchValue({ a: undefined, b: "z" });
  assert.deepEqual(form.value(), { a: "x", b: "z" });
});
