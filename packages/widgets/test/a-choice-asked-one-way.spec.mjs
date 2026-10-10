/**
 * Whether a held value is an option's is one question, and every adapter asks it of `sameChoice`.
 *
 * A single-choice group marks the option the field holds. A draft, a refetch or an import hands the
 * field a fresh object that is an option's value without being the same reference, so identity alone
 * marks nothing; `String()` alone renders every plain object as `[object Object]` and marks them all.
 * An array held against a primitive option is not that option, even where `String(["b"])` is `"b"`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { sameChoice } from "../dist/index.js";

test("a fresh object with the same content is the option it copies", () => {
  assert.equal(sameChoice({ id: 1, name: "Red" }, { name: "Red", id: 1 }), true);
});

test("two different objects are two different options", () => {
  assert.equal(sameChoice({ id: 1 }, { id: 2 }), false);
});

test("an empty value is no option", () => {
  assert.equal(sameChoice(null, "a"), false);
  assert.equal(sameChoice(undefined, "a"), false);
  assert.equal(sameChoice("a", null), false);
});

test("an array is not the primitive its string spells", () => {
  assert.equal(sameChoice(["b"], "b"), false);
  assert.equal(sameChoice("b", ["b"]), false);
});

test("a primitive is matched by the key it renders as", () => {
  assert.equal(sameChoice("b", "b"), true);
  assert.equal(sameChoice(1, "1"), true);
  assert.equal(sameChoice(Number.NaN, Number.NaN), true);
});
