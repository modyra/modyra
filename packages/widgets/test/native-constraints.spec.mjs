/**
 * The translation from rules to attributes, and the one rule about narrowing.
 *
 * The renderers assert that the attributes arrive; this asserts what they are — including the two
 * cases a renderer cannot show: a kind that carries none of them, and a control asking for more
 * than its field allows.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { nativeConstraintAttributes, narrowConstraints } = await import("../dist/index.js");

const NONE = {
  min: null, max: null, step: null, minLength: null, maxLength: null, pattern: null, inputMode: null,
};
const ALL = {
  min: 1, max: 9, step: 1, minLength: 2, maxLength: 8, pattern: "^a+$", inputMode: "numeric",
};

test("a kind carries only what its control understands", () => {
  assert.deepEqual(nativeConstraintAttributes("text", ALL), {
    minlength: "2", maxlength: "8", pattern: "^a+$", inputmode: "numeric",
  });
  assert.deepEqual(nativeConstraintAttributes("number", ALL), {
    min: "1", max: "9", step: "1",
  }, "lengths and patterns mean nothing to a number input");
  assert.deepEqual(
    nativeConstraintAttributes("textarea", ALL).pattern,
    null,
    "the platform ignores pattern on a textarea, and a rule that looks enforced and is not is worse",
  );
  assert.deepEqual(nativeConstraintAttributes("checkbox", ALL), {}, "nothing a checkbox can carry");
});

test("a slider spans something even when no rule says so", () => {
  const bare = nativeConstraintAttributes("slider", NONE);
  assert.deepEqual({ min: bare.min, max: bare.max }, { min: "0", max: "100" });

  const ruled = nativeConstraintAttributes("slider", { ...NONE, min: 10, max: 50 });
  assert.deepEqual({ min: ruled.min, max: ruled.max }, { min: "10", max: "50" });

  assert.equal(nativeConstraintAttributes("number", NONE).min, null, "a number input assumes nothing");
});

test("an absent constraint is null, which is how a part says remove it", () => {
  assert.equal(nativeConstraintAttributes("text", NONE).maxlength, null);
});

test("narrowing takes the tighter end, and can never widen", () => {
  const rules = { ...NONE, min: 0, max: 255, maxLength: 10 };

  const narrowed = narrowConstraints(rules, { min: 20, max: 300, maxLength: 4 });
  assert.equal(narrowed.min, 20, "a control may ask for a higher floor");
  assert.equal(narrowed.max, 255, "and may not raise a ceiling the rules set");
  assert.equal(narrowed.maxLength, 4);

  assert.deepEqual(narrowConstraints(rules, undefined), rules, "nothing asked, nothing changed");
  assert.deepEqual(
    narrowConstraints(NONE, { min: 5 }),
    { ...NONE, min: 5 },
    "a control alone may state a limit the rules do not",
  );
});

test("a control cannot loosen what the rules enforce", () => {
  // The anchoring itself is `@modyra/core`'s: `MdyFieldConstraints.pattern` is already the rule said
  // the way the platform reads one, so every renderer writes the same attribute.: a pattern is the one constraint two of them
  // cannot be intersected into one, so the field's rule wins and a control's own only fills a silence.
  // A control's pattern is taken unless it can be *shown* to loosen — a probe the rules refuse and it
  // accepts. `^.*$` produces one on the first string; a stricter spelling of the same rule does not.
  assert.equal(
    narrowConstraints({ ...NONE, pattern: "^[a-z]{4,}$" }, { pattern: "^.*$" }).pattern,
    "^[a-z]{4,}$",
  );
  assert.equal(
    narrowConstraints({ ...NONE, pattern: "^[a-z]{4,}$" }, { pattern: "^[a-z]{8,}$" }).pattern,
    "^[a-z]{8,}$",
  );
  assert.equal(narrowConstraints(NONE, { pattern: "^.*$" }).pattern, "^.*$");
});
