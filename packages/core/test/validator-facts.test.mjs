/**
 * The facts API itself, asserted directly.
 *
 * Everything else exercises it from above — a field's constraints, a control's attributes — which
 * proves the path and not the contract. These are the four functions an adapter author reaches for
 * when they build their own validators, and each has a promise that nothing else was checking.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_MARKS_REQUIRED,
  factsOf,
  factsOfAll,
  maxLength,
  mergeFacts,
  min,
  required,
  withFacts,
} from "../dist/index.js";

test("withFacts leaves the function it is given alone", () => {
  const shared = () => [];
  const declared = withFacts(shared, { maxLength: 5 });

  assert.deepEqual(factsOf(shared), {}, "a caller's own function is not tagged behind their back");
  assert.deepEqual(factsOf(declared), { maxLength: 5 });
  assert.deepEqual(declared("anything"), [], "and it still runs what it wraps");
});

test("withFacts adds to what a rule already declared", () => {
  const bounded = withFacts(withFacts(() => [], { min: 1 }), { max: 9 });

  assert.deepEqual(factsOf(bounded), { min: 1, max: 9 });
});

test("factsOf reads the marker an adapter set before this module existed", () => {
  const legacy = Object.assign(() => [], { [MDY_MARKS_REQUIRED]: true });

  assert.deepEqual(factsOf(legacy), { required: true });
  assert.deepEqual(factsOf(() => []), {}, "and says nothing about a plain rule");
  assert.deepEqual(factsOf("not a function"), {});
});

test("mergeFacts keeps the tightest of each end", () => {
  const { constraints, required: isRequired } = mergeFacts([
    { min: 0, max: 100 },
    { min: 10, max: 50 },
    { minLength: 2 },
    { maxLength: 8 },
    { required: true },
  ]);

  assert.equal(constraints.min, 10, "the higher floor");
  assert.equal(constraints.max, 50, "the lower ceiling");
  assert.equal(constraints.minLength, 2);
  assert.equal(constraints.maxLength, 8);
  assert.equal(isRequired, true, "required if any of them is");
});

test("mergeFacts drops a bound that is not a finite number", () => {
  const { constraints } = mergeFacts([{ min: Number.NaN }, { max: Number.POSITIVE_INFINITY }, { max: 10 }]);

  assert.equal(constraints.min, null, 'min="NaN" is ignored by the browser and misleading in a diff');
  assert.equal(constraints.max, 10, "and the usable ceiling survives beside it");
});

test("mergeFacts refuses to invent an intersection of two patterns", () => {
  const one = mergeFacts([{ pattern: "^a+$" }]);
  const two = mergeFacts([{ pattern: "^a+$" }, { pattern: "^.{3}$" }]);

  // Wrapped, because the constraint is what a control offers and `<input pattern>` is implicitly
  // anchored; an expression already carrying both anchors means the same either way.
  assert.equal(one.constraints.pattern, "^a+$");
  assert.equal(one.conflictingPatterns, false);
  assert.equal(two.constraints.pattern, null);
  assert.equal(two.conflictingPatterns, true, "reported, so a caller can say why none is offered");
});

test("factsOfAll sums a list of validators", () => {
  const { constraints, required: isRequired } = factsOfAll([required(), maxLength(8), min(1), () => []]);

  assert.equal(isRequired, true);
  assert.equal(constraints.maxLength, 8);
  assert.equal(constraints.min, 1);
});
