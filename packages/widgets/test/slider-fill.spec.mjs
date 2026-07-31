/**
 * The filled portion of a slider track is one calculation, shared by every renderer.
 *
 * It existed inline in Angular and in Lit, and the two disagreed about a zero-width range: Angular
 * answered 0, Lit divided by a nudged denominator and answered whatever `value - min` happened to
 * be. Plain never computed it at all, which is why its track was uniformly grey. One function,
 * one answer.
 */

import assert from "node:assert";
import test from "node:test";

import { sliderFillPercent } from "../dist/field/index.js";

test("the ends and the middle of a range", () => {
  assert.equal(sliderFillPercent(0, 0, 100), 0);
  assert.equal(sliderFillPercent(100, 0, 100), 100);
  assert.equal(sliderFillPercent(50, 0, 100), 50);
  assert.equal(sliderFillPercent(30, 0, 100), 30);
});

test("a range that does not start at zero", () => {
  assert.equal(sliderFillPercent(10, 10, 20), 0);
  assert.equal(sliderFillPercent(15, 10, 20), 50);
  assert.equal(sliderFillPercent(20, 10, 20), 100);
  assert.equal(sliderFillPercent(-5, -10, 10), 25);
});

test("a value outside the range clamps to the track", () => {
  assert.equal(sliderFillPercent(-40, 0, 100), 0);
  assert.equal(sliderFillPercent(140, 0, 100), 100);
});

test("a range with no width has no fill", () => {
  // Angular's answer, kept: 0 degrades to an empty track, where dividing by a nudged denominator
  // paints an arbitrary percentage that depends on how far the value happens to sit from min.
  assert.equal(sliderFillPercent(5, 5, 5), 0);
  assert.equal(sliderFillPercent(5, 10, 5), 0);
  assert.equal(sliderFillPercent(0, 0, 0), 0);
});

test("an absent or unusable value fills to the minimum, never to NaN", () => {
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    const pct = sliderFillPercent(value, 0, 100);
    assert.equal(pct, 0, `${String(value)} gave ${pct}`);
    assert.ok(Number.isFinite(pct));
  }
});

test("a non-integer step lands between the stops", () => {
  assert.equal(sliderFillPercent(0.5, 0, 1), 50);
  assert.equal(sliderFillPercent(2.5, 0, 10), 25);
  assert.ok(Math.abs(sliderFillPercent(0.3, 0, 0.9) - 33.333) < 0.01);
});

test("a non-finite bound has no fill rather than an unpaintable one", () => {
  assert.equal(sliderFillPercent(50, Number.NaN, 100), 0);
  assert.equal(sliderFillPercent(50, 0, Number.POSITIVE_INFINITY), 0);
});
