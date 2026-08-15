/**
 * A condition whose operator is misspelled, and the section it opens.
 *
 * `MdyExpressionOp` is a closed set of twelve. Two published functions read it, and they do not agree
 * about a thirteenth:
 *
 *     validateExpression({ op: "eqals", … }, "when")   →  ["when: unknown operator \"eqals\""]
 *     evaluateExpression({ op: "eqals", … }, value)    →  true
 *
 * One refuses it by name. The other answers, and answers `true` — which for a visibility condition is
 * the most consequential answer available: the section opens. A group gated on "only when the country
 * is FR" is shown to everybody, and its values are in what the form sends.
 *
 * This is the same asymmetry the expression depth limit has — checked where a document is read,
 * unguarded where a value is evaluated — and here the unguarded side does not fail: it decides.
 *
 * Both controls are green and both are needed: with the operator spelled correctly the section is
 * closed when the condition is false and open when it is true. So the finding is the misspelling, not
 * a condition that never works or one that always does.
 */

import { createForm, evaluateExpression, field, group, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 80));

/** Build a form whose section is gated on `rule` read against `value`, and report what it would send. */
async function sentUnder(rule, country) {
  const form = createForm(
    {
      country: field(country),
      extra: group({ vat: field("secret") }, { when: () => evaluateExpression(rule, { country }) }),
    },
    { devWarnings: false },
  );
  await settled();
  let payload = null;
  await form.submit((value) => {
    payload = value;
  });
  form.destroy();
  return payload;
}

const ruleFor = (op) => ({ op, operands: [{ path: "country" }, "FR"] });

battle(
  {
    claims: ["DYN-003", "VAL-003"],
    title: "an operator nobody declared does not decide that a section is shown",
    environments: ["node"],
  },
  async (ctx) => {
    // The two controls: spelled correctly, the condition closes and opens the section.
    const closed = await sentUnder(ruleFor("equals"), "IT");
    const open = await sentUnder(ruleFor("equals"), "FR");
    ctx.log.note("the condition spelled the way the vocabulary declares", { closed, open });

    expectEqual(closed, { country: "IT" }, {
      claimIds: ["VAL-003"],
      what: "a false condition did not keep its section out of the payload, so nothing below is about the operator",
    });

    expectEqual(open, { country: "FR", extra: { vat: "secret" } }, {
      claimIds: ["VAL-003"],
      what: "a true condition did not put its section in the payload, so the gate never opens",
    });

    // The author-time half: an operator outside the vocabulary is refused, and named.
    for (const op of ["eqals", "nonsense", ""]) {
      const issues = validateExpression(ruleFor(op), "when");
      expectClaim(issues.length > 0 && issues.some((issue) => String(issue).includes(op)), {
        claimIds: ["DYN-003"],
        what: `validateExpression accepted the operator ${JSON.stringify(op)}, so there is nothing for the runtime to disagree with`,
        detail: JSON.stringify(issues),
      });
    }

    // And the runtime half, on the same rules the check just refused.
    const opened = [];
    for (const op of ["eqals", "nonsense", ""]) {
      const answered = evaluateExpression(ruleFor(op), { country: "IT" });
      const payload = await sentUnder(ruleFor(op), "IT");
      ctx.log.note("a condition whose operator is not one", { op, answered, payload });
      if (payload.extra !== undefined) opened.push({ op, answered, payload });
    }

    // Either repair closes it: refuse the operator where it is evaluated too, or answer the way a
    // condition nobody can read should answer — closed. What this refuses is a misspelling deciding
    // that a section is shown and sent.
    expectEqual(opened, [], {
      claimIds: ["DYN-003", "VAL-003"],
      what: "an operator outside the vocabulary opened a section its condition should have closed, and its value was sent",
      detail: JSON.stringify(opened),
    });
  },
);
