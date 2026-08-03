/**
 * What counts as empty, and what counts as incomplete.
 *
 * These are two different questions. A `required` that understands only strings, arrays and nullish
 * values lets every kind whose empty value is another shape escape it: an unchecked required
 * checkbox and a required range with both ends unset both report themselves **valid**. That is a
 * validation defect, not a rendering one — every adapter shows it identically.
 *
 * Nothing rejected a *half-set* range at all, and that is not the same defect. A range is one value
 * with two halves; half of one names no interval, so it is wrong whether or not the field is
 * required. `required` answers "may this be left empty"; `completeRange` answers "is this a range".
 *
 * The matrices prove the renderers agree. This proves the rules themselves, because a matrix can
 * only observe the states a form can actually reach — which is exactly how the defect hid.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_DYNAMIC_FIELD_KINDS,
  mdyEmptyValueFor,
  buildDynamicFieldValidators,
  completeRange,
  required,
} from "../dist/index.js";

const fails = (validator, value) => validator(value).length > 0;

test("required treats every kind's own empty value as empty", () => {
  const r = required();

  // The shapes it always understood.
  assert.ok(fails(r, null), "null");
  assert.ok(fails(r, undefined), "undefined");
  assert.ok(fails(r, ""), "empty string");
  assert.ok(fails(r, "   "), "blank string");
  assert.ok(fails(r, []), "empty array");

  // The shapes it did not, and the reason this task exists.
  assert.ok(fails(r, false), "an unchecked checkbox is empty, as in HTML");
  assert.ok(fails(r, { start: null, end: null }), "a range with neither end set is empty");
  assert.ok(fails(r, { start: "", end: "" }), "a cleared date input reports \"\", not null");

  // And what it must still accept.
  assert.ok(!fails(r, true), "a checked checkbox");
  assert.ok(!fails(r, "x"), "text");
  assert.ok(!fails(r, 0), "zero is a number, not an absence");
  assert.ok(!fails(r, ["a"]), "a chosen option");
  assert.ok(!fails(r, { start: "2026-07-15", end: "2026-07-20" }), "a whole range");
});

test("a partial range is not empty — required is not the rule that catches it", () => {
  const r = required();
  assert.ok(!fails(r, { start: "2026-07-15", end: null }), "half a range is not empty");
  assert.ok(!fails(r, { start: null, end: "2026-07-20" }), "either half");
});

test("completeRange rejects a half-set range and nothing else", () => {
  const c = completeRange();

  assert.ok(fails(c, { start: "2026-07-15", end: null }), "start without end");
  assert.ok(fails(c, { start: null, end: "2026-07-20" }), "end without start");
  assert.ok(fails(c, { start: "2026-07-15", end: "" }), "a cleared end is unset");

  // Empty is `required`'s question, not this one's. Answering it here too would give a field two
  // errors for one mistake.
  assert.ok(!fails(c, { start: null, end: null }), "empty is allowed");
  assert.ok(!fails(c, { start: "2026-07-15", end: "2026-07-20" }), "whole");

  // Structural, so it must ignore anything that is not a range rather than guess.
  assert.ok(!fails(c, null), "null");
  assert.ok(!fails(c, "text"), "a string");
  assert.ok(!fails(c, { a: 1 }), "an unrelated object");
});

test("a daterange field carries completeRange whether or not it is required", () => {
  // The kind-intrinsic mechanism `oneOf`/`eachOneOf` already use: the rule belongs to the kind, so
  // an optional range cannot be submitted half-set.
  const optional = buildDynamicFieldValidators({ name: "trip", kind: "daterange" });
  const errors = optional.validators.flatMap((fn) => fn({ start: "2026-07-15", end: null }));
  assert.equal(errors.length, 1, "an optional range is still rejected when half-set");
  assert.equal(optional.marksRequired, false);

  const empty = optional.validators.flatMap((fn) => fn({ start: null, end: null }));
  assert.deepEqual(empty, [], "an optional range may be left entirely empty");
});

test("a required daterange rejects empty and half-set for different reasons", () => {
  const field = buildDynamicFieldValidators({
    name: "trip",
    kind: "daterange",
    validators: { required: true },
  });
  assert.ok(field.marksRequired);

  const run = (value) => field.validators.flatMap((fn) => fn(value));
  assert.equal(run({ start: null, end: null }).length, 1, "empty: required alone");
  assert.equal(run({ start: "2026-07-15", end: null }).length, 1, "half-set: completeRange alone");
  assert.deepEqual(run({ start: "2026-07-15", end: "2026-07-20" }), [], "whole: neither");
});

/* ── What a kind holds when it holds nothing ────────────────────────────────────
 * The empty value is the other half of the same question: `required` can only reject what it is
 * given, so a kind whose empty value is a *usable* one is a kind `required` cannot police. The table
 * belongs in the engine: held by a renderer, it would answer only for the forms that renderer built.
 */
test("every kind has an empty value, and it is not a value the user might mean", () => {
  const emptyFor = (kind, extra = {}) => mdyEmptyValueFor({ name: "f", kind, ...extra });

  assert.equal(emptyFor("number"), null, "0 is a number a user may mean");
  assert.equal(emptyFor("text"), "");
  assert.equal(emptyFor("email"), "");
  assert.equal(emptyFor("checkbox"), false);
  assert.equal(emptyFor("select", { options: [] }), null);
  assert.deepEqual(emptyFor("multiselect", { options: [] }), []);
  assert.deepEqual(emptyFor("daterange"), { start: null, end: null });

  // A thumb is always somewhere, so a slider is the one kind whose empty value is a real one — and
  // it is the slider's own minimum, not zero.
  assert.equal(emptyFor("slider", { min: 10, max: 20 }), 10);
  assert.equal(emptyFor("slider"), 0);

  // An explicit initial value always wins.
  assert.equal(emptyFor("number", { initialValue: 42 }), 42);
});

test("a required field is invalid at its empty value, for every kind that can be empty", () => {
  const check = required();
  for (const kind of MDY_DYNAMIC_FIELD_KINDS) {
    // The slider is the documented exception: it always holds a position, so it is never empty.
    if (kind === "slider") continue;
    const empty = mdyEmptyValueFor({ name: "f", kind, options: [] });
    assert.equal(
      check(empty).length > 0,
      true,
      `${kind}: required accepts its own empty value (${JSON.stringify(empty)})`,
    );
  }
});
