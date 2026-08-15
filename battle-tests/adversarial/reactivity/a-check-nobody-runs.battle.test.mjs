/**
 * A server check that is never made, on a form that calls itself submittable.
 *
 * Async validation needs a reactivity that can run effects. Not every one can — Angular's outside an
 * injection context reports `effects: false`, and an adapter that does not declare its capabilities
 * is read the same way — so the engine skips the check rather than half-starting it. That part is
 * documented and pinned in `angular/degraded-reactivity`.
 *
 * What is not pinned is what a consumer is told. In development a console warning names the field. In
 * production, with `devWarnings` off, there is nothing: no console line, and nothing in the
 * `diagnostics` sink — the programmatic channel a consumer installs for exactly this. The form
 * reports `valid` and `canSubmit` for a value the server was supposed to judge and never saw.
 *
 * `MDY_ASYNC_FEATURE_DISABLED` is exported for this situation and never reaches the sink. The code,
 * the situation and the channel all exist and do not meet.
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
async function asking(reactivity, devWarnings) {
  let ran = 0;
  const reported = [];
  const form = createForm(
    { a: field("", [], serverValidator(async () => { ran += 1; return ["already taken"]; })) },
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

    // Skipping is the documented answer and not what this battle disputes: what it disputes is the
    // form calling itself submittable while saying nothing to the channel built for saying things.
    for (const devWarnings of [true, false]) {
      const degraded = await asking(withoutEffects(), devWarnings);
      ctx.log.note("a reactivity that cannot", { devWarnings, ...degraded });

      expectEqual(degraded.ran, 0, {
        claimIds: ["REA-002"],
        what: "the check half-started on a reactivity that cannot run effects, which is worse than skipping it",
      });

      // The sink is the channel a consumer installs to learn what the engine did on their behalf.
      // A dev-only console line is not one an application can act on.
      expectClaim(degraded.reported.length > 0, {
        claimIds: ["REA-002", "VAL-001"],
        what: `with devWarnings ${devWarnings}, a server check was skipped and nothing reached the diagnostics sink`,
        detail: JSON.stringify(degraded),
      });
    }
  },
);
