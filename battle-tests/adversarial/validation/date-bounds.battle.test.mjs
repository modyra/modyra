/**
 * What a date field asks about a day, and what it does when there is no day yet.
 *
 * `dateWithinBounds` is the published answer to "may the user pick this one" — the calendar greys a
 * cell with it, and the draft machine refuses a selection it rejects. Getting it wrong in the
 * permissive direction lets a value past the min/max a form declared; getting it wrong in the strict
 * direction greys out a day the user is entitled to.
 *
 * The implementation is stricter than a string comparison, which is the thing worth pinning: it
 * refuses the days that do not exist. `2026-02-30` and `2026-04-31` both sort inside any sane range
 * and neither is a date, so a lexical check would admit both. It also refuses `2026-1-1` — one
 * format, not several — and normalises a value carrying a time to the day it names, so a host that
 * hands it a datetime does not end up with a draft no date field can hold.
 *
 * Where it stops answering is the empty case. `MDY_VALUE_CONTRACTS` declares a datepicker's value
 * nullable, so `null` is not a hostile input — it is what the field holds before the user has picked
 * anything, and it is what a host reads off the field to ask this question. The predicate raises a
 * `TypeError` on it rather than answering `false`, which is the one shape a caller has no reason to
 * guard against: everywhere else in the engine, emptiness is a thing a check is asked about and
 * answers, not a thing that ends the frame.
 */

import { dateDraftTransition, dateWithinBounds } from "@modyra/widgets";
import { MDY_VALUE_CONTRACTS } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const MIN = "2026-01-01";
const MAX = "2026-12-31";

/** Ask the predicate, reporting a raise rather than letting it end the battle. */
function within(value, min = MIN, max = MAX) {
  try {
    return { answered: true, value: dateWithinBounds(value, min, max) };
  } catch (error) {
    return { answered: false, error: `${error.constructor.name}: ${error.message}` };
  }
}

battle(
  {
    claims: ["LOC-001"],
    title: "a day that does not exist is not inside any range",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the ordinary days at and inside the boundary are allowed, so the refusals below
    // are about the dates rather than about a predicate that refuses everything.
    for (const iso of ["2026-06-15", MIN, MAX, "2026-02-28", "2026-12-30"]) {
      expectEqual(within(iso), { answered: true, value: true }, {
        claimIds: ["LOC-001"],
        what: `${iso} is inside the declared range and was refused`,
      });
    }

    // Outside, on both sides, by one day.
    for (const iso of ["2025-12-31", "2027-01-01"]) {
      expectEqual(within(iso), { answered: true, value: false }, {
        claimIds: ["LOC-001"],
        what: `${iso} is outside the declared range and was allowed`,
      });
    }

    // Days that sort inside the range and are not days. A lexical comparison admits every one of
    // these, which is why they are the cases that tell the two implementations apart.
    for (const impossible of ["2026-02-30", "2026-04-31", "2026-00-10", "2026-13-01", "2026-06-31"]) {
      const answer = within(impossible);
      ctx.log.note("a date that sorts inside the range and is not a date", { impossible, answer });

      expectEqual(answer, { answered: true, value: false }, {
        claimIds: ["LOC-001"],
        what: `${impossible} was accepted as a day inside the range`,
        detail: JSON.stringify(answer),
      });
    }

    // One format. `2026-1-1` names a real day and is not how the contract spells it, and admitting
    // both is how two renderers come to disagree about what a value means.
    expectEqual(within("2026-1-1"), { answered: true, value: false }, {
      claimIds: ["LOC-001"],
      what: "a date written in a second format was accepted",
    });

    // A value carrying a time names the day it names. The draft keeps the day rather than the
    // string, so a host handing over a datetime cannot leave a date field holding one.
    for (const [given, kept] of [["2026-12-31T10:00", "2026-12-31"], ["2026-01-01T00:00", "2026-01-01"]]) {
      const transition = dateDraftTransition(
        { committed: null, draft: null, open: true },
        { type: "select", iso: given },
        MIN,
        MAX,
      );
      ctx.log.note("a datetime selected into a date field", { given, draft: transition.state.draft });

      expectEqual(transition.state.draft, kept, {
        claimIds: ["LOC-001"],
        what: `selecting ${given} left the draft holding something other than the day it names`,
      });
    }
  },
);

battle(
  {
    claims: ["LOC-001"],
    title: "an empty date field can be asked whether its value is in range",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the reason `null` here is not hostile input: the value contracts declare a
    // date field's value nullable, so this is the value the field holds before the user picks.
    ctx.log.note("what the contract says a date field may hold", {
      nullable: MDY_VALUE_CONTRACTS.datepicker?.nullable,
    });

    expectClaim(MDY_VALUE_CONTRACTS.datepicker?.nullable === true, {
      claimIds: ["LOC-001"],
      what: "a date field's value is not declared nullable, so the case below is not one a field is in",
    });

    // A host reading the field's value and asking this question is the ordinary way to grey a
    // calendar. It must get an answer.
    for (const empty of [null, undefined]) {
      const answer = within(empty);
      ctx.log.note("the predicate asked about an empty field", { empty: String(empty), answer });

      expectClaim(answer.answered === true, {
        claimIds: ["LOC-001"],
        what: `asking whether ${String(empty)} is in range raised instead of answering`,
        detail: JSON.stringify(answer),
      });
    }

    // And the same holds with no bounds declared, which is the more common configuration — a form
    // that names no min or max still has empty fields.
    expectClaim(within(null, null, null).answered === true, {
      claimIds: ["LOC-001"],
      what: "asking about an empty field with no bounds declared raised instead of answering",
      detail: JSON.stringify(within(null, null, null)),
    });
  },
);
