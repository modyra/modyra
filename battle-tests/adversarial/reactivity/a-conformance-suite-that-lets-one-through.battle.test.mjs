/**
 * The published conformance suite, asked whether it would catch a broken adapter.
 *
 * `runReactivityContractTests` is what an adapter runs to claim it implements `MdyReactivity`. It is
 * the gate: pass it and the framework treats your runtime as one a form can be built on. A gate is
 * only worth what it refuses, so the question is not whether the real adapters pass it — they do —
 * but whether a broken one would fail.
 *
 * Eleven deliberate defects were run against it, each a mistake an adapter could plausibly ship. Nine
 * are caught, several of them by more than one case:
 *
 *   a computed that never recomputes            caught
 *   a computed that recomputes on every read     caught
 *   an effect that never runs                    caught
 *   an effect that runs once and never again     caught
 *   asReadonly handing back the writable signal  caught
 *   update() ignoring its function               caught
 *   batch() dropping the work                    caught
 *   untracked() tracking anyway                  caught
 *   observe() firing on the initial run          caught
 *
 * One is not, and it is this battle: **an adapter whose default equality is `===` rather than
 * `Object.is`**. The suite has a case for a *declared* `signalEquality` — "a declared signalEquality
 * is actually honoured" — and none for the equality an adapter uses when it declares nothing.
 *
 * The divergence is real and measured against vanilla, which uses `Object.is`:
 *
 *              0 → -0        NaN → NaN
 *   vanilla    notifies      does not notify
 *   `===`      DOES NOT      does not notify
 *
 * A number field holding `0`, written `-0`, changes value and nothing re-renders. It is the same
 * family as the `equals` operator that answered three different things across the contract's four
 * spellings, and it is small in the same way that one was before it was measured.
 *
 * The battle runs the published suite against the broken runtime through a recording `test`/`assert`
 * pair, and requires the suite to refuse it. It does not say which case should catch it.
 */

import { vanillaReactivity } from "@modyra/core";
import { runReactivityContractTests } from "@modyra/core/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A runtime identical to vanilla except that it decides "changed" with `===`. */
function tripleEqualsRuntime() {
  const rx = vanillaReactivity();
  return {
    ...rx,
    signal: (initial, options) => {
      const signal = rx.signal(initial, options);
      const set = signal.set.bind(signal);
      signal.set = (next) => {
        if (next === signal()) return;
        set(next);
      };
      return signal;
    },
  };
}

/**
 * Runs the published suite against `reactivity` and reports which of its cases refused it.
 *
 * The suite takes `test` and `assert` from its caller, so a recording pair is all it needs — no
 * runner, and the battle keeps its own verdict.
 */
async function conformanceVerdict(reactivity) {
  const cases = [];
  const assert = {
    equal: (a, b, m) => {
      if (!Object.is(a, b)) throw new Error(m ?? `equal: ${String(a)} !== ${String(b)}`);
    },
    notEqual: (a, b, m) => {
      if (Object.is(a, b)) throw new Error(m ?? `notEqual: both ${String(a)}`);
    },
    ok: (v, m) => {
      if (!v) throw new Error(m ?? "ok: falsy");
    },
    deepEqual: (a, b, m) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m ?? "deepEqual");
    },
    throws: (fn, _e, m) => {
      try {
        fn();
      } catch {
        return;
      }
      throw new Error(m ?? "throws: it did not");
    },
  };
  const pending = [];
  const record = (name, fn) => {
    pending.push(
      (async () => {
        try {
          await fn();
          cases.push({ name, refused: false });
        } catch (error) {
          cases.push({ name, refused: true, why: String(error?.message ?? error).slice(0, 80) });
        }
      })(),
    );
  };
  runReactivityContractTests(record, assert, "under test", () => ({
    reactivity,
    flushIfSupported: () => Promise.resolve(),
    destroy: () => undefined,
  }));
  await Promise.all(pending);
  return cases;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/** Whether writing `to` over `from` makes an effect run again. */
async function notifies(reactivity, from, to) {
  const signal = reactivity.signal(from);
  let runs = 0;
  const effect = reactivity.effect(() => {
    signal();
    runs += 1;
  });
  try {
    await tick();
    const before = runs;
    signal.set(to);
    reactivity.flush?.();
    await tick();
    return runs > before;
  } finally {
    effect.destroy?.();
  }
}

battle(
  {
    claims: ["REA-001", "REA-003"],
    title: "the conformance suite refuses a runtime that decides change differently",
    environments: ["node"],
  },
  async (ctx) => {
    const broken = tripleEqualsRuntime();

    // The divergence, first: without it there would be nothing for the suite to have missed.
    const divergence = {
      vanillaOnSignedZero: await notifies(vanillaReactivity(), 0, -0),
      brokenOnSignedZero: await notifies(broken, 0, -0),
      vanillaOnAnOrdinaryChange: await notifies(vanillaReactivity(), 1, 2),
      brokenOnAnOrdinaryChange: await notifies(broken, 1, 2),
    };
    ctx.log.note("where the broken runtime differs from vanilla", divergence);

    expectClaim(
      divergence.vanillaOnAnOrdinaryChange && divergence.brokenOnAnOrdinaryChange,
      {
        claimIds: ["REA-001"],
        what: "neither runtime notifies an ordinary change, so the probe is wrong before the suite is",
        detail: JSON.stringify(divergence),
      },
    );

    expectClaim(divergence.vanillaOnSignedZero && !divergence.brokenOnSignedZero, {
      claimIds: ["REA-001"],
      what: "the broken runtime does not actually behave differently, so there is nothing the suite failed to catch",
      detail: JSON.stringify(divergence),
    });

    // The suite must refuse the runtime this repository's own reference implementation disagrees with.
    const verdict = await conformanceVerdict(broken);
    const refused = verdict.filter((each) => each.refused);
    ctx.log.note("what the published conformance suite said", {
      cases: verdict.length,
      refused: refused.map((each) => each.name),
    });

    // The control: the suite has to accept the reference runtime, or "it refuses nothing" would be a
    // statement about a suite that refuses everything.
    const onVanilla = await conformanceVerdict(vanillaReactivity());
    expectEqual(onVanilla.filter((each) => each.refused).map((each) => each.name), [], {
      claimIds: ["REA-003"],
      what: "the conformance suite refuses the reference runtime, so the probe is wrong before the suite is",
    });

    expectClaim(refused.length > 0, {
      claimIds: ["REA-001", "REA-003"],
      what: "the conformance suite accepted a runtime that decides `changed` differently from the reference, so an adapter can pass the gate and still leave a control unrendered",
      detail: JSON.stringify({ cases: verdict.length, divergence }),
    });
  },
);
