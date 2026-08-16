/**
 * A server check that is never made, on a form that calls itself submittable.
 *
 * Async validation needs a reactivity that can run effects. Not every one can — Angular's outside an
 * injection context reports `effects: false`, and an adapter that does not declare its capabilities
 * is read the same way — so the engine skips the check rather than half-starting it. That part is
 * documented and pinned in `angular/degraded-reactivity`.
 *
 * What a consumer is told is the rest of it, and it is now something rather than nothing: a form takes
 * a `diagnostics` sink and a skipped check reports `MDY_ASYNC_FEATURE_DISABLED` through it, outside
 * development as well as in it. This battle is that repair's regression.
 *
 * What it also pins is why the sink is needed at all: the two forms are **identical** on the surfaces
 * an application reads without one. `valid` and `canSubmit` say the same thing whether the server
 * judged the value or nobody did, so a uniqueness rule that quietly stopped being enforced looks
 * exactly like one that passes. The sink is the only thing that tells them apart.
 *
 * An earlier version of this battle installed the sink on `createForm` when `createForm` did not read
 * it, so "nothing reached the sink" was true whatever the engine did — it would have stayed red after
 * a correct repair.
 *
 * The engine is not wrong to skip the check — running half of it would be worse. It is the silence
 * that a consumer cannot build on: a uniqueness rule that quietly stopped being enforced looks
 * exactly like one that passes.
 */

import { createForm, field, serverValidator, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 80));

/** A reactivity that cannot run effects, which is what an adapter reports outside its own context. */
function withoutEffects() {
  const reactivity = vanillaReactivity();
  return { ...reactivity, capabilities: { ...reactivity.capabilities, effects: false } };
}

/** A form asking a server about its only field, over a given reactivity. */
async function asking(reactivity, devWarnings, answer = async () => ["already taken"]) {
  let ran = 0;
  const reported = [];
  const form = createForm(
    { a: field("", [], serverValidator(async (...args) => { ran += 1; return answer(...args); })) },
    { reactivity, devWarnings, diagnostics: { report: (diagnostic) => reported.push(diagnostic.code) } },
  );
  form.f.a.set("x");
  await settled();
  const state = { ran, reported, valid: form.state.valid(), canSubmit: form.state.canSubmit() };
  form.destroy();
  return state;
}

battle(
  {
    claims: ["VAL-001", "REA-002", "SUB-001"],
    title: "a check the reactivity cannot run is one the consumer is told about",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with a reactivity that can run effects, the check runs and the field is refused.
    // Everything below is about the reactivity rather than about a check that never worked.
    const capable = await asking(vanillaReactivity(), false);
    ctx.log.note("a reactivity that can run effects", capable);

    expectClaim(capable.ran > 0 && capable.valid === false, {
      claimIds: ["VAL-001"],
      what: "the server check did not run on a reactivity that can run effects",
      detail: JSON.stringify(capable),
    });

    // Skipping is the documented answer and not what this battle disputes.
    const skipped = await asking(withoutEffects(), false);
    ctx.log.note("a reactivity that cannot, in production", skipped);

    expectEqual(skipped.ran, 0, {
      claimIds: ["REA-002"],
      what: "the check half-started on a reactivity that cannot run effects, which is worse than skipping it",
    });

    // The premise: the check really did run in the other one, so the two differ in what happened
    // rather than in how they were built.
    const passed = await asking(vanillaReactivity(), false, async () => null);
    expectClaim(passed.ran > 0, {
      claimIds: ["VAL-001"],
      what: "the check did not run on a capable reactivity, so nothing below compares a skip with a run",
      detail: () => JSON.stringify({ skipped, passed }),
    });

    // What an application reads without a sink: the same thing either way. This is why the channel
    // matters, and it is asserted rather than described so that a future change making the state
    // itself distinguishable is visible here.
    const asRead = (state) => ({ valid: state.valid, canSubmit: state.canSubmit });
    ctx.log.note("the two forms, as an application reads them", { skipped: asRead(skipped), passed: asRead(passed) });

    expectEqual(asRead(skipped), asRead(passed), {
      claimIds: ["SUB-001"],
      what: "the two forms now differ in what they report, which would make the sink no longer the only way to tell them apart",
    });

    // And the channel itself, outside development: the skip is named, and a run that happened says
    // nothing.
    expectEqual(skipped.reported, ["MDY_ASYNC_FEATURE_DISABLED"], {
      claimIds: ["REA-002", "VAL-001"],
      what: "a skipped check did not name itself to the sink a consumer installed",
    });

    expectEqual(passed.reported, [], {
      claimIds: ["REA-002"],
      what: "a check that ran reported a degradation, so the sink says the same thing either way",
    });
  },
);
