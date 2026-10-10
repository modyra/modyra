/**
 * The snapshot's form verdict is the verdict the form itself reaches: a form-level error makes it
 * invalid, and a disabled field does not.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required, vanillaReactivity } from "../dist/index.js";
import { mdyServerSnapshot } from "../dist/server-snapshot.js";

test("a form-level error makes the snapshot invalid", () => {
  const form = createForm(
    { a: field("x"), b: field("y") },
    { validators: [(v) => (v.a === v.b ? [] : ["a and b must match"])] },
  );
  assert.equal(form.state.valid(), false);
  assert.equal(mdyServerSnapshot(form, vanillaReactivity()).verdict, "invalid");
});

test("a disabled field's failure does not make the snapshot invalid", () => {
  const form = createForm({ a: field("", [required()]), b: field("ok") });
  form.setDisabled("a", () => true);
  assert.equal(form.state.valid(), true);
  assert.equal(mdyServerSnapshot(form, vanillaReactivity()).verdict, "valid");
});
