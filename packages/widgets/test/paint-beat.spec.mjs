/**
 * A renderer's beat, and what waiting on it means.
 *
 * Three suites each picked their own number for "wait until the DOM caught up", and a number that is
 * too small reads every state as its previous value — indistinguishable from a renderer that ignored
 * the change, and blamed on the renderer. These check that the derived wait matches what each beat
 * claims, and that a beat which needs the host's promise cannot be declared without supplying it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_PAINT_BEATS, settleFor } from "../dist/testing/index.js";

test("the beats are the four a renderer can have", () => {
  assert.deepEqual([...MDY_PAINT_BEATS], ["synchronous", "microtask", "task", "host"]);
});

test("a synchronous renderer is told, and nothing is pending after", async () => {
  const order = [];
  const settle = settleFor("synchronous", () => order.push("flushed"));
  setTimeout(() => order.push("task"), 0);
  await settle();
  assert.deepEqual(order, ["flushed"], "a synchronous beat must not wait for a task to turn");
});

test("a microtask beat waits for the microtask queue and no longer", async () => {
  const order = [];
  queueMicrotask(() => order.push("microtask"));
  setTimeout(() => order.push("task"), 0);
  await settleFor("microtask")();
  assert.deepEqual(order, ["microtask"]);
});

test("a task beat waits for the turn to end", async () => {
  const order = [];
  setTimeout(() => order.push("task"), 0);
  await settleFor("task")();
  assert.deepEqual(order, ["task"]);
});

test("a host beat waits for the host to say it is done", async () => {
  const order = [];
  let resolveHost;
  const hostFinished = new Promise((resolve) => { resolveHost = resolve; });
  setTimeout(() => { order.push("task"); }, 0);
  setTimeout(() => { order.push("host"); resolveHost(); }, 5);
  await settleFor("host", () => hostFinished)();
  assert.deepEqual(order, ["task", "host"]);
});

test("a host beat without the host's flush is refused, not treated as a task", () => {
  // A fixture that declares `host` and supplies nothing is claiming a guarantee it does not have.
  // Falling back to a task would make the claim true-looking and the wait wrong.
  assert.throws(() => settleFor("host"), /must supply the host's own flush/);
});
