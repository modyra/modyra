/**
 * The number in a box, and the three answers that are not one.
 *
 * Three renderers answered this three ways: one parsed the text, one read `valueAsNumber`, and one
 * did not convert at all and put the box's string in the model — where the kind's own value contract
 * says it holds a number, so every rule about bounds was judging text. Text compares by spelling,
 * and by spelling `"10"` is below `"9"`.
 *
 * The two edges are the ones that cost something in the wire, and they are why this is not
 * `Number(text)`:
 *
 * - `Number("")` is `0`, and a numeric field is nullable. Clearing the box must not supply a
 *   quantity nobody typed — an order line of zero, a price that is free, a discount that is all of
 *   it.
 * - text that is not a number is nothing, not `NaN`: a model holding `NaN` serialises to `null`
 *   through JSON anyway, and compares false to itself on the way there.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { numberEntered } from "../dist/index.js";

test("a number is itself", () => {
  assert.equal(numberEntered("1"), 1);
  assert.equal(numberEntered("-2.5"), -2.5);
  assert.equal(numberEntered(" 7 "), 7, "surrounding space is not part of what was typed");
});

test("an empty box holds nothing, not zero", () => {
  assert.equal(numberEntered(""), null);
  assert.equal(numberEntered("   "), null);
});

test("text that is not a number holds nothing, not NaN", () => {
  assert.equal(numberEntered("abc"), null);
  assert.equal(numberEntered("1,5"), null, "a decimal comma is not a number this reads, and guessing would change the value");
});

test("and zero is a number a person can mean", () => {
  // The one value the empty case must not be confused with: `Number("")` is `0`, so a rule written
  // the obvious way turns a cleared box into a quantity of zero.
  assert.equal(numberEntered("0"), 0);
});
