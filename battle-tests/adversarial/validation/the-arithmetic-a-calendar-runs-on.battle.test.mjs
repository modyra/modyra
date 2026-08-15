/**
 * The date arithmetic under every picker, and the traps it does not fall into.
 *
 * `@modyra/core/datetime` publishes thirty-five functions and two battles in this suite import from
 * it. The arithmetic is the part worth holding directly, because it is where a calendar is usually
 * wrong and the wrongness is quiet: a month added to the 31st, a year added to a leap day, a day
 * taken off the 1st of March.
 *
 * The classic failure is the one the platform hands you. `new Date(2026, 1, 31)` is the 3rd of March,
 * because JavaScript rolls an impossible day forward instead of refusing it — so a naive
 * `addMonths` turns "the 31st of January, a month later" into March. Every implementation that has
 * not been told about this gets it wrong, and no test of a *single* month catches it.
 *
 * The other is the Gregorian rule. A year divisible by four is a leap year unless it is divisible by
 * a hundred, unless it is divisible by four hundred — so 2000 has a 29th of February and 1900 does
 * not, and an implementation that stops at the first clause is right until it meets one of them.
 *
 * Green. These are the cases that break when somebody simplifies date maths back to the platform's.
 */

import {
  addDays,
  addMonths,
  addYears,
  angleToHour,
  angleToMinute,
  daysInMonth,
  hourToAngle,
  minuteToAngle,
} from "@modyra/core/datetime";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const on = (year, month, day) => ({ year, month, day });

battle(
  {
    claims: ["LOC-001", "UI-002"],
    title: "a month added to the last day of one lands on a day the next one has",
    environments: ["node"],
  },
  async (ctx) => {
    const cases = [
      ["a month onto the 31st of January", addMonths, on(2026, 1, 31), 1, on(2026, 2, 28)],
      ["the same in a leap year", addMonths, on(2024, 1, 31), 1, on(2024, 2, 29)],
      ["a month off the 31st of March", addMonths, on(2026, 3, 31), -1, on(2026, 2, 28)],
      ["a month onto the 31st of May", addMonths, on(2026, 5, 31), 1, on(2026, 6, 30)],
      ["a month onto the 31st of December", addMonths, on(2026, 12, 31), 1, on(2027, 1, 31)],
      ["thirteen months onto the 31st of January", addMonths, on(2026, 1, 31), 13, on(2027, 2, 28)],
      ["a year onto the leap day", addYears, on(2024, 2, 29), 1, on(2025, 2, 28)],
      ["a year off the leap day", addYears, on(2024, 2, 29), -1, on(2023, 2, 28)],
      ["four years onto the leap day", addYears, on(2024, 2, 29), 4, on(2028, 2, 29)],
      ["a day onto the last of the year", addDays, on(2026, 12, 31), 1, on(2027, 1, 1)],
      ["a day off the 1st of March, leap", addDays, on(2024, 3, 1), -1, on(2024, 2, 29)],
      ["a day off the 1st of March, ordinary", addDays, on(2026, 3, 1), -1, on(2026, 2, 28)],
      ["a day off the 1st of January", addDays, on(2026, 1, 1), -1, on(2025, 12, 31)],
    ];

    for (const [what, add, from, by, expected] of cases) {
      const landed = add(from, by);
      ctx.log.note("date arithmetic", { what, landed });
      expectEqual(landed, expected, {
        claimIds: ["LOC-001"],
        what: `${what} did not land on a day that exists`,
      });
    }

    // The Gregorian rule in full. The first two rows are what every implementation gets right; the
    // second two are what tells a complete one from a first-clause one.
    for (const [year, month, days] of [
      [2026, 2, 28],
      [2024, 2, 29],
      [2000, 2, 29],
      [1900, 2, 28],
      [2026, 1, 31],
      [2026, 4, 30],
      [2026, 12, 31],
    ]) {
      expectEqual(daysInMonth(year, month), days, {
        claimIds: ["LOC-001", "UI-002"],
        what: `${year}-${month} was given ${daysInMonth(year, month)} days`,
      });
    }
  },
);

battle(
  {
    claims: ["UI-002", "LOC-001"],
    title: "the top of a clock dial is twelve, and a drag past it comes back round",
    environments: ["node"],
  },
  async (ctx) => {
    // A dial is a circular mapping and the wrap is the trap. The top of a twelve-hour dial is
    // **twelve**, not zero — an implementation that divides an angle by thirty gets zero there and is
    // right everywhere else, which is why a round trip through the middle of the dial proves nothing.
    for (const [hour, angle] of [[12, 0], [1, 30], [3, 90], [6, 180], [9, 270], [11, 330]]) {
      expectEqual(hourToAngle(hour), angle, {
        claimIds: ["UI-002"],
        what: `hour ${hour} is not at ${angle} degrees on the dial`,
      });
      expectEqual(angleToHour(angle), hour, {
        claimIds: ["UI-002"],
        what: `${angle} degrees on the dial is not hour ${hour}`,
      });
    }

    for (const [minute, angle] of [[0, 0], [15, 90], [30, 180], [45, 270], [59, 354]]) {
      expectEqual(minuteToAngle(minute), angle, {
        claimIds: ["UI-002"],
        what: `minute ${minute} is not at ${angle} degrees on the dial`,
      });
      expectEqual(angleToMinute(angle), minute, {
        claimIds: ["UI-002"],
        what: `${angle} degrees on the dial is not minute ${minute}`,
      });
    }

    // What a finger produces. A drag does not stop at the top: it goes past it, and it goes round
    // more than once, and it goes backwards. None of those is an error to report — they are the
    // interaction — so each has to land on the value the dial shows there.
    const wrapped = [
      ["the very top", angleToHour, 0, 12],
      ["a whole turn", angleToHour, 360, 12],
      ["just short of the top", angleToHour, 359, 12],
      ["just past the top", angleToHour, 1, 12],
      ["dragged backwards", angleToHour, -30, 11],
      ["two whole turns", angleToHour, 720, 12],
      ["the top, minutes", angleToMinute, 0, 0],
      ["a whole turn, minutes", angleToMinute, 360, 0],
      ["backwards, minutes", angleToMinute, -6, 59],
      ["two turns, minutes", angleToMinute, 720, 0],
    ];

    for (const [what, read, angle, expected] of wrapped) {
      ctx.log.note("a drag on the dial", { what, angle, landed: read(angle) });
      expectEqual(read(angle), expected, {
        claimIds: ["UI-002"],
        what: `${what} (${angle} degrees) did not land on ${expected}`,
      });
    }
  },
);
