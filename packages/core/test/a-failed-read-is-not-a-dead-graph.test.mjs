/**
 * A computed whose function throws stays dirty, and a dirty computed is not notified again. The
 * dependents it already has must still hear about later changes to its sources, or they are stuck
 * on the failure while the value underneath has recovered.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "../dist/index.js";

test("a dependent of a computed that threw hears about later source changes", async () => {
  const rx = vanillaReactivity();
  const s = rx.signal(0);
  const c = rx.computed(() => {
    if (s() === 1) throw new Error("err");
    return s();
  });
  const seen = [];
  rx.effect(() => {
    try {
      seen.push(c());
    } catch {
      seen.push("err");
    }
  });
  await rx.flush();
  s.set(1);
  await rx.flush();
  s.set(2);
  await rx.flush();
  s.set(3);
  await rx.flush();
  assert.deepEqual(seen, [0, "err", 2, 3]);
});
