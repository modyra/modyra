/**
 * The suite every adapter passes, fed adapters that should not pass.
 *
 * `runReactivityContractTests` is the published conformance kit: core, Vue, Solid, Preact, Svelte,
 * React and Lit each run it against their own reactivity and are conformant if it is quiet. A gate
 * like that is only worth what it refuses, so this feeds it reactivities broken in one way each and
 * asks which ones it catches.
 *
 * It catches four of six. A signal that never notifies fails four of its checks, a computed that never
 * recomputes fails three, a scope whose `destroy` does nothing fails two, and an `untracked` that
 * tracks anyway fails one. Those are the ones a reader would expect, and they are asserted so a
 * regression in the kit shows up here rather than as an adapter that quietly stops being checked.
 *
 * Two get through:
 *
 *   - **An effect that runs once and never again.** This is not hypothetical here. The cross-runtime
 *     differential records it happening: without the `browser` export condition Solid resolved to a
 *     build "whose computations never re-run, and a form on it froze at creation". The kit does not
 *     ask whether an effect re-runs, so the build that did that would pass it.
 *   - **One that claims capabilities it does not have.** `MDY_ADAPTER_CONTRACT_VIOLATION` exists for
 *     "a fictitious capability" in as many words, and the kit does not check for one.
 *
 * The consequence of the first is measured rather than argued: on such an adapter a form still
 * validates — validity flows through computeds — and its **draft is never written**. Nothing throws
 * and nothing warns. A host would ship it and discover it from a user who lost an hour of typing.
 */

import { createForm, field, vanillaReactivity } from "@modyra/core";
import { runReactivityContractTests } from "@modyra/core/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Run the published kit against one reactivity and collect what it said. */
function conformanceOf(make) {
  const results = [];
  const test = (name, run) => {
    const record = (error) => results.push({ name, ok: error === undefined });
    try {
      const outcome = run();
      if (outcome !== null && typeof outcome?.then === "function") return outcome.then(() => record(), record);
      record();
    } catch (error) {
      record(error);
    }
    return undefined;
  };
  const assert = {
    equal: (actual, expected, message) => {
      if (!Object.is(actual, expected)) throw new Error(message ?? "not equal");
    },
    ok: (value, message) => {
      if (!value) throw new Error(message ?? "not ok");
    },
    throws: (run, _expected, message) => {
      let threw = false;
      try {
        run();
      } catch {
        threw = true;
      }
      if (!threw) throw new Error(message ?? "did not throw");
    },
  };

  runReactivityContractTests(test, assert, "probe", () => {
    const reactivity = make();
    const scope = reactivity.createScope?.({ debugName: "probe" });
    return {
      reactivity:
        scope === undefined
          ? reactivity
          : { ...reactivity, effect: (fn, options) => reactivity.effect(fn, { ...options, scope: options?.scope ?? scope }) },
      flushIfSupported: async () => {
        await reactivity.flush?.();
      },
      destroy: () => scope?.destroy?.(),
    };
  });

  return { checks: results.length, failed: results.filter((entry) => !entry.ok).length };
}

/** An effect that runs the first time and never again — the shape a stale build produces. */
const runsOnce = () => {
  const base = vanillaReactivity();
  return {
    ...base,
    effect: (fn, options) => {
      let ran = false;
      return base.effect((onCleanup) => {
        if (ran) return undefined;
        ran = true;
        return fn(onCleanup);
      }, options);
    },
  };
};

const memoryStorage = () => {
  const written = new Map();
  return { written, read: (key) => written.get(key) ?? null, write: (key, value) => written.set(key, value), remove: (key) => written.delete(key) };
};

const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

battle(
  {
    claims: ["REA-001", "REA-002"],
    title: "the conformance kit refuses the reactivities it is there to refuse",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a real one passes, so a failure below is the broken adapter rather than the kit.
    const real = conformanceOf(() => vanillaReactivity());
    ctx.log.note("the kit against a real reactivity", real);
    expectEqual([real.failed, real.checks > 0], [0, true], {
      claimIds: ["REA-001"],
      what: "the conformance kit fails a conforming reactivity, so nothing below can be read",
      detail: JSON.stringify(real),
    });

    const broken = {
      "a signal that never notifies": () => {
        const base = vanillaReactivity();
        return {
          ...base,
          signal: (initial) => {
            let held = initial;
            const read = () => held;
            read.set = (next) => {
              held = next;
            };
            read.update = (fn) => {
              held = fn(held);
            };
            return read;
          },
        };
      },
      "a computed that never recomputes": () => {
        const base = vanillaReactivity();
        return { ...base, computed: (fn) => { const once = fn(); return () => once; } };
      },
      "a scope whose destroy does nothing": () => {
        const base = vanillaReactivity();
        return { ...base, createScope: (options) => ({ ...base.createScope(options), destroy: () => {} }) };
      },
      "an untracked that tracks anyway": () => {
        const base = vanillaReactivity();
        return { ...base, untracked: (fn) => fn() };
      },
      "an effect that runs once": runsOnce,
    };

    const passed = [];
    for (const [what, make] of Object.entries(broken)) {
      const outcome = conformanceOf(make);
      ctx.log.note("the kit against a broken reactivity", { what, ...outcome });
      if (outcome.failed === 0) passed.push({ what, ...outcome });
    }

    expectEqual(passed, [], {
      claimIds: ["REA-001", "REA-002"],
      what: "the conformance kit declared a reactivity conformant that is broken in a way an adapter has actually shipped",
      detail: JSON.stringify(passed),
    });
  },
);

battle(
  {
    claims: ["REA-001", "PER-001"],
    title: "an adapter whose effects run once loses every draft, silently",
    environments: ["node"],
  },
  async (ctx) => {
    // What conformance letting it through costs. The form still validates, because validity flows
    // through computeds — so nothing about the form looks wrong.
    const outcomes = [];
    for (const [what, make] of [["a real reactivity", vanillaReactivity], ["an effect that runs once", runsOnce]]) {
      const storage = memoryStorage();
      const form = createForm({ name: field("") }, { devWarnings: false, reactivity: make(), draft: { key: "k", storage } });
      form.f.name.set("Ada");
      await settled(700);
      outcomes.push({ what, saved: storage.written.has("k"), value: form.getValue().name, valid: form.state.valid() });
      form.destroy();
    }
    ctx.log.note("what each adapter wrote", { outcomes });

    // The control: the real one does save, so a missing draft below is the adapter.
    expectClaim(outcomes[0].saved, {
      claimIds: ["PER-001"],
      what: "a real reactivity did not write a draft either, so this measures the storage rather than the adapter",
    });

    // And the form looks fine either way, which is what makes the loss silent.
    expectEqual(outcomes.map((entry) => entry.value), ["Ada", "Ada"], {
      claimIds: ["REA-001"],
      what: "the form on the broken adapter did not even hold the value, which would at least be visible",
    });

    expectClaim(outcomes[1].saved, {
      claimIds: ["REA-001", "PER-001"],
      what: "an adapter the conformance kit passes writes no draft at all, and nothing throws or warns",
      detail: JSON.stringify(outcomes),
    });
  },
);
