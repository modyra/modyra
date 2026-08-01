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

/* ── The value lifecycle ────────────────────────────────────────────────────────
 * The rest of the value dimension: not *what* a field holds but how what it holds changes. These
 * are the semantics every adapter inherits from the engine, so pinning them here pins them for all
 * three — none of the three has an event surface of its own that could disagree.
 */
import { createForm, field, required, vanillaReactivity, buildDynamicFieldValidators } from "../dist/index.js";

const formWith = (initial, validators = []) =>
  createForm({ f: field(initial, validators) }, vanillaReactivity());

test("a programmatic write does not make a field dirty", () => {
  const form = formWith("");
  form.f.f.set("hello");
  // `dirty` says the user changed it. A value pushed in from a draft, a fetch or a script has not
  // been touched by anyone, and a form that reported otherwise would prompt about unsaved work
  // nobody did.
  assert.equal(form.f.f.dirty(), false);
  assert.equal(form.f.f.touched(), false);
});

test("touched and dirty are independent of validity", () => {
  const form = formWith("", [required()]);
  assert.equal(form.f.f.valid(), false);
  assert.equal(form.f.f.touched(), false);
  form.f.f.markAsTouched();
  assert.equal(form.f.f.touched(), true);
  assert.equal(form.f.f.valid(), false, "touching a field does not fix it");
});

test("reset returns the value and clears what the interaction recorded", () => {
  const form = formWith("start");
  form.f.f.set("changed");
  form.f.f.markAsTouched();
  form.f.f.markAsDirty();
  form.reset();
  assert.equal(form.f.f.value(), "start");
  assert.equal(form.f.f.touched(), false);
  assert.equal(form.f.f.dirty(), false);
});

test("a value from outside that is not the kind's shape is invalid", () => {
  // The doorway `oneOf` guards for the option kinds, guarded for the rest: a restored draft, a
  // network config or a scripted write is not the widget's own value.
  const errorsFrom = (built, value) => built.validators.flatMap((v) => v(value));
  for (const [kind, wrong] of [["text", 42], ["number", "12"], ["checkbox", "yes"], ["daterange", "2026-01-01"]]) {
    const built = buildDynamicFieldValidators({ name: "f", kind, options: [] });
    assert.equal(errorsFrom(built, wrong).length >= 1, true, `${kind} accepted ${JSON.stringify(wrong)}`);
  }
});

test("the shape guard leaves emptiness to required", () => {
  const optional = buildDynamicFieldValidators({ name: "f", kind: "text" });
  assert.deepEqual(optional.validators.flatMap((v) => v(null)), [], "an optional field may hold nothing");
});
