/**
 * A bound stated once.
 *
 * A range is a rule and an input constraint at the same time, and until now those were two
 * declarations: a `max(255)` in the schema, and a `max` on the control, written by hand and free to
 * disagree with it. What is asserted here is that the second one is not a declaration at all — the
 * field reports the range its own validators state, and a control that offers it at the keyboard is
 * reading the rule rather than repeating it.
 *
 * The integer rule is here for the same reason: a field that accepts `1.5` for a count reports
 * itself valid and fails later, wherever the value is finally parsed, with no field to name.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compose, createForm, field, group, integer, max, maxLength, min, required } from "../dist/index.js";

const boundsOf = (form, path) => form.getField(path)().bounds();

test("a field reports the range its validators state", () => {
  const form = createForm({
    quantity: field(0, [min(0), max(255)]),
    free: field(0),
  });

  assert.deepEqual(boundsOf(form, "quantity"), { min: 0, max: 255 });
  assert.deepEqual(boundsOf(form, "free"), { min: null, max: null }, "no rule, no constraint");
});

test("one endpoint alone is a range with an open side", () => {
  const form = createForm({ age: field(0, [min(18)]) });
  assert.deepEqual(boundsOf(form, "age"), { min: 18, max: null });
});

test("the tightest statement wins when two rules bound the same field", () => {
  const form = createForm({
    port: field(0, [min(0), max(65535), min(1024), max(49151)]),
  });

  assert.deepEqual(
    boundsOf(form, "port"),
    { min: 1024, max: 49151 },
    "widening either endpoint would admit what one of the rules refuses",
  );
});

test("a composed validator reports nothing rather than something wrong", () => {
  const form = createForm({
    small: field(0, [compose(integer(), min(0), max(255))]),
  });

  // `compose` returns one function, and the bounds inside it are not readable from the outside.
  // The field reports nothing rather than something wrong: a control offers no constraint, and the
  // rule still rejects the value.
  assert.deepEqual(boundsOf(form, "small"), { min: null, max: null });
});

test("the bounds follow a field whose rules change", () => {
  const form = createForm({ quantity: field(0) });
  assert.deepEqual(boundsOf(form, "quantity"), { min: null, max: null });

  form.upsertValidators("quantity", "runtime", [min(1), max(9)]);
  assert.deepEqual(boundsOf(form, "quantity"), { min: 1, max: 9 });

  form.removeValidators("quantity", "runtime");
  assert.deepEqual(boundsOf(form, "quantity"), { min: null, max: null });
});

test("integer refuses what a whole-number field cannot hold", () => {
  const rule = integer();

  assert.deepEqual(rule(3), []);
  assert.deepEqual(rule(-3), [], "negative is a whole number; use min(0) to refuse it");
  assert.deepEqual(rule(null), [], "empty is required's question");
  assert.deepEqual(rule(undefined), []);
  assert.equal(rule(1.5).length, 1);
  assert.equal(rule(Number.NaN).length, 1, "not a number is not a whole number");
  assert.equal(rule(Number.POSITIVE_INFINITY).length, 1);
});

test("an unsigned integer field is three rules, and they compose", () => {
  const rules = [integer(), min(0), max(255)];
  const errorsFor = (value) => rules.flatMap((rule) => rule(value));

  assert.deepEqual(errorsFor(200), []);
  assert.equal(errorsFor(-1).length, 1, "below the floor");
  assert.equal(errorsFor(256).length, 1, "above the ceiling");
  assert.equal(errorsFor(1.5).length, 1, "not whole");
});

test("a length rule applies to a field that may be empty", () => {
  /** @type {import("../dist/index.js").ValidatorFn<string | null>} */
  const rule = maxLength(3);

  assert.deepEqual(rule(null), [], "empty passes; required() is the rule that refuses it");
  assert.deepEqual(rule("abc"), []);
  assert.equal(rule("abcd").length, 1);

  const form = createForm({
    note: field(/** @type {string | null} */ (null), [maxLength(3)]),
  });
  assert.equal(form.getField("note")().valid(), true);
});

test("required and a bound answer different questions", () => {
  const form = createForm({
    quantity: field(/** @type {number | null} */ (null), [required(), min(1)]),
  });

  assert.equal(form.getField("quantity")().valid(), false, "empty fails required, not min");
  assert.deepEqual(boundsOf(form, "quantity"), { min: 1, max: null }, "the bound is stated either way");
});

test("bounds live on the state a group's child reports", () => {
  const form = createForm({
    order: group({ quantity: field(0, [min(1), max(10)]) }),
  });

  assert.deepEqual(boundsOf(form, "order.quantity"), { min: 1, max: 10 });
});
