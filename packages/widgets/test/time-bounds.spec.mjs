/**
 * A time field's range, and the two different things a user can mean by leaving it.
 *
 * The rule this suite exists to hold: **stepping wraps, typing is judged.** They are easy to
 * conflate and the difference is what the user meant — the arrow key is scanning a range, the
 * keyboard entry is asserting a value.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptTimeField,
  dateWithinBounds as dateWithinBoundsSync,
  stepTimeField,
  timeFieldBounds,
} from "../dist/index.js";

test("the hour's range depends on the clock, the minute's never does", () => {
  // `step: 1` is every value, which is what a field with no declared granularity offers.
  assert.deepEqual(timeFieldBounds("hour", "12h"), { min: 1, max: 12, step: 1 });
  assert.deepEqual(timeFieldBounds("hour", "24h"), { min: 0, max: 23, step: 1 });
  // The rule most often lost when bounds sit as literals beside the hour's.
  assert.deepEqual(timeFieldBounds("minute", "12h"), { min: 0, max: 59, step: 1 });
  assert.deepEqual(timeFieldBounds("minute", "24h"), { min: 0, max: 59, step: 1 });
});

test("a 12-hour clock accepts 1 to 12 and rejects 0 and 13", () => {
  assert.deepEqual(acceptTimeField("hour", "12h", "1"), { type: "accepted", value: 1 });
  assert.deepEqual(acceptTimeField("hour", "12h", "12"), { type: "accepted", value: 12 });
  assert.equal(acceptTimeField("hour", "12h", "0").type, "rejected");
  assert.equal(acceptTimeField("hour", "12h", "13").type, "rejected");
});

test("a 24-hour clock accepts 0 to 23 and rejects 24", () => {
  assert.deepEqual(acceptTimeField("hour", "24h", "0"), { type: "accepted", value: 0 });
  assert.deepEqual(acceptTimeField("hour", "24h", "23"), { type: "accepted", value: 23 });
  // 24 reads like a valid hour and is not one: it is the same instant as 0 on the next day.
  assert.equal(acceptTimeField("hour", "24h", "24").type, "rejected");
});

test("a minute stops at 59 on either clock", () => {
  assert.deepEqual(acceptTimeField("minute", "24h", "59"), { type: "accepted", value: 59 });
  assert.equal(acceptTimeField("minute", "24h", "60").type, "rejected");
  assert.equal(acceptTimeField("minute", "12h", "60").type, "rejected");
});

test("a rejection says why, and carries the range it was judged against", () => {
  const tooBig = acceptTimeField("hour", "12h", "13");
  assert.equal(tooBig.reason, "out-of-range");
  assert.deepEqual(tooBig.bounds, { min: 1, max: 12, step: 1 });

  // Distinguished so a renderer can say "not a number" rather than "out of range" for `ab`.
  assert.equal(acceptTimeField("minute", "24h", "ab").reason, "not-a-number");
  assert.equal(acceptTimeField("minute", "24h", "").reason, "not-a-number");
});

test("an empty box is not a request for midnight", () => {
  // `Number("")` is 0, which is a perfectly valid hour on a 24-hour clock. Checking the shape
  // before the value is what keeps a cleared field from silently becoming 00:00.
  assert.equal(acceptTimeField("hour", "24h", "").type, "rejected");
  assert.equal(acceptTimeField("hour", "24h", "   ").type, "rejected");
});

test("stepping wraps at both ends of a 12-hour clock", () => {
  assert.equal(stepTimeField("hour", "12h", 12, 1), 1, "past the top comes back to the bottom");
  assert.equal(stepTimeField("hour", "12h", 1, -1), 12, "and past the bottom to the top");
  assert.equal(stepTimeField("hour", "12h", 6, 1), 7);
});

test("stepping wraps at both ends of a 24-hour clock", () => {
  assert.equal(stepTimeField("hour", "24h", 23, 1), 0);
  assert.equal(stepTimeField("hour", "24h", 0, -1), 23);
});

test("minutes wrap at 59, on either clock", () => {
  assert.equal(stepTimeField("minute", "12h", 59, 1), 0);
  assert.equal(stepTimeField("minute", "24h", 0, -1), 59);
});

test("a step larger than the range still lands inside it", () => {
  // Holding an arrow key, or a wheel event that arrives coalesced.
  assert.equal(stepTimeField("hour", "12h", 1, 12), 1, "a full turn returns to where it started");
  assert.equal(stepTimeField("minute", "24h", 0, 125), 5);
  assert.equal(stepTimeField("minute", "24h", 0, -125), 55);
});

test("stepping brings an out-of-range value back inside rather than refusing", () => {
  // Stepping is how a user *leaves* a bad value, so it must not be the one operation that will not
  // move while the field is wrong.
  const landed = stepTimeField("hour", "12h", 99, 1);
  assert.ok(landed >= 1 && landed <= 12, `expected a valid hour, got ${landed}`);
});

/**
 * The date side of the same question, and the reason it is in this file.
 *
 * `dateWithinBounds` is a public export of `@modyra/widgets` that **no renderer called**. The
 * calendar bounds its own cells with `isDateInRange` over parsed dates, so the two took the same
 * decision by different arithmetic — one lexicographic over strings, one structural — and only one
 * of them was exercised by anything that ships.
 */
test("the exported date bound agrees with the one the calendar actually uses", async () => {
  const { dateWithinBounds } = await import("../dist/index.js");
  const { isDateInRange, parseIsoDate } = await import("../../core/dist/date-utils.js");

  const cases = [
    ["2026-07-27", "2026-01-01", "2026-12-31"],
    ["2025-12-31", "2026-01-01", null],
    ["2027-01-01", null, "2026-12-31"],
    ["2026-01-01", "2026-01-01", "2026-01-01"],
  ];
  for (const [iso, min, max] of cases) {
    const viaCalendar = isDateInRange(parseIsoDate(iso), parseIsoDate(min), parseIsoDate(max));
    assert.equal(dateWithinBounds(iso, min, max), viaCalendar, `${iso} in ${min}..${max}`);
  }
});

test("a malformed date is out of bounds whatever the bounds are", () => {
  // The half a parsed comparison cannot make: there is nothing to compare.
  assert.equal(dateWithinBoundsSync("not-a-date", null, null), false);
  assert.equal(dateWithinBoundsSync("2026-13-01", null, null), false);
});

/**
 * Stepping is how a user leaves a bad value, so it must not be the one operation that refuses to.
 *
 * A field holding nothing readable — an empty box coerced to a number, a parse that failed — used to
 * make the arithmetic produce `NaN`, which the caller then stored: the value became unreachable by
 * the very key meant to change it.
 */
test("a field holding nothing enters the range from the end the user is leaving", () => {
  // Up from nothing is the first value, down from nothing is the last. Entering at `min + delta`
  // would put the first press on the second value and leave the first unreachable by keyboard.
  assert.equal(stepTimeField("hour", "12h", Number.NaN, 1), 1);
  assert.equal(stepTimeField("hour", "12h", Number.NaN, -1), 12);
  assert.equal(stepTimeField("hour", "24h", Number.NaN, 1), 0);
  assert.equal(stepTimeField("hour", "24h", Number.NaN, -1), 23);
  assert.equal(stepTimeField("minute", "24h", Number.NaN, 1), 0);
  assert.equal(stepTimeField("minute", "24h", Number.NaN, -1), 59);
});

test("no input can make stepping produce a value outside the range", () => {
  for (const [field, format] of [["hour", "12h"], ["hour", "24h"], ["minute", "24h"]]) {
    const { min, max } = timeFieldBounds(field, format);
    for (const current of [Number.NaN, Infinity, -Infinity, -5, 999, 0, min, max]) {
      for (const delta of [Number.NaN, Infinity, -Infinity, -3, -1, 0, 1, 3]) {
        const got = stepTimeField(field, format, current, delta);
        assert.ok(
          Number.isInteger(got) && got >= min && got <= max,
          `step(${field}, ${format}, ${current}, ${delta}) = ${got}, outside ${min}..${max}`,
        );
      }
    }
  }
});
