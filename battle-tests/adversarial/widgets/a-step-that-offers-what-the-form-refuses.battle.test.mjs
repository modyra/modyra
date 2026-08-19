/**
 * A control narrowing a step, and offering values the field will not take.
 *
 * `native-constraints.ts` states the rule twice, in the same words both times: *"A control may ask
 * for **less** than the field accepts and never for more: the rules are the authority."*
 * `narrowConstraints` is where that is enforced, and it enforces it by picking the tighter of the two
 * numbers — the higher `min`, the lower `max`, the higher `minLength`, the lower `maxLength`.
 *
 * For `step` the higher number is not the tighter one. A step is not a bound, it is a lattice, and
 * one lattice is inside another only when its step is a **multiple** of it:
 *
 *   the field says step 2       0  2  4  6  8  10  12
 *   a control asks for step 4   0     4     8      12     a subset — fewer values, all of them legal
 *   a control asks for step 3   0  3     6     9   12     3 and 9 are values the field refuses
 *   a control asks for step 1   0  2  4  6  8  10  12     correctly ignored: it asked for more
 *
 * So a number input narrowed to step 3 over a field stepping by 2 lets a person land on 3, accepts it
 * at the control, and hands the form a value its own rules reject. The failure is the one the file
 * names: the control offered more than the field accepts.
 *
 * The repair is arithmetic rather than a policy — the tighter lattice containing both is their least
 * common multiple, `lcm(2, 3) = 6`, which offers `0 6 12` and is a subset of each. This battle does
 * not require that answer; it requires the property the file already states, which any correct
 * answer satisfies.
 */

import { narrowConstraints } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The field's own rules: a bounded range stepping by two. */
const FIELD = Object.freeze({
  min: 0,
  max: 12,
  step: 2,
  minLength: null,
  maxLength: null,
  pattern: null,
  type: "number",
});

/** Every value a control carrying `rules` lets a person land on. */
function landableOn(rules) {
  const step = rules.step ?? 1;
  const values = [];
  for (let n = rules.min ?? 0; n <= (rules.max ?? 12); n += step) values.push(n);
  return values;
}

battle(
  {
    claims: ["VAL-004", "UI-007"],
    title: "a control offers no value the field would refuse",
    environments: ["node"],
  },
  async (ctx) => {
    const fieldAccepts = landableOn(FIELD);

    const asks = [
      { asked: "step 4, a multiple", narrowing: { step: 4 } },
      { asked: "step 3, not a multiple", narrowing: { step: 3 } },
      { asked: "step 5, not a multiple", narrowing: { step: 5 } },
      { asked: "step 1, wider", narrowing: { step: 1 } },
      { asked: "min 4", narrowing: { min: 4 } },
      { asked: "max 8", narrowing: { max: 8 } },
    ];

    const observed = asks.map((entry) => {
      const narrowed = narrowConstraints(FIELD, entry.narrowing);
      const offers = landableOn(narrowed);
      return {
        asked: entry.asked,
        step: narrowed.step,
        offers,
        refusedByTheField: offers.filter((value) => !fieldAccepts.includes(value)),
      };
    });
    ctx.log.note("what each narrowing lets a person land on", { fieldAccepts, observed });

    // The instrument: narrowing must actually narrow somewhere, or "nothing is offered wrongly"
    // would describe a function that ignores its second argument.
    expectClaim(
      observed.some((row) => row.offers.length < fieldAccepts.length) &&
        observed.find((row) => row.asked === "step 1, wider")?.step === FIELD.step,
      {
        claimIds: ["VAL-004"],
        what: "narrowing changes nothing at all, or a wider ask was honoured, so the probe is wrong before the contract is",
        detail: JSON.stringify(observed.map(({ asked, step }) => ({ asked, step }))),
      },
    );

    expectEqual(
      observed.filter((row) => row.refusedByTheField.length > 0).map((row) => ({
        asked: row.asked,
        offered: row.refusedByTheField,
      })),
      [],
      {
        claimIds: ["VAL-004", "UI-007"],
        what: "a control let a person land on a value the field's own rules refuse, which is the thing the constraint file says a control may never do",
      },
    );
  },
);
