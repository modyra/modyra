/**
 * The line a slider draws itself on, when the value does not fit on it.
 *
 * A slider needs two numbers a field does not have to give it. `sliderTrack(constraints, value)`
 * decides them, and the rule it follows is worth stating: a bound the field declared is the field's,
 * even when the value sits outside it; a bound nobody declared stretches to hold the value.
 *
 * The difference matters because the alternative is a thumb with nowhere to be. A field holding 150
 * with no maximum draws a track to 150 rather than a thumb jammed against 100 — and a field whose
 * rule says the maximum is 20, holding 25, keeps the track its rule described, because the rule is a
 * statement about the field and the value is a temporary fact about this moment.
 *
 * `sliderFillRatio` is what turns that into a proportion, and it is asked for one on ranges that are
 * not ranges — a minimum equal to its maximum, a maximum below its minimum, an infinity. There is no
 * proportion to give, and the answer is the start of the track rather than a division by zero.
 *
 * None of the three had been named by anything in this suite.
 */

import { dragPointOf, sliderFillRatio, sliderTrack } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const trackOf = (constraints, value) => {
  const { min, max } = sliderTrack(constraints, value);
  return { min, max };
};

battle(
  {
    claims: ["UI-006", "VAL-004"],
    title: "a declared bound holds and an undeclared one stretches",
    environments: ["node"],
  },
  async (ctx) => {
    // Nothing declared: the usual track, until the value needs more of it.
    expectEqual(trackOf({ min: null, max: null }, 50), { min: 0, max: 100 }, {
      claimIds: ["UI-006"],
      what: "a slider with no bounds and an ordinary value did not draw the usual track",
    });

    for (const [value, expected] of [[150, { min: 0, max: 150 }], [-20, { min: -20, max: 100 }]]) {
      ctx.log.note("a value with no bound to hold it", { value, track: trackOf({ min: null, max: null }, value) });

      expectEqual(trackOf({ min: null, max: null }, value), expected, {
        claimIds: ["UI-006"],
        what: `a slider holding ${value} with no bound declared did not stretch to hold it`,
      });
    }

    // Declared bounds are the field's, and a value outside them does not move them.
    for (const value of [5, 15, 25]) {
      expectEqual(trackOf({ min: 10, max: 20 }, value), { min: 10, max: 20 }, {
        claimIds: ["VAL-004"],
        what: `a value of ${value} moved a bound the field's rules declared`,
      });
    }

    // One of each: the declared side holds, the undeclared side gives.
    expectEqual(trackOf({ min: null, max: 20 }, -5), { min: -5, max: 20 }, {
      claimIds: ["UI-006"],
      what: "an undeclared minimum did not stretch under a value below it",
    });

    expectEqual(trackOf({ min: 10, max: null }, 200), { min: 10, max: 200 }, {
      claimIds: ["UI-006"],
      what: "an undeclared maximum did not stretch over a value above it",
    });
  },
);

battle(
  {
    claims: ["UI-006"],
    title: "a proportion of a range that is not one",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [value, min, max, expected] of [
      [50, 0, 100, 0.5], [0, 0, 100, 0], [100, 0, 100, 1],
      [150, 0, 100, 1], [-50, 0, 100, 0],
    ]) {
      expectEqual(sliderFillRatio(value, min, max), expected, {
        claimIds: ["UI-006"],
        what: `${value} of ${min}..${max} was not ${expected} of the track`,
      });
    }

    // Ranges with no proportion in them, and values that are not values. None is a reason to divide
    // by zero or to answer with something outside the track.
    const degenerate = [
      [5, 5, 5], [5, 10, 0], [Number.NaN, 0, 100], [null, 0, 100], [50, 0, Number.POSITIVE_INFINITY],
    ];
    ctx.log.note("ranges that are not ranges", {
      answers: degenerate.map(([value, min, max]) => sliderFillRatio(value, min, max)),
    });

    for (const [value, min, max] of degenerate) {
      expectEqual(sliderFillRatio(value, min, max), 0, {
        claimIds: ["UI-006"],
        what: `a fill ratio for ${JSON.stringify(value)} of ${min}..${max} was not the start of the track`,
      });
    }
  },
);

battle(
  {
    claims: ["UI-006", "A11Y-004"],
    title: "the point a drag happened at, whatever pointed",
    environments: ["node"],
  },
  async (ctx) => {
    // A mouse and a finger arrive as different shapes, and a slider has to read both.
    expectEqual(dragPointOf({ clientX: 3, clientY: 4 }), { clientX: 3, clientY: 4 }, {
      claimIds: ["UI-006"],
      what: "a pointer event was not read for where it happened",
    });

    expectEqual(dragPointOf({ touches: [{ clientX: 7, clientY: 8 }] }), { clientX: 7, clientY: 8 }, {
      claimIds: ["A11Y-004"],
      what: "a touch was not read for where it happened",
    });

    // A touch event carrying no touches is the end of a gesture, not a drag to the origin.
    ctx.log.note("a touch event with nothing in it", { answer: dragPointOf({ touches: [] }) });

    expectEqual(dragPointOf({ touches: [] }), null, {
      claimIds: ["UI-006"],
      what: "a touch event with no touches was read as a drag somewhere",
    });
  },
);
