/**
 * The runtime that tells the truth about what it cannot do.
 *
 * `angularReactivity()` is published from `@modyra/angular/adapter` so a consumer can hand Angular's
 * own signals to `createForm`. Angular's `effect()` needs an `Injector`, and a consumer who has none
 * — a test, a script, a service constructed outside an injection context — gets a runtime that
 * reports `capabilities.effects: false`.
 *
 * The engine then skips the features that need one — async validators, drafts, history — and says so
 * once per feature. That is the documented behaviour and it is the only runtime in the workspace
 * where it happens: every other adapter reports `effects: true`, so this is the sole live exercise of
 * the engine's own "may I rely on an effect, or must I push" branch.
 *
 * Nothing tested it. `differential/runtimes/every-runtime` deliberately excludes Angular, and the
 * reason is this: handing it a form with an async rule and comparing against effect-capable runtimes
 * compares a documented degradation with a full one, and would report a divergence that is the
 * contract working.
 *
 * So this pins the degradation instead: the capability is honest, the feature is skipped rather than
 * half-started, the *rest* of the form is unaffected, and the consumer is told. Each of those is a
 * separate way the same design could go wrong — a capability that claims effects and then raises, a
 * validator left permanently pending, a synchronous rule taken down with the async one, or a silent
 * skip.
 */

import "@angular/compiler";

import { createForm, field, minLength, required } from "@modyra/core";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

/** Collect what the engine says while `run` executes, without losing this battle's own output. */
async function withConsoleCaptured(run) {
  const said = [];
  const real = {};
  for (const level of ["warn", "error", "log", "info"]) {
    real[level] = console[level];
    console[level] = (...parts) => said.push(`${level}: ${parts.join(" ")}`);
  }
  try {
    return { result: await run(), said };
  } finally {
    for (const level of ["warn", "error", "log", "info"]) console[level] = real[level];
  }
}

/** An async rule that would settle if it were ever started. */
const settles = () => new Promise((resolve) => setTimeout(() => resolve([]), 20));

battle(
  {
    claims: ["REA-001", "VAL-001"],
    title: "a runtime with no effects says so, and the engine believes it",
    environments: ["node"],
  },
  async (ctx) => {
    const { angularReactivity } = await import("@modyra/angular/adapter");
    const reactivity = angularReactivity();
    ctx.log.note("what angular's reactivity reports with no injector", {
      kind: reactivity.kind,
      effects: reactivity.capabilities.effects,
      effectOwnership: reactivity.capabilities.effectOwnership,
    });

    // It is angular's, not a fallback to something else — a runtime that quietly became vanilla
    // would run the async rule and this battle would be about nothing.
    expectEqual(reactivity.kind, "angular", {
      claimIds: ["REA-001"],
      what: "the adapter did not supply a runtime of its own kind",
    });

    // The capability is the engine's only way to ask, and it must not claim what it cannot do.
    expectEqual(reactivity.capabilities.effects, false, {
      claimIds: ["REA-001"],
      what: "a runtime with no injector claims it can run effects",
      detail: JSON.stringify(reactivity.capabilities),
    });

    // Ownership travels with it: an effect that cannot be created cannot be torn down either, and
    // claiming otherwise would have a consumer believe a teardown happened.
    expectEqual(reactivity.capabilities.effectOwnership, false, {
      claimIds: ["REA-001"],
      what: "a runtime that cannot create an effect claims it can own one",
      detail: JSON.stringify(reactivity.capabilities),
    });
  },
);

battle(
  {
    claims: ["VAL-001", "REA-001"],
    title: "a rule the runtime cannot run is skipped, said out loud, and takes nothing with it",
    environments: ["node"],
  },
  async (ctx) => {
    const { angularReactivity } = await import("@modyra/angular/adapter");

    const { result, said } = await withConsoleCaptured(async () => {
      const form = createForm(
        {
          name: field("", [required(), minLength(3)]),
          checked: field("x", [], { asyncValidators: [settles] }),
        },
        { reactivity: angularReactivity(), devWarnings: true },
      );

      form.f.checked.set("changed");
      const pendingImmediately = form.f.checked.pending?.() ?? null;
      await new Promise((resolve) => setTimeout(resolve, 60));

      const observed = {
        pendingImmediately,
        pendingAfterSettling: form.f.checked.pending?.() ?? null,
        syncErrors: form.errorsFor("name")().map((each) => each.message),
        valid: form.state.valid(),
      };
      form.f.name.set("abcd");
      observed.validOnceSyncIsSatisfied = form.state.valid();
      form.destroy();
      return observed;
    });

    ctx.log.note("a form with an async rule on a runtime that cannot run one", { ...result, said });

    // Skipped rather than half-started: a rule that began and never settled would leave the field
    // pending for the life of the form, which is worse than not running it — the form could never
    // be submitted and nothing would say why.
    expectEqual([result.pendingImmediately, result.pendingAfterSettling], [false, false], {
      claimIds: ["VAL-001"],
      what: "an async rule that cannot run left the field pending",
      detail: JSON.stringify(result),
    });

    // Said out loud. A feature disappearing quietly is the failure this warning exists to prevent,
    // and it names the field so a consumer knows which rule they lost.
    const warned = said.filter((line) => line.includes("[modyra]") && /async/i.test(line));
    expectClaim(warned.length > 0 && warned.some((line) => line.includes("checked")), {
      claimIds: ["VAL-001"],
      what: "an async rule was skipped without the engine saying so, or without naming the field",
      detail: JSON.stringify(said),
    });

    // And the rest of the form is untouched. The synchronous rules on another field still hold and
    // still clear — a degradation that took the whole verdict with it would be a different failure.
    expectEqual(result.syncErrors, ["This field is required"], {
      claimIds: ["VAL-001"],
      what: "a synchronous rule stopped working on a runtime that cannot run effects",
      detail: JSON.stringify(result),
    });

    expectEqual([result.valid, result.validOnceSyncIsSatisfied], [false, true], {
      claimIds: ["VAL-001"],
      what: "the form's verdict does not follow its synchronous rules once the async one is skipped",
      detail: JSON.stringify(result),
    });
  },
);
