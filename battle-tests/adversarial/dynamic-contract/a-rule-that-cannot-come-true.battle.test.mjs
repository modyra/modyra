/**
 * A rule the parser accepts, over a choice the user can make, that can never be true.
 *
 * ADR 0051 lets an option carry an object as its value, which is what a select over records rather
 * than over strings needs. The rule vocabulary compares with `equals`, and `equals` on the tree side
 * is SameValueZero — identity, for objects. A document carries its options in one place and its rule
 * in another, so the two objects are never the same object: written by hand they are two literals,
 * and arriving over the wire they are two results of one `JSON.parse`.
 *
 * The rule is therefore false for every choice the user can make, and the parser says nothing —
 * `ok: true`, no diagnostics, in **strict** mode, which is the mode whose whole promise is that a
 * partly valid document is never accepted.
 *
 * Which way it then fails depends on the effect, and one of the two is the failure `expression.ts`
 * already describes as having happened once for a different cause:
 *
 *   visible   the field the rule was written to reveal never appears
 *   hidden    the field the rule was written to hide is shown to everyone, and its values go into
 *             the payload
 *
 * The property asserted here is not "this rule must be true", which would depend on what the user
 * picks. It is that **a rule the parser accepts can come true**: somewhere in the choices the
 * document itself declares, there is one that changes the answer. A rule for which no declared
 * choice changes anything is inert, and a contract that accepts it silently has described a form
 * that cannot exist.
 */

import {
  applyDynamicRules,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A document whose rule names the first option's value, however that value is spelled. */
function documentWith(optionValues, effect) {
  return {
    version: 2,
    fields: [
      {
        name: "plan",
        kind: "select",
        label: "Plan",
        options: optionValues.map((value, index) => ({ value, label: `Option ${index}` })),
      },
      { name: "seats", kind: "number", label: "Seats" },
    ],
    rules: [
      {
        effect,
        target: "seats",
        // Structurally the first option, and a separate object — exactly what a document is after
        // `JSON.parse`, and what a hand-written one is too.
        when: { field: "plan", operator: "equals", value: JSON.parse(JSON.stringify(optionValues[0])) },
      },
    ],
  };
}

/**
 * Whether any choice the document declares changes what the rule decides.
 *
 * The user picks a value **out of the options list**, because that is what a control hands back —
 * not a value reconstructed by the caller.
 */
function everComesTrue(document) {
  const parsed = parseDynamicForm(document, "strict");
  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  try {
    applyDynamicRules(form, parsed.rules);
    const answers = parsed.fields[0].options.map((option) => {
      form.f.plan.set(option.value);
      return form.f.seats.disabled();
    });
    return {
      accepted: parsed.ok,
      diagnostics: parsed.diagnostics.map((each) => each.code),
      answers,
      everChanges: new Set(answers).size > 1,
    };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["DYN-004"],
    title: "a rule the parser accepts can come true",
    environments: ["node"],
  },
  async (ctx) => {
    const cases = [
      { name: "options carrying strings", values: ["free", "pro"] },
      { name: "options carrying numbers", values: [0, 2] },
      { name: "options carrying objects", values: [{ id: "free", tier: 0 }, { id: "pro", tier: 2 }] },
    ];

    const observed = cases.flatMap((entry) =>
      ["visible", "hidden"].map((effect) => ({
        case: `${entry.name}, ${effect}`,
        ...everComesTrue(documentWith(entry.values, effect)),
      })),
    );
    ctx.log.note("what each document's rule can ever decide", observed);

    // The instrument: the ordinary spellings must come true, or "objects do not" would be a
    // statement about a probe that never made any rule fire.
    const ordinary = observed.filter((row) => !row.case.startsWith("options carrying objects"));
    expectClaim(ordinary.length >= 4 && ordinary.every((row) => row.everChanges), {
      claimIds: ["DYN-004"],
      what: "no rule fires at all, so the probe is wrong before the contract is",
      detail: JSON.stringify(ordinary),
    });

    // Either the rule can come true, or the parser said the document was not usable. Both are
    // acceptable answers; silently accepting an inert rule is not.
    expectEqual(
      observed
        .filter((row) => !row.everChanges && row.accepted && row.diagnostics.length === 0)
        .map((row) => row.case),
      [],
      {
        claimIds: ["DYN-004"],
        what: "strict mode accepted a rule with no diagnostic that no declared choice can ever satisfy, so the document describes a form that cannot exist",
      },
    );
  },
);
