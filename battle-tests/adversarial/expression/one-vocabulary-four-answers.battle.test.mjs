/**
 * The same comparison, written the four ways the contract offers, answering three different things.
 *
 * `expression.ts` states the invariant in its own words, beside the operators it added to the tree:
 * *"one vocabulary, so a document writing `in` means the same thing whichever of the two shapes it
 * writes it in"*, and *"the tree and the flat form cannot come to disagree about what `isEmpty`
 * means"*. A document may say a condition as a flat rule (`rules`) or as a predicate tree
 * (`validations`), and the two are meant to be one language spelled twice.
 *
 * On two values they are not. The tree's `equals` is `Object.is`; the flat rule's is `===`; and both
 * `in` are `Array.prototype.includes`, which is neither — it is SameValueZero. So:
 *
 *   held      equals (tree)   in (tree)   equals (rule)   in (rule)
 *   NaN            true         true          false          true
 *   -0 vs 0        false        true          true           true
 *
 * Neither value is exotic in a form. A number field given text it cannot read holds `NaN` — that is
 * the engine's documented behaviour, not an edge case — and `-0` is what a minus sign in front of a
 * zero parses to.
 *
 * What it costs: a `rules` entry with effect `hidden` decides whether a field is in play, and a
 * field out of play is not submitted. Two authors writing the same condition in the two slots the
 * contract offers get opposite decisions about whether a value reaches the payload.
 *
 * There is no need to invent an answer, because the contract already contains one. `in` is the
 * operator that agrees with itself across both spellings, and what it implements — SameValueZero,
 * the comparison JavaScript uses for `Map` keys and `Array.includes` — is the one that reads a form
 * correctly: `NaN` equals `NaN`, because a field either holds unreadable text or it does not, and
 * `-0` equals `0`, because they are the same answer to the question the form asked.
 */

import { evaluateExpression, evaluateRuleCondition } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The values on which the four spellings are allowed to be compared, and nothing else. */
const CASES = Object.freeze([
  { name: "NaN against NaN", held: Number.NaN, expected: Number.NaN },
  { name: "negative zero against zero", held: -0, expected: 0 },
  { name: "zero against negative zero", held: 0, expected: -0 },
  { name: "a number against itself", held: 7, expected: 7 },
  { name: "a string against itself", held: "x", expected: "x" },
  { name: "two different numbers", held: 1, expected: 2 },
]);

/** The four doors the contract opens onto one comparison. */
const spellings = (held, expected) => ({
  "equals, as a tree": evaluateExpression(
    { op: "equals", operands: [{ path: "n" }, expected] },
    { n: held },
  ),
  "in, as a tree": evaluateExpression(
    { op: "in", operands: [{ path: "n" }, [expected]] },
    { n: held },
  ),
  "equals, as a rule": evaluateRuleCondition(
    { field: "n", operator: "equals", value: expected },
    { n: held },
  ),
  "in, as a rule": evaluateRuleCondition(
    { field: "n", operator: "in", value: [expected] },
    { n: held },
  ),
});

battle(
  {
    claims: ["EXP-001"],
    title: "one comparison, four spellings, one answer",
    environments: ["node"],
  },
  async (ctx) => {
    const table = CASES.map((entry) => ({
      case: entry.name,
      ...spellings(entry.held, entry.expected),
    }));
    ctx.log.note("the same comparison through every door the contract opens", table);

    // The instrument answers for itself: on ordinary values all four must already agree, or the
    // battle is measuring a broken harness rather than a broken contract.
    const ordinary = table.filter((row) => !row.case.includes("zero") && !row.case.includes("NaN"));
    expectClaim(
      ordinary.length >= 3 &&
        ordinary.every(({ case: _name, ...answers }) => new Set(Object.values(answers)).size === 1),
      {
        claimIds: ["EXP-001"],
        what: "the four spellings disagree even on ordinary values, so the probe is wrong before the contract is",
        detail: JSON.stringify(ordinary),
      },
    );

    const disagreeing = table.flatMap((row) => {
      const { case: name, ...answers } = row;
      const distinct = new Set(Object.values(answers));
      return distinct.size === 1 ? [] : [{ case: name, ...answers }];
    });

    expectEqual(disagreeing, [], {
      claimIds: ["EXP-001"],
      what: "one comparison spelled four ways gives more than one answer, so a document's meaning depends on which slot it was written in",
    });
  },
);
