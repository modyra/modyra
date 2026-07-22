/**
 * Milestone 3 (piano-modyra-reactivity-adapter-api.md §6.1-§6.3): vanilla's
 * batch()/flush()/observe() are real, not fictitious — dedicated coverage
 * beyond the generic capability-gated checks in the shared conformance
 * suite (core/testing), including the transitive-chain and nesting cases
 * that suite doesn't exercise.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "../dist/index.js";

test("batch() returns the callback's value and runs effects once for multiple writes", () => {
  const rx = vanillaReactivity();
  const s1 = rx.signal(1);
  const s2 = rx.signal(2);
  let runs = 0;
  const ref = rx.effect(() => {
    runs++;
    s1();
    s2();
  });
  assert.equal(runs, 1);

  const result = rx.batch(() => {
    s1.set(10);
    s2.set(20);
    return "done";
  });

  assert.equal(result, "done", "batch() must return the callback's return value");
  assert.equal(runs, 2, "two writes inside one batch() must produce exactly one extra run");
  ref.destroy();
});

test("batch() is not required for correctness — plain writes still settle without it", async () => {
  const rx = vanillaReactivity();
  const s = rx.signal(1);
  let runs = 0;
  const ref = rx.effect(() => {
    runs++;
    s();
  });
  s.set(2);
  s.set(3);
  await Promise.resolve();
  assert.equal(runs, 2, "microtask-deferred effects already coalesce multiple sync writes");
  ref.destroy();
});

test("nested batch() calls only drain when the outermost one returns", () => {
  const rx = vanillaReactivity();
  const s = rx.signal(0);
  let runs = 0;
  const ref = rx.effect(() => {
    runs++;
    s();
  });
  assert.equal(runs, 1);

  rx.batch(() => {
    s.set(1);
    rx.batch(() => {
      s.set(2);
    });
    assert.equal(runs, 1, "still not drained inside the nested batch()");
  });
  assert.equal(runs, 2, "drains exactly once after the OUTER batch() returns");
  ref.destroy();
});

test("flush() settles a transitive chain (A's run writes B, which C depends on) in one call", async () => {
  const rx = vanillaReactivity();
  const a = rx.signal(0);
  const b = rx.signal(0);
  let bWrites = 0;
  let cRuns = 0;
  const refA = rx.effect(() => {
    const v = a();
    if (v > 0) {
      rx.untracked(() => {
        b.set(v * 10);
        bWrites++;
      });
    }
  });
  const refC = rx.effect(() => {
    cRuns++;
    b();
  });
  await Promise.resolve();
  assert.equal(cRuns, 1);

  a.set(1); // schedules A; A's own run (inside the flush below) writes b, which must also settle
  await rx.flush();
  assert.equal(bWrites, 1);
  assert.equal(cRuns, 2, "one flush() must settle the whole A -> b -> C chain, not just the first hop");

  refA.destroy();
  refC.destroy();
});

test("observe() respects a custom equal and does not fire on an untracked change", async () => {
  const rx = vanillaReactivity();
  const s = rx.signal({ n: 1 });
  const seen = [];
  const ref = rx.observe(() => s(), (v, prev) => seen.push([v.n, prev.n]), {
    equal: (a, b) => a.n === b.n,
  });
  await Promise.resolve();
  assert.equal(seen.length, 0);

  s.set({ n: 1 }); // equal per the custom fn — must not fire
  await Promise.resolve();
  assert.equal(seen.length, 0);

  s.set({ n: 2 });
  await Promise.resolve();
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], [2, 1]);

  ref.destroy();
});
