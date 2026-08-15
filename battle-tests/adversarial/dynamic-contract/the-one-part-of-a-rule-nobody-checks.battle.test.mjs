/**
 * The half of a condition the parser now looks at.
 *
 * A rule is `{effect, target, when: {field, operator, value}}`, and the parser is careful about four
 * of those five: an effect nobody declared, an operator nobody declared, a target that is not a
 * field, a condition on a field that is not there — each refused by name, and in strict mode the
 * whole document with it.
 *
 * `value` was the fifth, and for a while nothing checked it: `in` took whatever was written,
 * `greaterThan` took an object, a date took a shape that is not a date, and each was accepted in the
 * strictest mode there is with no diagnostic. That was finding 160.
 *
 * This is its regression. The value is checked against the operator that will read it, and the two
 * consequences it had are the two things asserted here.
 *
 * `greaterThan` on dates was string ordering, and zero-padded ISO sorts correctly by accident — which
 * is why it looked fine until a document wrote a date the way a person writes one. `"2026-02-01" >
 * "2026-1-10"` was false, so a rule about a date in February did not fire for a date in January: a
 * wrong answer rather than a missing one, deciding whether a field is on the screen.
 *
 * `in` and `notIn` both answered false when the value was not a list, so an author writing the
 * negative form to be safe got the same answer as the positive one.
 */

import { evaluateRuleCondition, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const ask = (operator, value, held) =>
  evaluateRuleCondition({ field: "x", operator, value }, { x: held });

/** Dates a document may carry, and how a calendar orders them. */
const ORDERED = Object.freeze([
  ["2026-01-02", "2026-01-10", false],
  ["2026-1-2", "2026-01-10", false],
  ["2026-02-01", "2026-1-10", true],
  ["2026-12-01", "2026-2-01", true],
]);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a rule's value is checked against the operator that will read it",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: every one of these reaches a form. The parser is strict about the rest of the
    // rule, so acceptance here is a decision about `value` rather than an absence of checking.
    const document = (value, operator) => ({
      version: 2,
      id: "f",
      fields: [
        { name: "when", kind: "datepicker", label: "W" },
        { name: "extra", kind: "text", label: "E" },
      ],
      rules: [{ effect: "hidden", target: "extra", when: { field: "when", operator, value } }],
    });

    // A value the operator could not use is refused where the rest of the rule is refused.
    for (const [operator, value] of [["greaterThan", {}], ["in", "not a list"], ["notIn", 42], ["greaterThan", "2026-1-10"]]) {
      const parsed = parseDynamicForm(document(value, operator), { mode: "strict" });
      ctx.log.note("a value the operator could not use", { operator, value, ok: parsed.ok });

      expectClaim(parsed.ok === false && parsed.diagnostics.some((each) => each.code === "MDY_DYNAMIC_INVALID_RULE"), {
        claimIds: ["DYN-001"],
        what: `${operator} with ${JSON.stringify(value)} was accepted, and the operator cannot answer for it`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }

    // The control: a value each operator can use is accepted, so the refusals above are about the
    // value rather than about a parser that stopped taking rules.
    for (const [operator, value] of [["greaterThan", "2026-01-10"], ["in", ["a", "b"]], ["notIn", ["a"]], ["equals", "x"]]) {
      const parsed = parseDynamicForm(document(value, operator), { mode: "strict" });
      expectClaim(parsed.ok === true && parsed.rules.length === 1, {
        claimIds: ["DYN-001"],
        what: `${operator} with ${JSON.stringify(value)} was refused, and it is a value that operator can use`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }

  },
);

battle(
  {
    claims: ["DYN-003"],
    title: "the published condition answers about dates the way a calendar orders them",
    environments: ["node"],
  },
  async (ctx) => {
    // The parser refuses a date a rule cannot compare, so a document cannot carry one.
    // `evaluateRuleCondition` is published on its own as well, and a consumer calling it holds
    // whatever their own model holds — with no parser in between, which is why it answers about
    // dates as dates rather than as the text they are written in.
    const wrong = [];
    for (const [left, right, later] of ORDERED) {
      const answered = ask("greaterThan", right, left);
      ctx.log.note("one date against another", { left, right, answered, later });
      if (answered !== later) wrong.push({ left, right, answered, later });
    }

    // The control: the shape the parser does accept is ordered correctly, so what fails below is the
    // shape rather than the comparison.
    expectClaim(ask("greaterThan", "2026-01-02", "2026-01-10") === true, {
      claimIds: ["DYN-003"],
      what: "two padded ISO dates were not ordered correctly, so this battle is not about the padding",
    });

    expectEqual(wrong, [], {
      claimIds: ["DYN-003"],
      what: `${wrong.length} of ${ORDERED.length} date comparisons answered the opposite of the order the dates are in`,
      detail: JSON.stringify(wrong),
    });

    // And the pair that has to be a pair, which the repair made complementary.
    const disagreements = [];
    for (const [label, value, held] of [
      ["a member", ["a", "b"], "a"],
      ["not a member", ["a", "b"], "z"],
      ["a value that is not a list", "a", "a"],
      ["a value that is null", null, "a"],
      ["an empty list", [], "a"],
    ]) {
      const inside = ask("in", value, held);
      const outside = ask("notIn", value, held);
      ctx.log.note("both halves of one question", { label, inside, outside });
      if (inside === outside) disagreements.push({ label, inside, outside });
    }

    expectEqual(disagreements, [], {
      claimIds: ["DYN-003"],
      what: "`in` and `notIn` gave the same answer to the same question",
      detail: JSON.stringify(disagreements),
    });
  },
);
