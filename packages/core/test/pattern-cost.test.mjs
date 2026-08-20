/**
 * Which document patterns the engine refuses to run.
 *
 * The refusal is a heuristic over the *shape* of a pattern, because JavaScript gives no way to bound
 * a match's cost from outside it. So both directions matter equally: the shapes that backtrack
 * exponentially have to be caught, and the ordinary patterns a form is actually written with have to
 * survive — a check that refused those would be worse than the defect, because it would silently
 * drop rules nobody could see were gone.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { dynamicPatternRefusal } from "../dist/dynamic/pattern-cost.js";

/** Measured at 12.6 seconds for thirty characters and a miss, and the shapes around it. */
const EXPONENTIAL = [
  "(a+)+$",
  "^(a*)*$",
  "^(a|a)*$",
  "^(a|ab)+$",
  "^(([a-z])+)+$",
  "(\\d+)*$",
  "^((ab)*)*$",
  // The same ambiguity written as a class rather than as a repeated literal. Nobody writes
  // `(a|a)`; people write "word characters or letters" without noticing the second is contained
  // in the first — measured at 338ms for 22 characters and 5.4s for 26.
  "^([a-z]|[a-z])*$",
  "^([a-z]|a)*$",
  "^(\\w|[a-z])*$",
  "^(.|x)+$",
];

const ORDINARY = [
  "^\\d{5}$",
  "^[a-z]+$",
  "^(foo|bar)+$",
  "^\\d{3}-\\d{4}$",
  "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
  "^(?:https?://)?[\\w.-]+$",
  "^(\\d{3}-)*\\d{4}$",
  "^.*$",
  "^[^@]+@[^@]+$",
  "^(cat|dog|bird)$",
  "^\\+?[0-9 ()-]{7,15}$",
  "^[A-Z]{2}\\d{2}[A-Z0-9]{4,30}$",
];

test("a shape that backtracks exponentially is refused, and says which shape", () => {
  for (const source of EXPONENTIAL) {
    const refusal = dynamicPatternRefusal(source);
    assert.ok(refusal, `${source} was allowed`);
    assert.match(refusal, /backtracks exponentially/);
  }
});

test("the patterns a form is actually written with are left alone", () => {
  for (const source of ORDINARY) {
    assert.equal(dynamicPatternRefusal(source), null, `${source} was refused`);
  }
});

test("what decides is a variable body, not an unbounded one", () => {
  // The line the heuristic draws, and it is not about ceilings. A body whose length can vary offers
  // the engine several ways to divide the same input, and repeating it multiplies them — the
  // ceiling on the inner repetition only puts a number on how many. Measured, `^(a{1,10})+b$`
  // reaches 5.4 seconds at thirty characters, which `(a+)+` does at the same size.
  assert.ok(dynamicPatternRefusal("^(a{2,4})+$"));
  assert.ok(dynamicPatternRefusal("^(a?)+$"));
  assert.ok(dynamicPatternRefusal("^(a{2,})+$"));

  // And a counted repetition is not a way out of it: the exponent is written as a number instead of
  // being the length of the input, and fifteen is already seconds.
  assert.ok(dynamicPatternRefusal("^(a+){15}b$"));
  assert.ok(dynamicPatternRefusal("^([a-z]+){12}!$"));
  assert.ok(dynamicPatternRefusal("(.*a){20}$"));
});

test("a fixed-length body repeated is left alone", () => {
  // The other half of the same line, and the one that keeps the check usable: a body that always
  // consumes the same number of characters gives the engine one way to divide the input and nothing
  // to backtrack over, however many times it is repeated.
  assert.equal(dynamicPatternRefusal("(\\d{2}){3}"), null);
  assert.equal(dynamicPatternRefusal("^(a{3}){4}$"), null);
  assert.equal(dynamicPatternRefusal("^(abc)+$"), null);

  // A group's kind is not a quantifier. `(?:`, a lookahead, a lookbehind and a named group all
  // begin with `?`, and reading it as one made every non-capturing group look variable.
  assert.equal(dynamicPatternRefusal("^(?:ab){3}$"), null);
  assert.equal(dynamicPatternRefusal("^(?<year>\\d{4})-(?<month>\\d{2})$"), null);
  assert.equal(dynamicPatternRefusal("^(?=.*\\d)[a-z]{8,}$"), null);
  assert.equal(dynamicPatternRefusal("(?<!x)(\\d{2}){4}"), null);
});

test("alternatives that cannot match the same character are left alone", () => {
  // The line that makes the check usable: two classes are only ambiguous when they share a
  // character, and refusing every alternation containing a class would delete rules that are
  // perfectly safe — worse for a document's author than the defect.
  assert.equal(dynamicPatternRefusal("^([a-z]|[0-9])+$"), null);
  assert.equal(dynamicPatternRefusal("^([a-z]+|[0-9]+)$"), null);
  assert.equal(dynamicPatternRefusal("^(\\d|-)+$"), null);
  // `(.|\n)*` is the ordinary way to write "any character at all", and `.` does not match a
  // newline — so the two branches genuinely cannot overlap.
  assert.equal(dynamicPatternRefusal("^(.|\\n)*$"), null);
});

test("what the heuristic cannot read, it allows", () => {
  // A refusal removes a rule the document's author wrote, so anything undecidable goes through: a
  // branch that starts with a group, a backreference, or something that may not be there at all.
  assert.equal(dynamicPatternRefusal("^((a)|b)+$"), null);

  // `^(a?b|a)+$` used to be here, on the same reasoning: its first character cannot be decided, so
  // the branch comparison cannot say whether the alternatives overlap. The other axis decides it
  // without needing to — `a?` makes the body variable, and a variable body repeated is the shape —
  // which is what a second reading buys over a wider first one.
  assert.ok(dynamicPatternRefusal("^(a?b|a)+$"));
});
