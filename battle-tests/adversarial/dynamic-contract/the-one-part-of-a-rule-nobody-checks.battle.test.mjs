/**
 * The half of a condition the parser never looks at.
 *
 * A rule is `{effect, target, when: {field, operator, value}}`, and the parser is careful about four
 * of those five: an effect nobody declared, an operator nobody declared, a target that is not a
 * field, a condition on a field that is not there — each refused by name, and in strict mode the
 * whole document with it.
 *
 * `value` is the one the operator actually reads, and nothing checks it. `in` takes whatever is
 * written, `greaterThan` takes an object, a date takes a shape that is not a date. Each is accepted
 * in the strictest mode there is, with no diagnostic.
 *
 * Two consequences, and they are different in kind.
 *
 * `greaterThan` on dates is string ordering. Zero-padded ISO happens to sort correctly, which is why
 * this looks fine until a document writes a date the way a person writes one — and `"2026-02-01" >
 * "2026-1-10"` is false, so a rule about a date in February does not fire for a date in January.
 * A wrong answer, not a missing one, and it decides whether a field is on the screen.
 *
 * `in` and `notIn` both answer false when the value is not a list. An author writing the negative
 * form to be safe gets the same answer as the positive one, and the rule they wrote to hide
 * something never fires.
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
    title: "a rule's value is checked by whoever wrote the document",
    environments: ["node"],
    open: "reported, not enforced: finding 160, open in battle-tests/reports/open-findings.md",
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

    for (const [operator, value] of [["greaterThan", {}], ["in", "not a list"], ["notIn", 42], ["greaterThan", "2026-1-10"]]) {
      const parsed = parseDynamicForm(document(value, operator), { mode: "strict" });
      ctx.log.note("a value the parser was given", { operator, value, ok: parsed.ok });

      expectClaim(parsed.ok === true, {
        claimIds: ["DYN-001"],
        what: `the parser refused ${operator} with ${JSON.stringify(value)}, so the answers below are not reachable from a document`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }

    // A comparison a calendar would make, made by whatever the operator does instead.
    const wrong = [];
    for (const [left, right, later] of ORDERED) {
      const answered = ask("greaterThan", right, left);
      ctx.log.note("one date against another", { left, right, answered, later });
      if (answered !== later) wrong.push({ left, right, answered, later });
    }

    expectEqual(wrong, [], {
      claimIds: ["DYN-003"],
      what: `${wrong.length} of ${ORDERED.length} date comparisons answered the opposite of the order the dates are in`,
      detail: JSON.stringify(wrong),
    });

    // And the pair that has to be a pair: whatever `in` says, `notIn` says the other thing.
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
