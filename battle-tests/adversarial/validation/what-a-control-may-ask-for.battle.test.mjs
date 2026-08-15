/**
 * A control asking for less than the field accepts, and the one place it can ask for more.
 *
 * `narrowConstraints(rules, narrowing)` is where a control's own limits meet the field's. The rule it
 * implements is stated in the option that feeds it: a control may ask for less than the field accepts
 * — a slider bounded tighter than its rule, a number input capped by a caller — and *it cannot ask
 * for more: the rules are the authority, and what is offered is their intersection with this*.
 *
 * Every numeric bound keeps that promise. A narrower minimum raises the floor, a wider one is
 * ignored; a narrower maximum lowers the ceiling, a wider one is ignored; a bigger step and tighter
 * lengths win, looser ones do not.
 *
 * `pattern` is not an intersection. The control's replaces the field's outright, wider or not — and
 * a pattern is the constraint the browser enforces before any JavaScript runs, so a control offering
 * one that matches anything hands the user a box that invites what the form will refuse.
 *
 * The same package already has an answer for two patterns meeting, and it is not "the last one wins":
 * `factsOfAll` projects no pattern at all and reports `conflictingPatterns`, because no single
 * attribute means "matches both". ADR 0030 is that decision. This is the same meeting, decided the
 * other way, in the other direction.
 */

import { factsOfAll, pattern as patternRule } from "@modyra/core";
import { narrowConstraints } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What a field's rules allow, before any control narrows them. */
const RULES = Object.freeze({
  min: 5,
  max: 50,
  step: 1,
  minLength: 4,
  maxLength: 20,
  pattern: "^[a-z]{4,}$",
  inputMode: "text",
});

const numbersOf = (constraints) => ({
  min: constraints.min,
  max: constraints.max,
  step: constraints.step,
  minLength: constraints.minLength,
  maxLength: constraints.maxLength,
});

battle(
  {
    claims: ["VAL-004", "UI-006"],
    title: "a control asking for more than the rules allow is not given it",
    environments: ["node"],
  },
  async (ctx) => {
    // Nothing offered leaves the rules exactly as they are.
    expectEqual(narrowConstraints(RULES, null), RULES, {
      claimIds: ["VAL-004"],
      what: "a control offering no limits of its own changed the field's",
    });

    // Asking for less: the tighter of the two, on every bound.
    const tighter = narrowConstraints(RULES, { min: 10, max: 20, step: 5, minLength: 8, maxLength: 12 });
    ctx.log.note("a control asking for less", numbersOf(tighter));

    expectEqual(numbersOf(tighter), { min: 10, max: 20, step: 5, minLength: 8, maxLength: 12 }, {
      claimIds: ["VAL-004"],
      what: "a control asking for less than the field accepts was not given it",
    });

    // Asking for more: refused on every bound, in both directions.
    const wider = narrowConstraints(RULES, { min: 1, max: 99, step: 0, minLength: 1, maxLength: 99 });
    ctx.log.note("a control asking for more", numbersOf(wider));

    expectEqual(numbersOf(wider), numbersOf(RULES), {
      claimIds: ["VAL-004", "UI-006"],
      what: "a control widened a bound the field's rules had set, so the page offers what the form refuses",
    });
  },
);

battle(
  {
    claims: ["VAL-004", "UI-006"],
    title: "a control cannot loosen the pattern the rules enforce",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: the same meeting, decided elsewhere in the same package. Two patterns produce no
    // projected pattern and a fact saying why, because no single attribute means "matches both".
    const both = factsOfAll([patternRule(/^[a-z]{4,}$/), patternRule(/^.*$/)]);
    ctx.log.note("two patterns meeting through the validator's own projection", {
      projected: both.constraints.pattern,
      conflicting: both.conflictingPatterns,
    });

    expectClaim(both.constraints.pattern === null && both.conflictingPatterns === true, {
      claimIds: ["VAL-004"],
      what: "two patterns no longer conflict, so there is nothing to hold this one to",
      detail: JSON.stringify(both.constraints),
    });

    // A control offering a stricter pattern is asking for less, which it may do.
    expectEqual(narrowConstraints(RULES, { pattern: "^[a-z]{8,}$" }).pattern, "^[a-z]{8,}$", {
      claimIds: ["VAL-004"],
      what: "a control asking for a stricter pattern was refused it",
    });

    // And one that matches anything is asking for more.
    const loosened = narrowConstraints(RULES, { pattern: "^.*$" });
    ctx.log.note("a control offering a pattern that matches anything", { projected: loosened.pattern });

    expectClaim(loosened.pattern !== "^.*$", {
      claimIds: ["VAL-004", "UI-006"],
      what: "a control replaced the field's pattern with one that matches anything, so the browser invites what the form refuses",
      detail: JSON.stringify({ rules: RULES.pattern, offered: "^.*$", projected: loosened.pattern }),
    });
  },
);
