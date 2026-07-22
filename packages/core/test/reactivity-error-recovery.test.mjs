/**
 * Error recovery / corruption resistance for vanillaReactivity's effect
 * scheduler (piano-modyra-reactivity-adapter-api.md §18 checklist:
 * "Errori non corrompono l'adapter"). Found while auditing that checklist
 * item: the M3 shared-drain redesign (reactivity-batch-flush-observe
 * tests) never exercised what happens when an effect actually throws.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "../dist/index.js";

test("an effect that throws on its first run propagates the error but leaves the scheduler usable", async () => {
  const rx = vanillaReactivity();
  const s = rx.signal(0);

  assert.throws(() => {
    rx.effect(() => {
      s();
      throw new Error("boom-on-construct");
    });
  }, /boom-on-construct/);

  // The scheduler's activeConsumer/pendingEffects bookkeeping must be
  // clean afterwards — an unrelated effect must work normally.
  const s2 = rx.signal(1);
  let runs = 0;
  const ref = rx.effect(() => {
    runs++;
    s2();
  });
  await rx.flush();
  assert.equal(runs, 1);
  s2.set(2);
  await rx.flush();
  assert.equal(runs, 2);
  ref.destroy();
});

test("onError catches a thrown error and the effect keeps running on later changes", async () => {
  const rx = vanillaReactivity();
  const s = rx.signal(0);
  const caught = [];
  let runs = 0;
  const ref = rx.effect(
    () => {
      runs++;
      if (s() === 1) throw new Error("boom");
    },
    { onError: (error) => caught.push(error) },
  );
  await rx.flush();
  assert.equal(runs, 1);
  assert.equal(caught.length, 0);

  s.set(1);
  await rx.flush();
  assert.equal(runs, 2);
  assert.equal(caught.length, 1);
  assert.equal(caught[0].message, "boom");

  // Must keep running after a caught error, not go dead.
  s.set(2);
  await rx.flush();
  assert.equal(runs, 3);
  assert.equal(caught.length, 1);

  ref.destroy();
});

test("one effect's uncaught error does not starve sibling effects in the same drain pass", async () => {
  const rx = vanillaReactivity();
  const s = rx.signal(0);
  let bRuns = 0;
  const refA = rx.effect(() => {
    if (s() === 1) throw new Error("boom-from-A");
  });
  const refB = rx.effect(() => {
    bRuns++;
    s();
  });
  await rx.flush();
  assert.equal(bRuns, 1);

  const originalConsoleError = console.error;
  const reported = [];
  console.error = (...args) => reported.push(args);
  try {
    s.set(1); // schedules both A and B in the same pending-effects batch
    await rx.flush();
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(bRuns, 2, "B must still run even though A threw in the same drain pass");
  assert.equal(reported.length, 1, "A's error must still be reported (not silently swallowed)");
  assert.match(reported[0][0], /Uncaught error in effect/);
  assert.equal(reported[0][1].message, "boom-from-A");

  // The scheduler itself must still be healthy for further, unrelated work.
  let cRuns = 0;
  const refC = rx.effect(() => {
    cRuns++;
  });
  await rx.flush();
  assert.equal(cRuns, 1);

  refA.destroy();
  refB.destroy();
  refC.destroy();
});
