/**
 * A rule written by hand and the same rule declared by name are one rule.
 *
 * `rules: { minLength: 3 }` is a shorthand for `[minLength(3)]`, and the whole claim is that it is
 * *only* a shorthand — the same validator, the same facts, the same message. A second path that
 * happened to agree on the cases someone thought to write would be a second engine waiting to
 * diverge.
 *
 * So the cases are generated from `declaredRuleNames()` rather than listed. A rule that declares
 * itself tomorrow is checked here the day it does, and one that quietly stops declaring itself
 * fails the roll-call below rather than slipping out of the suite unnoticed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDeclaredRules,
  createForm,
  declarationOf,
  declaredRuleNames,
  declaredRuleShape,
  factsOfAll,
  field,
  oneOf,
} from "../dist/index.js";
import * as core from "../dist/index.js";

/** A value of the shape a rule says it takes, so one case can be built for any of them. */
const SAMPLE = { number: 3, string: "abc", pattern: /^[A-Z]+$/ };

/** What each rule is given, and a value that breaks it, derived from what it declares. */
function caseFor(rule) {
  const shape = declaredRuleShape(rule);
  const args = shape.takes.map((takes) => SAMPLE[takes]);
  const declared = shape.takes.length === 0 ? true : args.length === 1 ? args[0] : args;
  // A value that fails every rule in the vocabulary: empty fails `required` and `minLength`, is not
  // an address, is not a whole number, and does not match the sample pattern.
  const breaking = rule === "max" || rule === "maxLength" ? "abcdefghij" : rule === "min" ? 0 : "";
  return { args, declared, breaking };
}

test("the vocabulary is not empty, or every case below is vacuous", () => {
  assert.ok(declaredRuleNames().length >= 5, `only ${declaredRuleNames().length} rules declare a name`);
});

for (const rule of declaredRuleNames()) {
  test(`${rule}: declared by name is the rule written by hand`, () => {
    const { args, declared, breaking } = caseFor(rule);
    const byHand = core[rule](...args);

    // The facts, which is what reaches the native control.
    assert.deepEqual(
      factsOfAll(buildDeclaredRules({ [rule]: declared }).validators),
      factsOfAll([byHand]),
      `${rule} declared and ${rule} written by hand carry different facts`,
    );

    // And the verdict, which is what reaches the person.
    const written = createForm({ x: field("", [byHand]) });
    const spoken = createForm({ x: field("", [], { rules: { [rule]: declared } }) });
    written.f.x.set(breaking);
    spoken.f.x.set(breaking);
    assert.deepEqual(
      spoken.f.x.errors(),
      written.f.x.errors(),
      `${rule} said the two ways refused differently`,
    );
  });
}

test("a name no rule declares is refused, and the refusal lists what is available", () => {
  const { validators, refusals } = buildDeclaredRules({ notARule: true });
  assert.deepEqual(validators, []);
  assert.equal(refusals.length, 1);
  assert.match(refusals[0].because, /no validator declares the name "notARule"/);
  for (const rule of declaredRuleNames()) {
    assert.match(refusals[0].because, new RegExp(`\\b${rule}\\b`), `${rule} is missing from the list offered`);
  }
});

test("a field refuses to be built from a rule it cannot make", () => {
  assert.throws(
    () => field("", [], { rules: { minLength: "three" } }),
    (error) => {
      assert.match(error.message, /minLength/);
      assert.match(error.message, /expects number/);
      return true;
    },
    "a field built with less than it was told to enforce",
  );
});

/**
 * `oneOf` stays out, and the reasoning is on its definition: a field's `options` is the declarative
 * form of that list, and a document carrying it twice could disagree with itself.
 *
 * Asserted rather than trusted to prose. Adding `rule: "oneOf"` in a later edit would look like
 * completeness and undo a decision, so it fails here instead.
 */
test("oneOf is not declarable, which is the decision and not an omission", () => {
  assert.equal(declarationOf(oneOf([1, 2])), undefined);
  assert.ok(!declaredRuleNames().includes("oneOf"), "oneOf offered itself to documents");
});
