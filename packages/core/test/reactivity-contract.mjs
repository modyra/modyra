/**
 * Shared MdyReactivity contract suite.
 *
 * Each adapter imports `runReactivityContract` and calls it with a factory
 * that returns its own `MdyReactivity` implementation. This keeps the spec
 * in one place and guarantees all adapters satisfy the same framework-agnostic
 * contract the engine is written against.
 *
 * @param {string} name
 * @param {() => import('../dist/index.js').MdyReactivity} factory
 * @param {{ flush?: () => Promise<void> }} [options]
 */

import assert from "node:assert/strict";
import { test } from "node:test";

export function runReactivityContract(name, factory, options = {}) {
  const { flush = () => Promise.resolve() } = options;

  test(`${name}: signal read, set, update and asReadonly`, () => {
    const rx = factory();
    const s = rx.signal("a");
    assert.equal(s(), "a");

    s.set("b");
    assert.equal(s(), "b");

    s.update((v) => v + "c");
    assert.equal(s(), "bc");

    const ro = s.asReadonly();
    assert.equal(ro(), "bc");
    assert.equal(typeof ro.set, "undefined");
    assert.equal(typeof ro.update, "undefined");
  });

  test(`${name}: computed caches and invalidates`, () => {
    const rx = factory();
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
  });

  test(`${name}: untracked read does not create a dependency`, () => {
    const rx = factory();
    const tracked = rx.signal(1);
    const untrackedDep = rx.signal(10);
    let computations = 0;

    const c = rx.computed(() => {
      computations++;
      return tracked() + rx.untracked(() => untrackedDep());
    });

    assert.equal(c(), 11);
    assert.equal(computations, 1);

    // Changing only the untracked dependency must not invalidate the computed.
    untrackedDep.set(20);
    assert.equal(c(), 11);
    assert.equal(
      computations,
      1,
      "computed should not re-run when only untracked dependencies change",
    );

    // Changing a tracked dependency should re-run it; the untracked read
    // reflects the current value but does not create a dependency.
    tracked.set(2);
    assert.equal(c(), 22);
    assert.equal(computations, 2);
  });

  test(`${name}: effect runs, reruns, cleans up and can be destroyed`, async () => {
    const rx = factory();

    if (!rx.canEffect) {
      let ran = false;
      const ref = rx.effect(() => {
        ran = true;
      });
      await flush();
      assert.equal(ran, false, "effect should not run when canEffect is false");
      assert.equal(typeof ref.destroy, "function");
      ref.destroy();
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

    await flush();
    assert.equal(runs, 1, "effect should run once initially");
    assert.equal(cleanups, 0, "no cleanup after initial run");

    s.set(1);
    await flush();
    assert.equal(runs, 2, "effect should re-run when dependency changes");
    assert.equal(cleanups, 1, "cleanup from previous run should fire before rerun");

    ref.destroy();
    assert.equal(cleanups, 2, "cleanup from final run should fire on destroy");

    s.set(2);
    await flush();
    assert.equal(runs, 2, "effect should not run after destroy");
  });

  // ─── Optional, capability-gated checks (piano-modyra-reactivity-adapter-api) ──
  // Adapters not yet migrated to the extended contract simply have no
  // `capabilities`/`createScope` and these tests are skipped for them —
  // additive, not a regression gate, until each adapter's own milestone.

  test(`${name}: capabilities never claim a fictitious guarantee`, () => {
    const rx = factory();
    if (!rx.capabilities) return;
    for (const [key, value] of Object.entries(rx.capabilities)) {
      assert.equal(typeof value, "boolean", `capabilities.${key} must be a boolean`);
    }
    assert.equal(
      rx.capabilities.effects,
      rx.canEffect,
      "capabilities.effects must agree with the deprecated canEffect alias",
    );
  });

  test(`${name}: scope destroy is idempotent and cascades to children`, () => {
    const rx = factory();
    if (!rx.createScope) return;

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

    // Idempotent: a second destroy() must not re-run cleanups.
    root.destroy();
    assert.equal(rootCleaned, 1, "destroy must be idempotent");
  });

  test(`${name}: registering on a destroyed scope throws a typed error`, () => {
    const rx = factory();
    if (!rx.createScope) return;

    const scope = rx.createScope();
    scope.destroy();

    assert.throws(() => scope.onCleanup(() => {}), /MdyDestroyedScopeError|destroyed/i);
  });
}
