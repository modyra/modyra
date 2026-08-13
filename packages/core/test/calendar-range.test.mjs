/**
 * The questions a calendar asks about its bounds, which three renderers were each answering.
 *
 * Asked of a month rather than of a date on purpose: the first of a month can fall before `min`
 * while most of that month is reachable, so testing the first day greys out a month the user is
 * allowed to pick in.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarYearRange, isMonthOutOfRange, isYearOutOfRange } from "../dist/datetime.js";

const min = { year: 2026, month: 3, day: 20 };
const max = { year: 2026, month: 9, day: 4 };

test("a month is out of range only when none of it is reachable", () => {
  assert.equal(isMonthOutOfRange(2026, 2, min, max), true, "before the lower bound's month");
  // The bound falls on the 20th, so most of March is not offered — and March still is.
  assert.equal(isMonthOutOfRange(2026, 3, min, max), false, "the month holding the lower bound");
  assert.equal(isMonthOutOfRange(2026, 9, min, max), false, "the month holding the upper bound");
  assert.equal(isMonthOutOfRange(2026, 10, min, max), true, "past the upper bound's month");
  assert.equal(isMonthOutOfRange(2025, 12, min, max), true, "an earlier year");
  assert.equal(isMonthOutOfRange(2027, 1, min, max), true, "a later year");
  assert.equal(isMonthOutOfRange(1900, 1, null, null), false, "no bounds, nothing refused");
});

test("a year is out of range only when none of it is reachable", () => {
  assert.equal(isYearOutOfRange(2025, min, max), true);
  assert.equal(isYearOutOfRange(2026, min, max), false);
  assert.equal(isYearOutOfRange(2027, min, max), true);
  assert.equal(isYearOutOfRange(2027, null, max), true);
  assert.equal(isYearOutOfRange(1900, null, null), false);
});

test("the year picker always contains the year on screen", () => {
  // A picker that cannot show where it already is gives the user no way back.
  for (const viewYear of [1850, 1920, 2026, 2120, 2300]) {
    const years = calendarYearRange(viewYear, null, null);
    assert.ok(years.includes(viewYear), `${viewYear} is missing from its own picker`);
  }
  const bounded = calendarYearRange(2026, { year: 1800, month: 1, day: 1 }, { year: 2400, month: 1, day: 1 });
  assert.ok(bounded.includes(1800) && bounded.includes(2400), "the bounds themselves are reachable");
  assert.deepEqual([...bounded].sort((a, b) => a - b), [...bounded], "the years come out in order");
});

test("a bound narrows the year picker, it does not merely disable it", () => {
  // The picker offered two centuries whatever the field accepted, and the bounds only greyed the
  // years out: a field taking eleven years drew two hundred and seven buttons, one hundred and
  // ninety-six of them dead. The earlier check passed because it only ever widened the bounds.
  const narrow = calendarYearRange(2026, { year: 2020, month: 1, day: 1 }, { year: 2030, month: 1, day: 1 });
  assert.deepEqual([...narrow], [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]);
  for (const year of narrow) {
    assert.equal(isYearOutOfRange(year, { year: 2020, month: 1, day: 1 }, { year: 2030, month: 1, day: 1 }), false,
      `${year} is offered and refused at the same time`);
  }

  // One bound narrows its own end and leaves the other wide.
  const floorOnly = calendarYearRange(2026, { year: 2020, month: 1, day: 1 }, null);
  assert.equal(Math.min(...floorOnly), 2020);
  assert.ok(Math.max(...floorOnly) >= 2120, "an absent bound stays wide");

  // A view outside the bounds still reaches back: a value can arrive from a draft or a server.
  const outside = calendarYearRange(1990, { year: 2020, month: 1, day: 1 }, { year: 2030, month: 1, day: 1 });
  assert.ok(outside.includes(1990) && outside.includes(2030), "the view and the bound are both reachable");
});
