/**
 * Four words for what a rule does, and two things that happen.
 *
 * The contract declares four effects — `visible`, `hidden`, `enabled`, `disabled` — and the parser
 * polices them one at a time: an effect nobody declared is refused by name. Two pairs of words that
 * mean different things, or there would be two.
 *
 * A form built from a document keeps all four, and answers with two. `visible` and `enabled` are
 * indistinguishable; `hidden` and `disabled` are indistinguishable; and nothing is ever hidden. A
 * field a document says to show only sometimes is on the screen always, greyed out for the rest.
 *
 * Measured on every axis a consumer has: what the form reports valid, whether it may be sent, what it
 * sends, and what the control wears. `browser/a-rule-that-fires-on-nothing.spec.ts` takes the same
 * question to the page.
 *
 * Reported rather than enforced: nothing leaves that should not, and the two behaviours that exist
 * are the safe ones. What is wrong is that a document author writing `hidden` gets `disabled`, and
 * the vocabulary the parser guards is wider than the vocabulary the form has.
 */

import { applyDynamicRules, buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const EFFECTS = Object.freeze(["visible", "hidden", "enabled", "disabled"]);

const document = {
  node: "group",
  children: {
    who: { node: "field", field: { kind: "text", label: "Who" } },
    extra: { node: "field", field: { kind: "text", label: "Extra" } },
  },
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 70));

/** Everything a consumer can observe about the field the rule names, in one string. */
async function observe(effect, who) {
  const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
  applyDynamicRules(form, [{
    effect,
    target: "extra",
    when: { field: "who", operator: "equals", value: "yes" },
  }]);
  form.patchValue({ who });
  await settled();

  const handle = form.f.extra;
  const seen = [
    `valid=${form.state.valid()}`,
    `canSubmit=${form.state.canSubmit()}`,
    `submits=${Object.hasOwn(form.submitValue(), "extra")}`,
    `disabled=${handle.disabled()}`,
    `interactivity=${handle.interactivity()}`,
  ].join(" ");
  form.destroy();
  return seen;
}

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "the four effects a document may write are four things a form does",
    environments: ["node"],
    open: "reported, not enforced: finding 159, open in battle-tests/reports/open-findings.md",
  },
  async (ctx) => {
    const answers = {};
    for (const effect of EFFECTS) {
      answers[effect] = { off: await observe(effect, "no"), on: await observe(effect, "yes") };
    }
    ctx.log.note("what each declared effect does, on both sides of its condition", { answers });

    // The premise: a rule does something at all. Without this, four effects that do nothing would
    // agree with each other and the assertion below would pass on an empty form.
    expectClaim(answers.disabled.off !== answers.disabled.on, {
      claimIds: ["DYN-001"],
      what: "a rule changed nothing on either side of its condition, so nothing below is a measurement",
      detail: JSON.stringify(answers.disabled),
    });

    // Four words, four behaviours — or the parser is guarding a vocabulary the form does not have.
    const distinct = new Set(EFFECTS.map((effect) => `${answers[effect].off}|${answers[effect].on}`));
    expectEqual(distinct.size, EFFECTS.length, {
      claimIds: ["DYN-003"],
      what: `${EFFECTS.length} declared effects produced ${distinct.size} distinct behaviours`,
      detail: JSON.stringify(answers),
    });
  },
);
