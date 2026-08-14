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

test("a bounded repetition is not nesting, however deep it looks", () => {
  // The line the heuristic draws. `(a{2,4})+` repeats something that repeats, and the inner
  // repetition has a ceiling — the blowup needs both to be unbounded.
  assert.equal(dynamicPatternRefusal("^(a{2,4})+$"), null);
  assert.equal(dynamicPatternRefusal("^(a?)+$"), null);
  // …and an unbounded inner one is refused whichever spelling it arrives in.
  assert.ok(dynamicPatternRefusal("^(a{2,})+$"));
});

test("what the heuristic cannot read, it allows", () => {
  // A refusal removes a rule the document's author wrote, so anything undecidable goes through:
  // alternatives starting with a class, a dot or a group are not compared.
  assert.equal(dynamicPatternRefusal("^([a-z]|[0-9])+$"), null);
  assert.equal(dynamicPatternRefusal("^(.|x)+$"), null);
});
