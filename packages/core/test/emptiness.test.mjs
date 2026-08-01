/**
 * What counts as empty, and what counts as incomplete.
 *
 * These are two different questions and they used to be one. `required` only understood strings,
 * arrays and nullish values, so every kind whose empty value is another shape escaped it: an
 * unchecked required checkbox and a required range with both ends unset both reported themselves
 * **valid**. Plain, Angular and Lit each ledgered that independently in their state matrices, which
 * is what identified it as a validation defect rather than a rendering one.
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
