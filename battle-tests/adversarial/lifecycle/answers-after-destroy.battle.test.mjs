/**
 * A form that has been torn down, asked the same question four ways.
 *
 * A destroyed form keeps answering rather than throwing, which is deliberate: renderer teardown
 * reads the value after the form is gone, and an exception there takes down the teardown. Nothing
 * here disputes that.
 *
 * What nothing decided is whether the answers have to agree. They do not. On a form holding one
 * valid row, destroyed:
 *
 *   getValue()          the row, whole
 *   rows.keys()         ["a"] — the row is there
 *   cell.value()        null — the row's cell holds nothing
 *   submitValue()       {} — there is no row
 *   fieldNames()        [] — there are no fields
 *   state.valid()       true
 *   state.canSubmit()   true
 *
 * Any consumer composing two of those gets a contradiction, and one composition is ordinary enough
 * to write without thinking: `if (form.state.canSubmit()) send(form.submitValue())` in a teardown
 * path sends an empty payload for a form that has just reported itself submittable.
 *
 * Which way it should go is a decision — capture everything at destroy, or say the form is gone in
 * every answer. This battle takes neither side: it asserts the answers do not contradict each other,
 * so both fixes turn it green and the present state does not.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text", required: true }) }),
    }),
  }),
});

battle(
  {
    claims: ["LIF-001", "SUB-001"],
    title: "a destroyed form does not report itself submittable with nothing to submit",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { history: true });
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });

    // The control: while it is alive, every answer agrees. What follows is destroy rather than a
    // form that never held anything.
    expectClaim(
      context.form.state.canSubmit() === true &&
        Object.keys(context.form.submitValue().rows ?? {}).length === 1,
      {
        claimIds: ["SUB-001"],
        what: "the living form did not hold a submittable row, so the battle attacks nothing",
        detail: JSON.stringify(context.form.submitValue()),
      },
    );

    context.form.destroy();

    const answers = {
      getValue: context.form.getValue().rows ?? {},
      submitValue: context.form.submitValue().rows ?? {},
      keys: [...context.collections.rows.keys()],
      valid: context.form.state.valid(),
      canSubmit: context.form.state.canSubmit(),
      fieldNames: context.form.fieldNames().length,
    };
    ctx.log.note("what a destroyed form answers", answers);

    // The composition a teardown path writes without thinking. Reporting a form as submittable and
    // then handing back nothing to submit is the one pair that turns into a wrong request.
    expectClaim(
      answers.canSubmit === false || Object.keys(answers.submitValue).length > 0,
      {
        claimIds: ["LIF-001", "SUB-001"],
        what: "a destroyed form reports itself submittable and submits nothing",
        detail: JSON.stringify({ canSubmit: answers.canSubmit, submitValue: answers.submitValue }),
      },
    );

    // And the same disagreement stated between the two reads of the value itself: whichever answer
    // is right, a form cannot hold a row for one caller and not for another.
    expectEqual(Object.keys(answers.getValue), Object.keys(answers.submitValue), {
      claimIds: ["LIF-001"],
      what: "getValue and submitValue disagree about which rows a destroyed form holds",
      detail: JSON.stringify({ getValue: answers.getValue, submitValue: answers.submitValue }),
    });
  },
);
