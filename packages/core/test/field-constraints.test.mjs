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
import { compose, composeFirst, createForm, field, group, integer, max, maxLength, min, minLength, pattern, required, valueShape } from "../dist/index.js";

const boundsOf = (form, path) => {
  const { min, max } = form.getField(path)().constraints();
  return { min, max };
};

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

test("a composed validator carries the sum of what it combines", () => {
  const form = createForm({
    small: field(0, [compose(integer(), min(0), max(255))]),
  });

  // A fact stated by a rule survives every way of combining it: the composed rule declares the sum
  // of its parts, so the control offers the range and the field is judged by the same numbers.
  assert.deepEqual(boundsOf(form, "small"), { min: 0, max: 255 });
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

test("a bound that is not a finite number is not offered", () => {
  const form = createForm({
    odd: field(0, [min(Number.NaN), max(Number.POSITIVE_INFINITY)]),
    sane: field(0, [min(Number.NaN), max(10)]),
  });

  assert.deepEqual(
    boundsOf(form, "odd"),
    { min: null, max: null },
    "min=\"NaN\" on an input is ignored by the browser and misleading in a diff",
  );
  assert.deepEqual(boundsOf(form, "sane"), { min: null, max: 10 }, "the usable half survives");

  // The rule itself still runs — this is about what a control is offered, not about validity.
  assert.equal(form.getField("odd")().valid(), true);
});

/**
 * A fact stated by a rule survives every way of combining it.
 *
 * This is the property the whole mechanism rests on. Without it `compose(required(), …)` produces a
 * field that is not marked required — no `aria-required`, nothing for a screen reader — and the
 * caller has no way to notice.
 */
test("composition carries the required marker", () => {
  const form = createForm({
    plain: field("", [required()]),
    composed: field("", [compose(required(), maxLength(10))]),
    first: field("", [composeFirst(required(), maxLength(10))]),
    nested: field("", [compose(compose(required()), minLength(2))]),
  });

  for (const path of ["plain", "composed", "first", "nested"]) {
    assert.equal(form.getField(path)().required(), true, `${path} lost its marker`);
  }
});

test("composition carries every constraint, tightest first", () => {
  const form = createForm({
    text: field("", [compose(minLength(2), maxLength(20), maxLength(8))]),
    number: field(0, [compose(integer(), min(1), max(9))]),
  });

  const text = form.getField("text")().constraints();
  assert.equal(text.minLength, 2);
  assert.equal(text.maxLength, 8, "two ceilings, and the lower one is the one that holds");

  const number = form.getField("number")().constraints();
  assert.deepEqual(
    { min: number.min, max: number.max, step: number.step },
    { min: 1, max: 9, step: 1 },
  );
});

test("a rule with no native counterpart declares nothing, and still runs", () => {
  const form = createForm({
    even: field(0, [(value) => (value % 2 === 0 ? [] : ["Must be even"])]),
  });

  assert.deepEqual(form.getField("even")().constraints(), {
    min: null, max: null, step: null, minLength: null, maxLength: null,
    pattern: null, inputMode: null,
  });

  form.f.even.set(3);
  assert.equal(form.getField("even")().valid(), false, "the rule is untouched by having no facts");
});

test("two different patterns leave the field with none, and both rules in force", () => {
  const form = createForm({
    code: field("", [pattern(/^[A-Z]+$/), pattern(/^.{3}$/)]),
  });

  assert.equal(
    form.getField("code")().constraints().pattern,
    null,
    "an input carries one pattern, and inventing their intersection would be a rule nobody wrote",
  );

  form.f.code.set("ABCD");
  assert.equal(form.getField("code")().valid(), false, "the length rule still refuses it");
  form.f.code.set("ABC");
  assert.equal(form.getField("code")().valid(), true, "and both are satisfied together");
});

test("a flagged expression stays a rule", () => {
  const form = createForm({ code: field("", [pattern(/^a+$/i)]) });

  assert.equal(
    form.getField("code")().constraints().pattern,
    null,
    "`<input pattern>` has no flags, and offering the source without them would change the rule",
  );
  form.f.code.set("AAA");
  assert.equal(form.getField("code")().valid(), true, "case-insensitive, as written");
});

/**
 * A blank field and an empty collection are not the same emptiness.
 *
 * `<input minlength>` does not apply to an empty value, and `required` is the rule that refuses one.
 * A collection is the other way round: `minLength(1)` is how "at least one row" is said, and
 * exempting `[]` would take away the thing the rule is most often there to do.
 */
test("minLength lets a blank field through and still refuses an empty collection", () => {
  const rule = minLength(2);

  assert.deepEqual(rule(""), [], "blank is required's question, not this one");
  assert.deepEqual(rule(null), []);
  assert.equal(rule("a").length, 1, "one character is short");
  assert.deepEqual(rule("ab"), []);

  assert.equal(minLength(1)([]).length, 1, "an empty collection is short");
  assert.deepEqual(minLength(1)(["one"]), []);
});

test("a blank field with a length rule is valid until required says otherwise", () => {
  const optional = createForm({ note: field("", [minLength(2)]) });
  assert.equal(optional.state.valid(), true);

  const mandatory = createForm({ note: field("", [required(), minLength(2)]) });
  assert.equal(mandatory.state.valid(), false, "required is what refuses the blank");

  mandatory.f.note.set("a");
  assert.equal(mandatory.state.valid(), false, "and one character is still short");
  mandatory.f.note.set("ab");
  assert.equal(mandatory.state.valid(), true);
});

/**
 * A number that is not a number.
 *
 * `NaN` is the value every comparison lets through: `NaN < 0` is false, `NaN > 9` is false, and it
 * is neither null nor empty — so a field holding one used to report itself **valid**, and
 * `JSON.stringify` then wrote `null` on the wire. A form that says it is valid and sends nothing is
 * the worst of both answers.
 */
test("a field holding NaN is not valid, and says why", () => {
  const form = createForm({ qty: field(1.5, [required(), min(0), max(9)]) });

  form.f.qty.set(Number.NaN);

  assert.equal(form.state.valid(), false);
  const messages = form.getField("qty")().errors().map((e) => e.message);
  assert.ok(messages.some((m) => /required/i.test(m)), "there is no answer here");
  assert.ok(messages.some((m) => /Minimum/.test(m)), "and it is within no bound");
});

test("what would have reached the server", () => {
  const form = createForm({ qty: field(1, [min(0)]) });
  form.f.qty.set(Number.NaN);

  // The reason this matters beyond validity: the value does not survive serialisation, so a form
  // that let it through would send `null` for a field its own rules called fine.
  assert.equal(JSON.parse(JSON.stringify({ qty: form.getValue().qty })).qty, null);
  assert.equal(form.state.valid(), false, "which is why the rules refuse it first");
});

test("an unbounded number field still holds what it is given", () => {
  const form = createForm({ ratio: field(0) });

  form.f.ratio.set(Number.NaN);
  assert.equal(form.state.valid(), true, "no rule was stated, so nothing objects");
  assert.ok(Number.isNaN(form.getValue().ratio), "and the model is not repaired behind anyone's back");
});

test("valueShape is the rule a data-only document applies for you", () => {
  // A document declares a kind, so it gets this automatically. A typed schema declares a type, and
  // TypeScript refuses the wrong one at compile time — but a value arriving from a server, a draft
  // or a cast does not go through TypeScript, and this is how a typed schema asks the same question.
  const form = createForm({ name: field("", [valueShape("text")]) });

  form.f.name.set(42);
  assert.equal(form.state.valid(), false, "a text field was handed a number");

  form.f.name.set("ok");
  assert.equal(form.state.valid(), true);
});
