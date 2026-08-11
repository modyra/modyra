/**
 * The preview's stand-in server. Its job is to behave the way a real one does, cancellation
 * included: `ctx.signal` is the contract a validator is handed, and a mock that ignores it teaches
 * the preview something the runtime does not do.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockAsyncValidator, createMockSubmitAction } from "../dist/index.js";

const aborted = () => {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
};

test("a run whose signal is already aborted stops at once, without waiting out the delay", async () => {
  // The delay is what makes this observable: waiting it out and then *succeeding* returned a verdict
  // for a value nobody was asking about any more.
  const validate = createMockAsyncValidator({ delayMs: 400 });
  const started = Date.now();

  await assert.rejects(
    () => validate("x", { signal: aborted() }),
    (error) => error.name === "AbortError",
  );
  assert.ok(Date.now() - started < 100, `waited ${Date.now() - started}ms for an already-aborted run`);
});

test("a run aborted halfway still rejects", async () => {
  const validate = createMockAsyncValidator({ delayMs: 400 });
  const controller = new AbortController();
  const pending = validate("x", { signal: controller.signal });
  setTimeout(() => controller.abort(), 20);

  await assert.rejects(pending, (error) => error.name === "AbortError");
});

test("a run nobody interrupts still answers", async () => {
  // The guard must not turn every validation into a failure — the case that a too-eager check breaks.
  const validate = createMockAsyncValidator({ delayMs: 10, validValues: ["ok"] });
  assert.deepEqual(await validate("ok", { signal: new AbortController().signal }), []);
  assert.deepEqual(await validate("nope", { signal: new AbortController().signal }), [
    '"nope" is not a recognized value',
  ]);
  // A validator called without a signal at all is not an aborted one.
  assert.deepEqual(await validate("ok", {}), []);

  assert.deepEqual(await createMockSubmitAction({ delayMs: 10, forceError: "no" })(), [
    { path: null, kind: "server", message: "no" },
  ]);
});
