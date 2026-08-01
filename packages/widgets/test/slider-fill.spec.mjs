/**
 * How far along a slider's track the value sits is one calculation, shared by every renderer.
 *
 * Written inline it produced a different answer in each renderer for a zero-width range — 0, or
 * whatever `value - min` happened to be over a nudged denominator, or nothing at all because the
 * fill was never computed. One function, one answer.
 *
 * It answers a **ratio**, not a percentage. The stylesheet places the stop at
 * `thumb/2 + ratio * (100% - thumb)` so the fill ends under the handle's centre, and `calc()` can
 * multiply a length by a number but cannot divide by a percentage to recover one.
 */

import assert from "node:assert";
import test from "node:test";

import { sliderFillRatio } from "../dist/field/index.js";

test("the ends and the middle of a range", () => {
  assert.equal(sliderFillRatio(0, 0, 100), 0);
  assert.equal(sliderFillRatio(100, 0, 100), 1);
  assert.equal(sliderFillRatio(50, 0, 100), 0.5);
  assert.equal(sliderFillRatio(30, 0, 100), 0.3);
});

test("a range that does not start at zero", () => {
  assert.equal(sliderFillRatio(10, 10, 20), 0);
  assert.equal(sliderFillRatio(15, 10, 20), 0.5);
  assert.equal(sliderFillRatio(20, 10, 20), 1);
  assert.equal(sliderFillRatio(-5, -10, 10), 0.25);
});

test("a value outside the range clamps to the track", () => {
  assert.equal(sliderFillRatio(-40, 0, 100), 0);
  assert.equal(sliderFillRatio(140, 0, 100), 1);
});

test("a range with no width has no fill", () => {
  // 0 degrades to an empty track, where dividing by a nudged denominator
  // paints an arbitrary ratio that depends on how far the value happens to sit from min.
  assert.equal(sliderFillRatio(5, 5, 5), 0);
  assert.equal(sliderFillRatio(5, 10, 5), 0);
  assert.equal(sliderFillRatio(0, 0, 0), 0);
});

test("an absent or unusable value fills to the minimum, never to NaN", () => {
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    const ratio = sliderFillRatio(value, 0, 100);
    assert.equal(ratio, 0, `${String(value)} gave ${ratio}`);
    assert.ok(Number.isFinite(ratio));
  }
});

test("a non-integer step lands between the stops", () => {
  assert.equal(sliderFillRatio(0.5, 0, 1), 0.5);
  assert.equal(sliderFillRatio(2.5, 0, 10), 0.25);
  assert.ok(Math.abs(sliderFillRatio(0.3, 0, 0.9) - 1 / 3) < 0.0001);
});

test("a non-finite bound has no fill rather than an unpaintable one", () => {
  assert.equal(sliderFillRatio(50, Number.NaN, 100), 0);
  assert.equal(sliderFillRatio(50, 0, Number.POSITIVE_INFINITY), 0);
});

test("the answer is a ratio, so a renderer never has to append a unit", () => {
  // The property is unitless by contract: `String(ratio)` is what goes into the style attribute.
  // A percentage here would be unrecoverable — `calc()` cannot divide by one.
  for (const value of [0, 25, 50, 75, 100]) {
    const ratio = sliderFillRatio(value, 0, 100);
    assert.ok(ratio >= 0 && ratio <= 1, `${value} gave ${ratio}`);
    assert.equal(String(ratio), String(value / 100));
  }
});
