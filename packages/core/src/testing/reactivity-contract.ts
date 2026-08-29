/**
 * Shared MdyReactivity conformance suite.
 *
 * Framework-free and test-runner-agnostic on purpose: it takes `test`/`assert`
 * as parameters (same shape as `@modyra/widgets/testing`'s
 * `runCommandExecutionTests`) instead of importing `node:test`/`node:assert`
 * directly — this file lives under `src/` and is `tsc`-compiled, and this
 * repo's core package has no `@types/node`, so importing Node's test runner
 * types here would fail to compile. Every adapter package (core itself,
 * Vue, Solid, Preact, Svelte, React and the rest) supplies its own real
 * `node:test`/`node:assert` (or Jest equivalents) from its own `.mjs`/`.spec.ts`.
 */

import type {
  MdyBatchingCapability,
  MdyFlushCapability,
  MdyObserveCapability,
  MdyReactivity,
} from "../reactivity.js";
import { reactivityRunsEffects } from "../reactivity.js";

function asBatching(rx: MdyReactivity): MdyBatchingCapability | undefined {
  return rx.capabilities?.batching === true &&
    typeof (rx as Partial<MdyBatchingCapability>).batch === "function"
    ? (rx as MdyReactivity & MdyBatchingCapability)
    : undefined;
}

function asFlush(rx: MdyReactivity): MdyFlushCapability | undefined {
  return rx.capabilities?.deterministicFlush === true &&
    typeof (rx as Partial<MdyFlushCapability>).flush === "function"
    ? (rx as MdyReactivity & MdyFlushCapability)
    : undefined;
}

function asObserve(rx: MdyReactivity): MdyObserveCapability | undefined {
  return rx.capabilities?.directObservation === true &&
    typeof (rx as Partial<MdyObserveCapability>).observe === "function"
    ? (rx as MdyReactivity & MdyObserveCapability)
    : undefined;
}

/** One harness instance per test. */
export interface MdyReactivityTestHarness {
  readonly reactivity: MdyReactivity;
  /** Resolves once any pending effects have settled (a no-op if effects are synchronous). */
  flushIfSupported(): Promise<void>;
  /** Releases whatever resources creating this harness allocated (a no-op for most adapters). */
  destroy(): void;
}

interface AssertLike {
  equal(actual: unknown, expected: unknown, message?: string): void;
  ok(value: unknown, message?: string): void;
  throws(fn: () => void, error?: unknown, message?: string): void;
}

type TestFn = (name: string, fn: () => void | Promise<void>) => void;

/**
 * Registers the shared conformance suite against one adapter. Call once per
 * adapter with real `test`/`assert` from your own test file:
 *
 * ```ts
 * import { test } from "node:test";
 * import assert from "node:assert/strict";
 * import { runReactivityContractTests } from "@modyra/core/testing";
 * import { vanillaReactivity } from "@modyra/core";
 *
 * runReactivityContractTests(test, assert, "vanilla", () => ({
 *   reactivity: vanillaReactivity(),
 *   flushIfSupported: () => Promise.resolve(),
 *   destroy: () => {},
 * }));
 * ```
 */
export function runReactivityContractTests(
  test: TestFn,
  assert: AssertLike,
  name: string,
  createHarness: () => MdyReactivityTestHarness,
): void {
  test(`${name}: signal read, set, update and asReadonly`, () => {
    const { reactivity: rx, destroy } = createHarness();
    const s = rx.signal("a");
    assert.equal(s(), "a");

    s.set("b");
    assert.equal(s(), "b");

    s.update((v) => v + "c");
    assert.equal(s(), "bc");

    const ro = s.asReadonly();
    assert.equal(ro(), "bc");
    assert.equal(typeof (ro as { set?: unknown }).set, "undefined");
    assert.equal(typeof (ro as { update?: unknown }).update, "undefined");
    destroy();
  });

  test(`${name}: computed caches and invalidates`, () => {
    const { reactivity: rx, destroy } = createHarness();
    const s = rx.signal(1);
    let computations = 0;
    const c = rx.computed(() => {
      computations++;
      return s() * 2;
    });

    assert.equal(c(), 2);
    assert.equal(c(), 2);
    assert.equal(computations, 1, "computed should cache the result");

    s.set(2);
    assert.equal(c(), 4);
    assert.equal(computations, 2, "computed should re-run after dependency change");
    destroy();
  });

  test(`${name}: untracked read does not create a dependency`, () => {
    const { reactivity: rx, destroy } = createHarness();
    const tracked = rx.signal(1);
    const untrackedDep = rx.signal(10);
    let computations = 0;

    const c = rx.computed(() => {
      computations++;
      return tracked() + rx.untracked(() => untrackedDep());
    });

    assert.equal(c(), 11);
    assert.equal(computations, 1);

    untrackedDep.set(20);
    assert.equal(c(), 11);
    assert.equal(
      computations,
      1,
      "computed should not re-run when only untracked dependencies change",
    );

    tracked.set(2);
    assert.equal(c(), 22);
    assert.equal(computations, 2);
    destroy();
  });

  test(`${name}: effect runs, reruns, cleans up and can be destroyed`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();

    if (!reactivityRunsEffects(rx)) {
      let ran = false;
      const ref = rx.effect(() => {
        ran = true;
      });
      await flushIfSupported();
      assert.equal(ran, false, "effect should not run when capabilities.effects is false");
      assert.equal(typeof ref.destroy, "function");
      ref.destroy();
      destroy();
      return;
    }

    const s = rx.signal(0);
    let runs = 0;
    let cleanups = 0;

    const ref = rx.effect((onCleanup) => {
      runs++;
      s();
      onCleanup(() => cleanups++);
    });

    await flushIfSupported();
    assert.equal(runs, 1, "effect should run once initially");
    assert.equal(cleanups, 0, "no cleanup after initial run");

    s.set(1);
    await flushIfSupported();
    assert.equal(runs, 2, "effect should re-run when dependency changes");
    assert.equal(cleanups, 1, "cleanup from previous run should fire before rerun");

    ref.destroy();
    assert.equal(cleanups, 2, "cleanup from final run should fire on destroy");

    s.set(2);
    await flushIfSupported();
    assert.equal(runs, 2, "effect should not run after destroy");
    destroy();
  });

  // ─── Optional, capability-gated checks ─────────────────────────────────────
  // Adapters that haven't migrated to the extended contract yet have no
  // `capabilities`/`createScope`, and these are skipped for them rather than
  // failed — additive, not a regression gate, until each adapter's own
  // migration milestone (see STATUS.md's REACT-M1..M8 log).

  test(`${name}: capabilities never claim a fictitious guarantee`, () => {
    const { reactivity: rx, destroy } = createHarness();
    if (rx.capabilities) {
      for (const [key, value] of Object.entries(rx.capabilities)) {
        assert.equal(typeof value, "boolean", `capabilities.${key} must be a boolean`);
      }
    }
    destroy();
  });

  test(`${name}: a computed refuses a write to a signal (if capable)`, () => {
    const { reactivity: rx, destroy } = createHarness();
    // A computed is a function of its inputs under every reactivity — whether it runs at all
    // depends on who reads it. What differs is whether a graph can see the breach, which is what
    // the capability states; a graph that answers `false` is not being given permission, it is
    // saying it will not notice. See ADR 0032.
    if (rx.capabilities?.pureComputeds !== true) {
      destroy();
      return;
    }
    const source = rx.signal(1);
    const target = rx.signal(0);
    const derived = rx.computed(() => {
      target.set(source());
      return source();
    });
    assert.throws(() => derived(), "a write inside a computed was allowed by a graph that claims to refuse it");

    // And the two places a write is ordinary must keep working, or the rule would cost more than it
    // protects: after reading a computed, and inside an effect.
    const pure = rx.computed(() => source() * 2);
    assert.equal(pure(), 2);
    target.set(pure());
    assert.equal(target(), 2);
    destroy();
  });

  test(`${name}: scope destroy is idempotent and cascades to children`, () => {
    const { reactivity: rx, destroy } = createHarness();
    if (!rx.createScope) {
      destroy();
      return;
    }

    const root = rx.createScope({ debugName: "root" });
    const child = rx.createScope({ debugName: "child", parent: root });

    let rootCleaned = 0;
    let childCleaned = 0;
    root.onCleanup(() => rootCleaned++);
    child.onCleanup(() => childCleaned++);

    assert.equal(root.destroyed, false);
    assert.equal(child.destroyed, false);

    root.destroy();
    assert.equal(root.destroyed, true, "root should be destroyed");
    assert.equal(child.destroyed, true, "destroying a parent must destroy its children");
    assert.equal(rootCleaned, 1);
    assert.equal(childCleaned, 1);

    root.destroy();
    assert.equal(rootCleaned, 1, "destroy must be idempotent");
    destroy();
  });

  test(`${name}: change is decided the way the reference runtime decides it`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();
    if (rx.capabilities?.effects !== true) {
      destroy();
      return;
    }

    /** Whether writing `to` over `from` makes a watcher run again. */
    const notifies = async (from: unknown, to: unknown): Promise<boolean> => {
      const signal = rx.signal(from);
      let runs = 0;
      rx.effect(() => { signal(); runs += 1; });
      await flushIfSupported();
      const before = runs;
      signal.set(to);
      await flushIfSupported();
      return runs > before;
    };

    // A runtime that declares no comparator still decides what "changed" means, and the two
    // plausible answers differ on exactly two values. `===` says `0` and `-0` are the same value and
    // `NaN` is a different one from itself, so a field holding `0` written `-0` re-renders nothing
    // and a field holding `NaN` re-renders forever. `Object.is` — what this contract's own reference
    // runtime uses, and what every adapter in this repository was measured to use — answers both the
    // other way. Left undeclared, an adapter could ship either and pass every other case here.
    assert.equal(await notifies(0, -0), true, "writing -0 over 0 is a change: default equality must be Object.is, not ===");
    assert.equal(await notifies(NaN, NaN), false, "writing NaN over NaN is not a change: default equality must be Object.is, not ===");
    destroy();
  });

  test(`${name}: a declared signalEquality is actually honoured`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();
    if (rx.capabilities?.signalEquality !== true || rx.capabilities?.effects !== true) {
      destroy();
      return;
    }

    // Declaring the capability is the easy half. An adapter that accepts `equal` and drops it on the
    // floor passes every other check here — the shape is right, the types are right, and the option
    // is simply ignored. That is the "accepted but unhonoured option" this contract exists to make
    // impossible to ship quietly.
    const s = rx.signal("a", { equal: () => true });
    let runs = 0;
    rx.effect(() => { s(); runs++; });
    await flushIfSupported();
    const before = runs;

    s.set("completely different");
    await flushIfSupported();

    assert.equal(s(), "a", "a comparator calling every value equal must suppress the write");
    assert.equal(runs, before, "and must not notify anything that was watching");
    destroy();
  });

  test(`${name}: a declared computedEquality is actually honoured`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();
    if (rx.capabilities?.computedEquality !== true || rx.capabilities?.effects !== true) {
      destroy();
      return;
    }

    const source = rx.signal(1);
    const c = rx.computed(() => source(), { equal: () => true });
    let runs = 0;
    rx.effect(() => { c(); runs++; });
    await flushIfSupported();
    const before = runs;

    source.set(2);
    await flushIfSupported();

    assert.equal(runs, before, "a computed whose comparator calls every value equal must not notify");
    destroy();
  });

  test(`${name}: a destroyed scope stops the effects it owns`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();
    if (!rx.createScope || rx.capabilities?.effects !== true) {
      destroy();
      return;
    }

    // The ownership guarantee itself, which the cleanup and cascade checks above do not reach: they
    // prove a scope tells its listeners it died, not that anything created inside it stopped. An
    // adapter whose `run()` does not actually own what it wraps passes both of them, and leaks
    // every effect a form ever made.
    const scope = rx.createScope({ debugName: "ownership" });
    const source = rx.signal(0);
    let runs = 0;
    // `options.scope` is the ownership channel; `scope.run()` only enters the reactive context and
    // does not transfer ownership on every adapter.
    rx.effect(() => { source(); runs++; }, { scope });
    await flushIfSupported();
    const before = runs;
    assert.ok(before > 0, "the effect should have run at least once while its scope was alive");

    scope.destroy();
    source.set(1);
    await flushIfSupported();

    assert.equal(runs, before, "an effect created inside a destroyed scope must not run again");
    destroy();
  });

  test(`${name}: registering on a destroyed scope throws a typed error`, () => {
    const { reactivity: rx, destroy } = createHarness();
    if (!rx.createScope) {
      destroy();
      return;
    }

    const scope = rx.createScope();
    scope.destroy();

    assert.throws(() => scope.onCleanup(() => undefined), /MdyDestroyedScopeError|destroyed/i);
    destroy();
  });

  test(`${name}: batch() coalesces effect runs (if capable)`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();
    const batching = asBatching(rx);
    if (!batching) {
      destroy();
      return;
    }
    const s1 = rx.signal(0);
    const s2 = rx.signal(0);
    let runs = 0;
    const ref = rx.effect(() => {
      runs++;
      s1();
      s2();
    });
    await flushIfSupported();
    assert.equal(runs, 1);

    batching.batch(() => {
      s1.set(1);
      s2.set(2);
    });
    assert.equal(runs, 2, "one batch() of two writes must produce exactly one extra run");
    ref.destroy();
    destroy();
  });

  test(`${name}: flush() settles pending effects deterministically (if capable)`, () => {
    const { reactivity: rx, destroy } = createHarness();
    const flushable = asFlush(rx);
    if (!flushable) {
      destroy();
      return;
    }
    const s = rx.signal(0);
    let runs = 0;
    const ref = rx.effect(() => {
      runs++;
      s();
    });
    assert.equal(runs, 1);
    s.set(1);
    return Promise.resolve(flushable.flush()).then(() => {
      assert.equal(runs, 2, "flush() must have run the pending effect by the time it resolves");
      ref.destroy();
      destroy();
    });
  });

  test(`${name}: observe() only fires on an actual change, never on the initial run (if capable)`, async () => {
    const { reactivity: rx, flushIfSupported, destroy } = createHarness();
    const observable = asObserve(rx);
    if (!observable) {
      destroy();
      return;
    }
    const s = rx.signal(1);
    const seen: Array<[number, number]> = [];
    const ref = observable.observe(
      () => s(),
      (value, previous) => seen.push([value, previous]),
    );
    await flushIfSupported();
    assert.equal(seen.length, 0, "observe() must not fire on its initial run");

    s.set(2);
    await flushIfSupported();
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.[0], 2);
    assert.equal(seen[0]?.[1], 1);

    ref.destroy();
    s.set(3);
    await flushIfSupported();
    assert.equal(seen.length, 1, "observe() must not fire after destroy");
    destroy();
  });
}
