/**
 * What the form calls empty, and what a rule calls empty, for the same field.
 *
 * Two parts of the contract answer the question *has this been filled in?* — `required`, which
 * refuses a value the user has not supplied, and `isEmpty`/`isNotEmpty`, which a document's rules use
 * to reveal or hide the next field. They are the same question, asked by the validator and by the
 * condition, and a form is built out of both at once.
 *
 * For three kinds they disagree, and they disagree in opposite directions:
 *
 *   kind        seed                        required refuses it   isEmpty says empty
 *   text        ""                          yes                   yes
 *   number      null                        yes                   yes
 *   slider      0                           no                    no      ← the declared exception
 *   checkbox    false                       yes                   NO
 *   toggle      false                       yes                   NO
 *   daterange   {start:null,end:null}       yes                   NO
 *
 * `slider` is the shape of an *agreement*, not a defect: `schema.ts` says in as many words that a
 * thumb is always somewhere, so an untouched slider reads as filled — and both halves read it that
 * way. It is the control that shows the other three are wrong rather than merely different.
 *
 * What it costs a person, on one checkbox:
 *
 *   the rule    "reveal the address once they have answered"  →  revealed before they answer
 *   the form    "you have not filled this in"                 →  blocks the submit
 *
 * The form says the field is empty and the rule says it is filled, about the same untouched box, at
 * the same moment. And the direction the rule fails in is the one that opens: a section meant to
 * appear after an answer appears before it, which is the failure `expression.ts` narrates for a
 * different cause — *"shown to everyone, and the values inside it went into the payload"*.
 *
 * `daterange` is the same shape, and worse to spot: its empty is `{start:null,end:null}`, an object,
 * and an object is not one of the things `isEmptyValue` knows to look inside.
 */

import {
  MDY_FIELD_KINDS,
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  evaluateRuleCondition,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const NEEDS_OPTIONS = new Set(["select", "radio", "multiselect", "segmented"]);

/** What each half of the contract says about the value this kind starts from. */
function twoIdeasOfEmpty(kind) {
  const parsed = parseDynamicForm(
    {
      version: 1,
      fields: [
        {
          name: "x",
          kind,
          label: "X",
          validators: { required: true },
          ...(NEEDS_OPTIONS.has(kind) ? { options: [{ value: "a", label: "A" }] } : {}),
        },
      ],
    },
    "strict",
  );
  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  try {
    applyFlatValidators(form, parsed.fields);
    const seed = form.getValue().x;
    return {
      kind,
      seed,
      // The validator's idea: it refuses what has not been supplied.
      validatorCallsItEmpty: !form.state.valid(),
      // The condition's idea: the vocabulary a document's rules are written in.
      conditionCallsItEmpty: evaluateRuleCondition({ field: "x", operator: "isEmpty" }, { x: seed }),
    };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["VAL-001", "DYN-004"],
    title: "the validator and the condition agree about what empty means",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = MDY_FIELD_KINDS.map(twoIdeasOfEmpty);
    ctx.log.note("what each half of the contract says about each kind's own empty", observed);

    // The instrument: the vocabulary is whole, and both answers occur — otherwise "they agree"
    // could be a statement about one constant answer given twice.
    expectClaim(
      observed.length >= 17 &&
        observed.some((row) => row.validatorCallsItEmpty) &&
        observed.some((row) => !row.validatorCallsItEmpty) &&
        observed.some((row) => row.conditionCallsItEmpty) &&
        observed.some((row) => !row.conditionCallsItEmpty),
      {
        claimIds: ["VAL-001"],
        what: "one of the two halves gives the same answer for every kind, so agreement would mean nothing",
        detail: JSON.stringify(observed.map(({ kind, validatorCallsItEmpty, conditionCallsItEmpty }) => ({ kind, validatorCallsItEmpty, conditionCallsItEmpty }))),
      },
    );

    expectEqual(
      observed
        .filter((row) => row.validatorCallsItEmpty !== row.conditionCallsItEmpty)
        .map((row) => ({
          kind: row.kind,
          seed: row.seed,
          validator: row.validatorCallsItEmpty ? "empty" : "filled",
          condition: row.conditionCallsItEmpty ? "empty" : "filled",
        })),
      [],
      {
        claimIds: ["VAL-001", "DYN-004"],
        what: "the form and a rule disagree about whether an untouched field has been filled in, so one blocks the submit while the other reveals what should come after an answer",
      },
    );
  },
);
