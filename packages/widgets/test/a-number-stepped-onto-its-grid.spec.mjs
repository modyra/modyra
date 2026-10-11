/**
 * A stepper press, answered the way the box's own arrow keys answer it.
 *
 * Every expectation here is what `<input type="number">` gives for `stepUp()` / `stepDown()` with
 * the same `min`, `max`, `step` and value, so a field whose button and arrow key disagree fails here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { numberStepped } from "../dist/index.js";

test("a value on the grid moves one step", () => {
  assert.equal(numberStepped(4, 1, {}), 5);
  assert.equal(numberStepped(4, -1, {}), 3);
  assert.equal(numberStepped(6, 1, { min: 1, step: 5 }), 11);
});

test("a value off the grid moves to the nearest grid value in the direction pressed", () => {
  assert.equal(numberStepped(3, 1, { min: 1, step: 5 }), 6);
  assert.equal(numberStepped(3, -1, { min: 1, step: 5 }), 1);
  assert.equal(numberStepped(2.5, 1, {}), 3);
  assert.equal(numberStepped(2.5, -1, {}), 2);
  assert.equal(numberStepped(-2.5, 1, {}), -2);
});

test("a decimal step carries only the decimals it declares", () => {
  let value = 0;
  const seen = [];
  for (let i = 0; i < 5; i++) seen.push((value = numberStepped(value, 1, { step: 0.1 })));
  assert.deepEqual(seen, [0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.equal(numberStepped(0.3, -1, { step: 0.1 }), 0.2);
  assert.equal(numberStepped(1.1, 1, { min: 0.05, step: 0.1 }), 1.15, "the grid starts at min's decimals");
});

test("a press past a bound lands on the nearest grid value inside it", () => {
  assert.equal(numberStepped(10, 1, { max: 10 }), 10);
  assert.equal(numberStepped(0, -1, { min: 0 }), 0);
  assert.equal(numberStepped(-5, 1, { min: 2, max: 9, step: 3 }), 2);
  assert.equal(numberStepped(20, -1, { min: 2, max: 9, step: 3 }), 8, "the largest grid value under max, not max");
  assert.equal(numberStepped(10, -1, { max: 7, step: 3 }), 6, "an off-grid max is not a place to land");
  assert.equal(numberStepped(8, 1, { min: 2, max: 9, step: 3 }), 8, "the top grid value stays where it is");
  assert.equal(numberStepped(9, 1, { min: 2, max: 9, step: 3 }), null, "up from max, off the grid, would move down to the top grid value");
});

test("a press never moves the value against its direction", () => {
  assert.equal(numberStepped(50, 1, { max: 10 }), null);
  assert.equal(numberStepped(-50, -1, { min: 0 }), null);
});

test("a range with no grid value inside it moves nothing", () => {
  assert.equal(numberStepped(5, 1, { min: 9, max: 1 }), null);
  assert.equal(numberStepped(5, 1, { min: 1, max: 3, step: 5 }), null, "the only grid value in range is below: up does not go down");
  assert.equal(numberStepped(5, -1, { min: 1, max: 3, step: 5 }), 1);
});

test("an empty box steps from zero", () => {
  assert.equal(numberStepped(null, 1, {}), 1);
  assert.equal(numberStepped(null, -1, {}), -1);
  assert.equal(numberStepped(null, 1, { min: 5 }), 5);
});

test("an empty box whose zero is out of range enters it at the near end, either way", () => {
  assert.equal(numberStepped(null, -1, { min: 5 }), 5);
  assert.equal(numberStepped(null, -1, { min: 1, step: 5 }), 1);
  assert.equal(numberStepped(null, 1, { min: -9, max: -3, step: 2 }), -3);
});

test("an absent, zero or negative step is one", () => {
  for (const step of [undefined, null, 0, -2, Number.NaN]) assert.equal(numberStepped(2, 1, { step }), 3, String(step));
});

test("a whole-number step leaves a large integer exact", () => {
  assert.equal(numberStepped(9007199254740990, 1, {}), 9007199254740991);
});
