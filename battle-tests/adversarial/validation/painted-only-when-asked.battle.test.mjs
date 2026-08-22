/**
 * A field painted red for a question nobody asked.
 *
 * `showsAsInvalid` and `shownErrors` are one rule with four faces — the class on the wrapper, the
 * state on the label, `aria-invalid`, and whether the error text renders at all — and the rule is
 * *out of play, no verdict*. A field the form is not asking about is not counted by
 * `form.state.valid()`, so painting it as failing shows a verdict the form does not hold: a closed
 * section of empty required fields becomes a block of red boxes for something nobody is being asked.
 *
 * The four faces are how the rule came apart before, which is why they were moved into one place.
 * What no battle checked is the thing that makes the rule right or wrong: whether the widget's idea
 * of "out of play" is the *form's*. Two layers, two implementations, one question — and a field the
 * form ignores while the widget paints it is invisible to every test that looks at one of them.
 *
 * So the assertion is agreement, in every state a field can be put into: whenever the form stops
 * counting a field, the widget stops painting it, and whenever the form counts it again, so does the
 * widget. Being inactive — a section a condition has closed — is included because that is the case
 * the rule was written for, and it reaches the widget through the same `disabled()` the binding does.
 */

import { createForm, vanillaReactivity } from "@modyra/core";
import { shownErrorsOf, showsAsInvalid } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    other: Object.freeze({ kind: "text" }),
    needed: Object.freeze({ kind: "text", required: true }),
  }),
});

battle(
  {
    claims: ["VAL-003", "VAL-002", "A11Y-002"],
    title: "a widget paints a field as failing exactly when the form counts it",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm(buildSchema(SPEC).schema, { reactivity: vanillaReactivity(), devWarnings: false });
    const handle = form.getField("needed");

    const look = (label) => {
      const state = handle();
      const flags = { disabled: state.disabled(), valid: state.valid() };
      const seen = {
        formCounts: form.state.valid() === false,
        paints: showsAsInvalid(flags),
        errors: shownErrorsOf(state).length,
      };
      ctx.log.note("what the form and the widget say", { label, ...seen });
      return seen;
    };

    // In play and empty: the ordinary state of a form nobody has filled in. Both layers agree it is
    // failing, and the error is there to be shown.
    const inPlay = look("empty and required");
    expectClaim(inPlay.formCounts && inPlay.paints && inPlay.errors === 1, {
      claimIds: ["VAL-003"],
      what: "an empty required field is not counted by the form or not painted by the widget",
      detail: JSON.stringify(inPlay),
    });

    // Taken out of play by a binding. The field is still failing on its own terms — the verdict was
    // never wrong — and neither layer acts on it.
    form.setDisabled("needed", () => true);
    const bound = look("disabled by a binding");
    expectEqual([bound.formCounts, bound.paints, bound.errors], [false, false, 0], {
      claimIds: ["VAL-002", "VAL-003"],
      what: "a disabled field is counted by the form, or painted, or shows its error",
    });

    // Taken out of play by a condition, which is the case the rule was written for. It reaches the
    // widget through the same question, so a section closing does not need the widget to know about
    // sections.
    form.setDisabled("needed", () => false);
    form.setInactive("needed", () => true);
    const closed = look("inside a closed section");
    expectEqual([closed.formCounts, closed.paints, closed.errors], [false, false, 0], {
      claimIds: ["VAL-003", "A11Y-002"],
      what: "a field in a closed section is counted by the form, or painted red, or shows its error",
    });

    // And back, because a rule that only ever silences is not the rule: the verdict returns the
    // moment the field is being asked about again.
    form.setInactive("needed", () => false);
    const back = look("back in play");
    expectEqual([back.formCounts, back.paints, back.errors], [true, true, 1], {
      claimIds: ["VAL-003"],
      what: "a field back in play did not get its verdict back",
    });

    // The other half of "it does not forget": filling it in satisfies both layers at once.
    form.f.needed.set("filled");
    const filled = look("filled in");
    expectEqual([filled.formCounts, filled.paints, filled.errors], [false, false, 0], {
      claimIds: ["VAL-003"],
      what: "a field the user filled in is still counted as failing or still painted",
    });

    form.destroy();
  },
);
