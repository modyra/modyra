/**
 * A constraint the contract knows cannot fail, accepted without a word.
 *
 * `schema.ts` states the rule beside the table it belongs to: *"A kind whose empty value is a usable
 * value cannot be required. `number` is `null` and not `0` for exactly that reason — zero is a number
 * the user may well mean, so a field defaulted to it is one `required` can never fail. `slider` is
 * the deliberate exception: a thumb is always somewhere, so an untouched slider sits at its minimum
 * and reads as filled."*
 *
 * The reasoning is right and the consequence is not drawn. A document may write
 * `validators: { required: true }` on a slider, and the parser accepts it in strict with no
 * diagnostic. Measured across the vocabulary: sixteen of seventeen kinds have a `required` that can
 * refuse their own starting value; the slider's cannot, and nothing says so.
 *
 * This is not noise, which is what it looks like from the inside. From the outside it is a false
 * assurance: an author writes `required` to make a choice compulsory, ships it, and the form is
 * submitted by someone who never touched the control. The author's belief and the form's behaviour
 * disagree, and the only party who could have told them is the parser — the same parser that
 * refuses a constraint written one level too high, on the grounds that a constraint which does
 * nothing should be reported rather than dropped.
 *
 * The property is written over the vocabulary rather than about the slider, so a kind added later
 * whose empty is a usable value is covered the day it arrives: **either `required` can refuse the
 * value the kind starts from, or the document is told it cannot.**
 */

import {
  MDY_FIELD_KINDS,
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const NEEDS_OPTIONS = new Set(["select", "radio", "multiselect", "segmented"]);

/** Whether `required` on this kind can refuse the value the kind starts from, and what was said. */
function requiredOn(kind) {
  const parsed = parseDynamicForm(
    {
      version: 2,
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
    { mode: "strict" },
  );
  const said = parsed.diagnostics.map((each) => each.code);
  if (parsed.fields.length === 0) return { kind, refusedByParser: true, said };

  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  try {
    applyFlatValidators(form, parsed.fields);
    return { kind, refusedByParser: false, said, canFail: !form.state.valid() };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["VAL-001", "DYN-004"],
    title: "a required that cannot fail is reported rather than accepted",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = MDY_FIELD_KINDS.map(requiredOn);
    ctx.log.note("what required can do on each kind, and what the parser said about it", observed);

    // The instrument: most of the vocabulary must have a working `required`, or "one cannot fail"
    // would be a statement about a constraint that never works.
    const working = observed.filter((row) => row.canFail === true);
    expectClaim(working.length >= 12, {
      claimIds: ["VAL-001"],
      what: "required refuses almost nothing across the vocabulary, so the probe is wrong before the contract is",
      detail: JSON.stringify(observed.map(({ kind, canFail }) => ({ kind, canFail }))),
    });

    expectEqual(
      observed
        .filter((row) => !row.refusedByParser && row.canFail === false && row.said.length === 0)
        .map((row) => row.kind),
      [],
      {
        claimIds: ["VAL-001", "DYN-004"],
        what: "a required that cannot refuse the value its kind starts from was accepted in silence, so an author believes a choice is compulsory and the form is submitted untouched",
      },
    );
  },
);
