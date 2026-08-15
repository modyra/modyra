/**
 * What a submission is of, when the form keeps moving.
 *
 * A rule decides whether a field is in play, and therefore whether its value is sent. Now that a
 * document can carry rules, the condition behind one is a field a user is typing into — so the
 * question "which state was sent" has an answer that can change between asking and arriving.
 *
 * Three moments, and the third is the one worth pinning: a submission taken before a change must not
 * be rewritten by it. A payload that followed the model after it left would mean a consumer's server
 * received something the user never saw, and a retry would send something different again.
 *
 * The first two are the controls, and they establish that the rule is doing anything at all: with the
 * condition settled, and with it changed in the same tick, the field the rule switched off is out of
 * what is sent.
 *
 * The handler belongs to `submit`. A form takes no `onSubmit` — passing one to `createForm` is an
 * option it does not read, which is how an earlier version of this measurement recorded three empty
 * payloads and nearly reported them.
 */

import { applyDynamicRules, buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const document = {
  node: "group",
  children: {
    mode: { node: "field", field: { kind: "text", label: "M" } },
    extra: { node: "field", field: { kind: "text", label: "E" } },
  },
};

const RULES = [{
  effect: "hidden",
  target: "extra",
  when: { field: "mode", operator: "equals", value: "off" },
}];

const settled = (ms = 90) => new Promise((resolve) => setTimeout(resolve, ms));

function open() {
  const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
  applyDynamicRules(form, RULES);
  return form;
}

battle(
  {
    claims: ["SUB-001", "DYN-001"],
    title: "a submission is of the state it was asked about",
    environments: ["node"],
  },
  async (ctx) => {
    const sent = [];
    const handler = (value) => { sent.push(value); };

    // The condition settled before the ask: the field the rule switched off is not sent.
    const settledFirst = open();
    settledFirst.patchValue({ mode: "on", extra: "typed" });
    await settled();
    settledFirst.patchValue({ mode: "off" });
    await settled();
    await settledFirst.submit(handler);
    await settled();
    ctx.log.note("the condition changed, then the form was asked", { sent: sent.at(-1) });

    expectEqual(sent.at(-1), { mode: "off" }, {
      claimIds: ["DYN-001"],
      what: "a field a rule switched off was sent, so the rule is not deciding what leaves",
    });

    settledFirst.destroy();

    // The same change and the ask in one tick, with nothing settling in between.
    const sameTick = open();
    sameTick.patchValue({ mode: "on", extra: "typed" });
    await settled();
    sameTick.patchValue({ mode: "off" });
    await sameTick.submit(handler);
    await settled();
    ctx.log.note("the condition changed and the form asked in the same tick", { sent: sent.at(-1) });

    expectEqual(sent.at(-1), { mode: "off" }, {
      claimIds: ["SUB-001"],
      what: "a change and an ask in one tick sent the state from before the change",
    });

    sameTick.destroy();

    // And the one that must not follow the model: the ask happens, then the condition changes.
    const midFlight = open();
    midFlight.patchValue({ mode: "on", extra: "typed" });
    await settled();
    const inFlight = midFlight.submit(handler);
    midFlight.patchValue({ mode: "off" });
    await inFlight;
    await settled();
    ctx.log.note("the condition changed while the submission was in flight", { sent: sent.at(-1) });

    expectEqual(sent.at(-1), { mode: "on", extra: "typed" }, {
      claimIds: ["SUB-001"],
      what: "a submission was rewritten by a change made after it was asked for",
    });

    midFlight.destroy();
  },
);
