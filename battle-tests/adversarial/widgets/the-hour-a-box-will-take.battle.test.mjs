/**
 * The two boxes a time is typed into, and what they refuse.
 *
 * A timepicker's dial has an hour box and a minute box, and `timeFieldBounds`, `acceptTimeField` and
 * `stepTimeField` are the three published functions behind them. None had been named by this suite.
 *
 * They are worth pinning because their edges are all off-by-one shaped and none of them is visible.
 * Twelve-hour hours run 1 to 12, not 0 to 11, so every wrap has an offset in it: stepping up from 12
 * has to reach 1 and not 0, and stepping down from 1 has to reach 12 and not 0. Twenty-four-hour
 * hours run 0 to 23 and wrap the other way. Minutes run 0 to 59 in both.
 *
 * And a box a person types into is handed strings, not numbers. `Number("")` is `0` and
 * `Number(" 5 ")` is `5`, so an empty box read as a number is a request for midnight — which is why
 * emptiness and shape are decided before the value, and why a rejection says which of the two it was.
 */

import { acceptTimeField, stepTimeField, timeFieldBounds } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["UI-006", "LOC-001"],
    title: "an hour steps round its own ends",
    environments: ["node"],
  },
  async (ctx) => {
    ctx.log.note("what each box holds", {
      hour12: timeFieldBounds("hour", "12h"),
      hour24: timeFieldBounds("hour", "24h"),
      minute: timeFieldBounds("minute", "12h"),
    });

    expectEqual(
      [timeFieldBounds("hour", "12h"), timeFieldBounds("hour", "24h"), timeFieldBounds("minute", "24h")],
      [{ min: 1, max: 12 }, { min: 0, max: 23 }, { min: 0, max: 59 }],
      {
        claimIds: ["LOC-001"],
        what: "a box no longer holds the range its format gives it",
      },
    );

    // Twelve-hour hours have no zero, so both ends wrap past one.
    for (const [current, delta, expected] of [
      [12, 1, 1], [1, -1, 12], [11, 1, 12], [12, -1, 11], [6, 6, 12], [6, -6, 12], [12, 12, 12],
    ]) {
      expectEqual(stepTimeField("hour", "12h", current, delta), expected, {
        claimIds: ["UI-006"],
        what: `stepping a 12h hour from ${current} by ${delta} left the range 1..12`,
      });
    }

    // Twenty-four-hour hours have a zero and no twenty-four.
    for (const [current, delta, expected] of [[23, 1, 0], [0, -1, 23], [0, 1, 1], [23, -1, 22]]) {
      expectEqual(stepTimeField("hour", "24h", current, delta), expected, {
        claimIds: ["UI-006"],
        what: `stepping a 24h hour from ${current} by ${delta} left the range 0..23`,
      });
    }

    for (const [current, delta, expected] of [[59, 1, 0], [0, -1, 59], [55, 5, 0]]) {
      expectEqual(stepTimeField("minute", "12h", current, delta), expected, {
        claimIds: ["UI-006"],
        what: `stepping a minute from ${current} by ${delta} left the range 0..59`,
      });
    }

    // A box holding nothing, and a step that is not a step: neither is a reason to answer with
    // something outside the range.
    expectEqual(
      [
        stepTimeField("hour", "12h", Number.NaN, 1),
        stepTimeField("hour", "12h", 5, Number.NaN),
        stepTimeField("hour", "12h", 5, 0.4),
        stepTimeField("hour", "24h", 24, 1),
        stepTimeField("hour", "24h", -1, -1),
      ],
      [1, 5, 5, 1, 22],
      {
        claimIds: ["UI-006"],
        what: "a step from nothing, by nothing, or from outside the range left the range",
      },
    );
  },
);

battle(
  {
    claims: ["UI-006", "SEC-001"],
    title: "an hour box says which kind of no it is",
    environments: ["node"],
  },
  async (ctx) => {
    const answer = (raw) => acceptTimeField("hour", "12h", raw);

    for (const raw of ["5", " 5 ", "05", "12", "1"]) {
      expectEqual(answer(raw).type, "accepted", {
        claimIds: ["UI-006"],
        what: `an hour box refused ${JSON.stringify(raw)}`,
        detail: JSON.stringify(answer(raw)),
      });
    }

    expectEqual([answer("5").value, answer(" 5 ").value, answer("05").value], [5, 5, 5], {
      claimIds: ["UI-006"],
      what: "an hour written with a space or a leading zero was read as a different hour",
    });

    // Out of range is a different answer from not a number, and the box says so: a person who typed
    // 13 is told the hours run to 12, and a person who typed nothing is not told that.
    for (const raw of ["0", "13", "99"]) {
      expectEqual(answer(raw), { type: "rejected", reason: "out-of-range", bounds: { min: 1, max: 12 } }, {
        claimIds: ["UI-006"],
        what: `${JSON.stringify(raw)} was not refused as out of range`,
      });
    }

    // Everything that is not a whole number in the reader's digits, including the empty box that
    // `Number` would call midnight.
    for (const raw of ["", "  ", "abc", "5.7", "5e0", "+5", "-5", "1_2", "12:30", "Infinity", "NaN", "٥"]) {
      const outcome = answer(raw);
      ctx.log.note("something typed into an hour box", { raw, outcome });

      expectEqual({ type: outcome.type, reason: outcome.reason }, { type: "rejected", reason: "not-a-number" }, {
        claimIds: ["SEC-001", "UI-006"],
        what: `${JSON.stringify(raw)} was read as an hour`,
      });
    }
  },
);
