import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultOptionKey } from "../dist/index.js";

/**
 * Two different array values are two different keys.
 *
 * `String()` joins an array's entries with commas and renders each entry its own way, so arrays that
 * hold different things can join to the same text: every object becomes `[object Object]`, `null`
 * and `""` both become nothing, and a comma inside an entry looks like a boundary between two. An
 * index built from those keys holds one entry for all of them, and a pick lands on whichever was
 * written last.
 *
 * An array whose `String()` cannot be mistaken keeps it: keys are part ids and land in
 * `aria-activedescendant`, so a key that already distinguishes is not moved.
 */
const PAIRS = [
  ["objects", [{ a: 1 }], [{ b: 2 }]],
  ["a comma inside an entry", ["a,b"], ["a", "b"]],
  ["null against an empty string", [null], [""]],
  ["undefined against an empty string", [undefined], [""]],
  ["a nested array", [[1, 2]], [1, 2]],
  ["a nested array, deeper", [1, [2, 3]], [[1, 2], 3]],
  ["an entry spelling another array's key", ["[null]"], [null]],
];

for (const [what, one, other] of PAIRS) {
  test(`arrays differing by ${what} key apart`, () => {
    assert.notEqual(defaultOptionKey(one), defaultOptionKey(other));
  });
}

test("an array whose String() distinguishes keeps it", () => {
  assert.equal(defaultOptionKey(["b"]), "b");
  assert.equal(defaultOptionKey(["a", "b"]), "a,b");
  assert.equal(defaultOptionKey([1, 2]), "1,2");
  assert.equal(defaultOptionKey([true]), "true");
  assert.equal(defaultOptionKey([]), "");
});

test("an array is keyed by what it holds, not by which array it is", () => {
  assert.equal(defaultOptionKey([{ id: 1, n: "x" }]), defaultOptionKey([{ n: "x", id: 1 }]));
});

test("an array holding a symbol is keyed rather than thrown on", () => {
  assert.doesNotThrow(() => defaultOptionKey([Symbol("s")]));
});
