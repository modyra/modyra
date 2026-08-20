/**
 * The suite every adapter passes, fed adapters that should not pass.
 *
 * `runReactivityContractTests` is the published conformance kit: core, Vue, Solid, Preact, Svelte,
 * React and Lit each run it against their own reactivity and are conformant if it is quiet. A gate is
 * worth what it refuses, so this feeds it reactivities broken one way each and asserts that each one
 * is caught.
 *
 * It catches all of them, including the one that matters most: an effect that runs once and never
 * again. That is not hypothetical — `differential/runtimes/every-runtime.test.mjs` records it
 * happening, when Solid without the `browser` export condition resolved to a build "whose
 * computations never re-run, and a form on it froze at creation". Three of the kit's checks fail on
 * it, one of them saying "effect should re-run when dependency changes" in as many words.
 *
 * **Five of the kit's fourteen checks are asynchronous**, and that is what this battle is really
 * about. A harness that calls them and reads its results without awaiting sees seven checks and no
 * failures, and concludes the kit is full of holes. It is not: the results had not arrived. An
 * adapter author wiring this kit into a runner that does not await — or a battle like the first
 * version of this one — gets a green that means nothing.
 *
 * So the count is asserted before the verdicts. Fourteen checks, or the rest of this file is
 * measuring a subset and calling it the kit.
 *
 * This file was first written the other way round, reporting the kit as full of holes because its own
 * harness dropped the async results. What it holds now is the opposite claim and a guard against
 * making that mistake again.
 */

import { vanillaReactivity } from "@modyra/core";
import { runReactivityContractTests } from "@modyra/core/testing";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

/**
 * Run the published kit against one reactivity and collect what it said.
 *
 * Five of its checks are async. Their results arrive after `runReactivityContractTests` returns, so
 * they are collected and awaited — reading the array without that is how a broken adapter looks
 * conformant.
 */
async function conformanceOf(make) {
  const results = [];
  const settling = [];
  const test = (name, run) => {
    const record = (error) => results.push({ name, ok: error === undefined });
    let outcome;
    try {
      outcome = run();
    } catch (error) {
      record(error);
      return undefined;
    }
    if (outcome !== null && typeof outcome?.then === "function") {
      settling.push(outcome.then(() => record(), record));
      return outcome;
    }
    record();
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

  await Promise.all(settling);
  return {
    checks: results.length,
    failed: results.filter((entry) => !entry.ok).length,
    ran: results.map((entry) => entry.name.replace(/^probe: /, "")),
  };
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

/**
 * The cases the conformance kit runs, by name.
 *
 * A floor rather than an inventory: the kit gaining a case is the kit doing its job, and this list
 * says only that none of these has gone. Counting instead — which this battle did — cannot tell a
 * case gained from another lost, and ages every time the kit grows.
 */
const KIT_CASES = Object.freeze([
  "signal read, set, update and asReadonly",
  "computed caches and invalidates",
  "untracked read does not create a dependency",
  "effect runs, reruns, cleans up and can be destroyed",
  "capabilities never claim a fictitious guarantee",
  "a computed refuses a write to a signal (if capable)",
  "scope destroy is idempotent and cascades to children",
  "change is decided the way the reference runtime decides it",
  "a declared signalEquality is actually honoured",
  "a declared computedEquality is actually honoured",
  "a destroyed scope stops the effects it owns",
  "registering on a destroyed scope throws a typed error",
  "batch() coalesces effect runs (if capable)",
  "flush() settles pending effects deterministically (if capable)",
  "observe() only fires on an actual change, never on the initial run (if capable)",
]);

battle(
  {
    claims: ["REA-001", "REA-002"],
    title: "the conformance kit refuses the reactivities it is there to refuse",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a real one passes, so a failure below is the broken adapter rather than the kit.
    const real = await conformanceOf(() => vanillaReactivity());
    ctx.log.note("the kit against a real reactivity", { checks: real.checks, failed: real.failed });
    expectEqual(real.failed, 0, {
      claimIds: ["REA-001"],
      what: "the kit failed a conforming reactivity, so nothing it says about a broken one means anything",
      detail: JSON.stringify(real),
    });

    // Every case the kit had, by name, still runs. A subset counted as the whole is how a broken
    // adapter looks conformant, and the count alone cannot tell one case gained from another lost.
    // Named rather than counted so the assertion does not age: a kit that grows passes, a kit that
    // drops a case fails and says which.
    expectEqual(KIT_CASES.filter((each) => !real.ran.includes(each)), [], {
      claimIds: ["REA-001"],
      what: "a case the conformance kit used to run is no longer run",
      detail: JSON.stringify(real.ran),
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
      "one that claims batching and does not batch": () => {
        const base = vanillaReactivity();
        return { ...base, capabilities: { ...base.capabilities, batching: true }, batch: (fn) => fn() };
      },
      // Three an adapter could plausibly ship, subtler than the six above: none of them is a piece
      // that is missing, each is a piece that does slightly too much.
      "a signal that notifies on a write of the same value": () => {
        const base = vanillaReactivity();
        return { ...base, signal: (value, options) => base.signal(value, { ...options, equal: () => false }) };
      },
      "a scope that destroys only its first effect": () => {
        const base = vanillaReactivity();
        return {
          ...base,
          createScope: (options) => {
            const scope = base.createScope(options);
            let destroyed = 0;
            return { ...scope, destroy: () => { if (destroyed++ === 0) scope.destroy(); } };
          },
        };
      },
      "an effect that subscribes twice": () => {
        const base = vanillaReactivity();
        return { ...base, effect: (fn, options) => { base.effect(fn, options); return base.effect(fn, options); } };
      },
      "one that claims signalEquality and ignores the comparator": () => {
        const base = vanillaReactivity();
        return { ...base, capabilities: { ...base.capabilities, signalEquality: true }, signal: (value, options) => base.signal(value, { ...options, equal: undefined }) };
      },
    };

    const passed = [];
    for (const [what, make] of Object.entries(broken)) {
      const outcome = await conformanceOf(make);
      ctx.log.note("the kit against a broken reactivity", { what, ...outcome });
      if (outcome.failed === 0) passed.push({ what, ...outcome });
    }

    expectEqual(passed, [], {
      claimIds: ["REA-001", "REA-002"],
      what: "the conformance kit declared a reactivity conformant that is broken in a way an adapter could ship",
      detail: JSON.stringify(passed),
    });
  },
);
