/**
 * A form waiting on an answer about a field that is no longer part of it.
 *
 * A server check is abandoned when its value stops being one the field accepts — measured in
 * `what-the-server-is-asked`, and right: the answer would be about something the form no longer holds.
 *
 * A field leaving play is the other way of the same thing happening, and the run is not abandoned. The
 * check stays in flight, `pending` stays true, and `canSubmit` stays false — for a field that is not
 * in `submitValue()` at all. A user who switched a section off is waiting on a question about
 * something they cannot see and could not answer.
 *
 * Without `timeoutMs` the wait has no end. The option exists and ends it, and that is recorded rather
 * than treated as the answer: it is optional, its default is unbounded, and the other way of a field
 * ceasing to matter needs no timeout at all.
 *
 * The two are measured side by side from the same starting state, so what differs is the reason the
 * field stopped mattering and nothing else.
 */

import { applyDynamicRules, createForm, field, minLength, required, serverValidator } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A form whose `code` is being checked by a server that has not answered, with a rule able to take
 * the field out of play when `mode` changes.
 */
function asking({ timeoutMs } = {}) {
  const form = createForm({
    mode: field("on"),
    code: field("", [required(), minLength(3)], serverValidator(
      async () => new Promise(() => {}),
      { debounceMs: 5, ...(timeoutMs === undefined ? {} : { timeoutMs }) },
    )),
  }, { devWarnings: false });

  applyDynamicRules(form, [{
    effect: "hidden",
    target: "code",
    when: { field: "mode", operator: "equals", value: "off" },
  }]);
  return form;
}

battle(
  {
    claims: ["VAL-005", "SUB-001"],
    severity: "S1",
    title: "a field that leaves play stops the question being asked about it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the other way a field stops mattering abandons the run, with no timeout involved.
    const byValue = asking();
    byValue.f.code.set("abc");
    await settled(260);
    const beforeValue = { pending: byValue.state.pending(), canSubmit: byValue.state.canSubmit() };
    byValue.f.code.set("ab");
    await settled(240);
    const afterValue = { pending: byValue.state.pending(), canSubmit: byValue.state.canSubmit() };
    byValue.destroy();
    ctx.log.note("the value stops being acceptable", { beforeValue, afterValue });

    expectEqual([beforeValue.pending, afterValue.pending], [true, false], {
      claimIds: ["VAL-005"],
      what: "a run was not abandoned when its value stopped being acceptable, so there is nothing for the other case to be compared against",
    });

    // And the same starting state, with the field taken out of play instead.
    const byRule = asking();
    byRule.f.code.set("abc");
    await settled(260);
    const beforeRule = { pending: byRule.state.pending(), canSubmit: byRule.state.canSubmit() };
    byRule.f.mode.set("off");
    await settled(900);
    const afterRule = {
      pending: byRule.state.pending(),
      canSubmit: byRule.state.canSubmit(),
      submits: Object.keys(byRule.submitValue()),
    };
    byRule.destroy();
    ctx.log.note("a rule takes the field out of play", { beforeRule, afterRule });

    // The premise: both started the same way.
    expectEqual(beforeRule, beforeValue, {
      claimIds: ["VAL-005"],
      what: "the two cases did not start from the same state, so the difference below is not the reason the field stopped mattering",
    });

    // The cost: the field is not in what would be sent, and the form cannot be sent.
    expectClaim(!afterRule.submits.includes("code"), {
      claimIds: ["SUB-001"],
      what: "the field out of play is still in the submitted value, which is a different finding",
      detail: () => JSON.stringify(afterRule),
    });

    expectEqual(afterRule.pending, false, {
      claimIds: ["VAL-005", "SUB-001"],
      what: "a field taken out of play left its server check in flight, so the form waits on a question about something it will not send and the user cannot see",
    });
  },
);

battle(
  {
    claims: ["VAL-005"],
    title: "a timeout ends the wait, and is not the only thing that should",
    environments: ["node"],
  },
  async (ctx) => {
    // Recorded rather than treated as the answer: the option exists and works. It is optional, its
    // default is unbounded, and the value-side case above needs none.
    const bounded = asking({ timeoutMs: 300 });
    bounded.f.code.set("abc");
    await settled(260);
    bounded.f.mode.set("off");
    await settled(900);
    const ended = { pending: bounded.state.pending(), canSubmit: bounded.state.canSubmit() };
    bounded.destroy();
    ctx.log.note("the same case with a timeout set", ended);

    expectEqual(ended, { pending: false, canSubmit: true }, {
      claimIds: ["VAL-005"],
      what: "a timeout did not end a run on a field that left play, so the finding beside this one has no mitigation at all",
    });
  },
);
