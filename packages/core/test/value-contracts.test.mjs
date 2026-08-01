/**
 * The value dimension of the widget specification.
 *
 * A kind's value shape was agreed everywhere and written nowhere. The cost was measurable: a state
 * matrix handed `""` to every kind, so `daterange` received a string where two endpoints belong and
 * the row reported itself green. These tests are what make that impossible — and they are tied to
 * `mdyEmptyValueFor`, so the two answers to "what does this field hold" cannot drift apart.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_DYNAMIC_FIELD_KINDS,
  MDY_VALUE_CONTRACTS,
  explainValueMismatch,
  matchesValueShape,
  mdyEmptyValueFor,
} from "../dist/index.js";

const configFor = (kind) => ({ name: "f", kind, options: [] });

test("every kind the config knows declares a value contract", () => {
  const missing = MDY_DYNAMIC_FIELD_KINDS.filter((kind) => !MDY_VALUE_CONTRACTS[kind]);
  assert.deepEqual(missing, [], "a kind can be configured and holds an undeclared value shape");
});

test("a kind's empty value satisfies the contract it declares", () => {
  for (const kind of MDY_DYNAMIC_FIELD_KINDS) {
    const empty = mdyEmptyValueFor(configFor(kind));
    assert.equal(
      explainValueMismatch(kind, empty),
      null,
      `${kind}: its own empty value does not satisfy its declared shape`,
    );
  }
});

test("a nullable kind is exactly one whose empty value is absent", () => {
  for (const kind of MDY_DYNAMIC_FIELD_KINDS) {
    const empty = mdyEmptyValueFor(configFor(kind));
    // The converse is what carries the weight: a kind declaring itself nullable while holding a real
    // value when empty is a kind `required` cannot police, which is how `number` defaulted to 0.
    assert.equal(
      MDY_VALUE_CONTRACTS[kind].nullable,
      empty === null || empty === undefined,
      `${kind}: nullable=${MDY_VALUE_CONTRACTS[kind].nullable} but its empty value is ${JSON.stringify(empty)}`,
    );
  }
});

test("the shape check rejects the confusions that actually happened", () => {
  // The measured artefact: a driver passing "" to every kind.
  assert.match(explainValueMismatch("daterange", ""), /daterange holds dateRange/);
  assert.match(explainValueMismatch("multiselect", ""), /multiselect holds option\[\]/);
  assert.match(explainValueMismatch("number", ""), /number holds number/);
  assert.match(explainValueMismatch("checkbox", ""), /checkbox holds boolean/);

  // And a value that is right for its kind passes.
  assert.equal(explainValueMismatch("daterange", { start: null, end: null }), null);
  assert.equal(explainValueMismatch("multiselect", ["a"]), null);
  assert.equal(explainValueMismatch("number", 3), null);
  assert.equal(explainValueMismatch("text", ""), null);
});

test("a kind that cannot be empty rejects null", () => {
  assert.match(explainValueMismatch("slider", null), /slider cannot hold null/);
  assert.match(explainValueMismatch("checkbox", undefined), /checkbox cannot hold undefined/);
  assert.equal(explainValueMismatch("number", null), null);
});

test("NaN is not a number a field may hold", () => {
  assert.equal(matchesValueShape("number", Number.NaN), false);
  assert.match(explainValueMismatch("number", Number.NaN), /number holds number/);
});
