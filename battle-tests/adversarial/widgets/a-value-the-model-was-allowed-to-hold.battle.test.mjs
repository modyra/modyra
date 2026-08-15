/**
 * A value the form was built to report, handed to the part that has to draw it.
 *
 * A wrong shape is a verdict here, not a refusal. `patchValue` is public, it takes whatever an
 * application's own backend hands it, and `MDY_VALUE_CONTRACTS` is enforced by validating the value
 * rather than by rejecting the write — a datepicker holding an object is *in the model*, invalid,
 * with `canSubmit` false. That layering is deliberate and recorded: the draft gate leans on it
 * directly, accepting anything JSON against a null initial because the verdict below refuses it.
 *
 * The layering only works while the page keeps drawing. A projection that throws on the same value
 * takes the control out with it, and what the user is left looking at is the state before the write:
 * a field that says nothing is wrong, on a form that will not send.
 *
 * The contrast is the argument. Two neighbouring functions answer the same question for two kinds —
 * what to show when the value is not among the options — and one of them already handles every value
 * this battle passes. So the behaviour asserted here is not invented for the occasion; it is the
 * behaviour the singular one has and the plural one does not.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";
import { optionsWithUnrecognizedValue, optionsWithUnrecognizedValues } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const OPTIONS = Object.freeze([
  Object.freeze({ value: "a", label: "A" }),
  Object.freeze({ value: "b", label: "B" }),
]);

/** Values of another shape entirely, which is what makes them a verdict rather than a choice. */
const OTHER_SHAPES = Object.freeze(["not a list", 42, {}, true]);

/** Both are legitimate for a field that has not been filled in, and both are already handled. */
const EMPTY = Object.freeze([null, undefined]);

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

battle(
  {
    claims: ["UI-008", "VAL-003"],
    title: "the form admits a value of the wrong shape and reports it, which is what the page must draw",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise the rest of this file rests on: this is a state a form can be in through a public
    // call, not one reached by reaching inside.
    const document = {
      node: "group",
      children: {
        tags: {
          node: "field",
          field: { kind: "multiselect", label: "Tags", options: [...OPTIONS] },
        },
      },
    };

    for (const wrong of OTHER_SHAPES) {
      const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
      form.patchValue({ tags: wrong });
      await settled();

      const held = form.getValue().tags;
      const errors = form.errorsFor("tags")();
      ctx.log.note("a shape the field cannot hold, written through a public call", {
        wrong,
        held,
        canSubmit: form.state.canSubmit(),
        errors: errors.map((each) => each.message),
      });

      expectEqual(held, wrong, {
        claimIds: ["UI-008"],
        what: `the model refused ${JSON.stringify(wrong)} instead of holding it and reporting it`,
      });

      expectClaim(errors.length > 0 && form.state.canSubmit() === false, {
        claimIds: ["VAL-003"],
        what: `a multiselect holding ${JSON.stringify(wrong)} left the form submittable`,
        detail: JSON.stringify(errors),
      });

      form.destroy();
    }
  },
);

battle(
  {
    claims: ["UI-008"],
    title: "the option projection answers for a value the model was allowed to hold",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, first: the singular one is handed every value this battle uses, and answers. It
    // is what the assertion below is measured against — the same question, for the kind next door,
    // already solved.
    for (const wrong of [...OTHER_SHAPES, ...EMPTY]) {
      let answered = null;
      try {
        answered = optionsWithUnrecognizedValue(OPTIONS, wrong);
      } catch (error) {
        answered = error;
      }
      ctx.log.note("the singular projection, handed a value of another shape", {
        wrong,
        answered: answered instanceof Error ? String(answered.message) : answered.length,
      });

      expectClaim(Array.isArray(answered), {
        claimIds: ["UI-008"],
        what: `the singular projection did not answer for ${JSON.stringify(wrong)}, so it is not the control this battle takes it for`,
        detail: answered instanceof Error ? String(answered.message) : JSON.stringify(answered),
      });
    }

    // And emptiness through the plural, which it already handles — so a failure below is about the
    // shape rather than about a function that only ever accepts one thing.
    for (const empty of EMPTY) {
      expectClaim(Array.isArray(optionsWithUnrecognizedValues(OPTIONS, empty)), {
        claimIds: ["UI-008"],
        what: `the plural projection did not answer for ${String(empty)}`,
      });
    }

    for (const wrong of OTHER_SHAPES) {
      let answered = null;
      let threw = null;
      try {
        answered = optionsWithUnrecognizedValues(OPTIONS, wrong);
      } catch (error) {
        threw = error;
      }
      ctx.log.note("the plural projection, handed the same value", {
        wrong,
        threw: threw === null ? null : String(threw.message),
      });

      expectClaim(threw === null && Array.isArray(answered), {
        claimIds: ["UI-008"],
        what: `the projection a multiselect draws from threw on ${JSON.stringify(wrong)}, which the model holds and reports`,
        detail: threw === null ? JSON.stringify(answered) : String(threw.message),
      });
    }
  },
);
