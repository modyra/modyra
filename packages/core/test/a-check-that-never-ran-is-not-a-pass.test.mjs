/**
 * A conformance check that returns early is not a check that passed.
 *
 * The reactivity suite registers a fixed set of checks and skips the ones an adapter's capabilities
 * make unperformable. Skipping is correct — a runtime that does not batch cannot be asked to prove
 * it batches — but a skipped check reports as a green test, so a suite of fifteen passes where one
 * never performed its act says nothing about the difference.
 *
 * `reactivityContractLedger` is what closes that: it names every check registered and every one
 * that could not be performed, with the declaration that bought it out.
 *
 * The adapters below are built for this file. Measuring the real one would tie the assertions to
 * whatever vanilla happens to declare today, which is a fact about vanilla and not about the ledger.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reactivityContractLedger,
  resetReactivityContractLedger,
  runReactivityContractTests,
} from "../dist/testing/index.js";
import { vanillaReactivity } from "../dist/index.js";

/** Run the suite for real against an adapter whose capabilities are ours to choose. */
function ledgerFor(capabilities) {
  resetReactivityContractLedger();
  const bodies = [];
  runReactivityContractTests(
    (_name, fn) => bodies.push(fn),
    assert,
    "probe",
    () => {
      const reactivity = vanillaReactivity();
      const scope = reactivity.createScope({ debugName: "probe" });
      return {
        reactivity: {
          ...reactivity,
          capabilities,
          effect: (fn, options) => reactivity.effect(fn, { ...options, scope: options?.scope ?? scope }),
        },
        flushIfSupported: () => Promise.resolve(),
        destroy: () => scope.destroy(),
      };
    },
  );
  // The skips are recorded where they happen, so the bodies have to run: a ledger read without
  // running them reports every check as performed, which is the very claim it exists to refute.
  return { bodies, read: () => reactivityContractLedger() };
}

/**
 * Vanilla's own answers, as the base every probe below varies from.
 *
 * Invented capabilities are not an option: the suite checks that a declaration is honoured, so an
 * adapter claiming `effects: true` over a runtime that does not run them fails rather than skips —
 * which is the suite working, and makes a fabricated adapter useless for measuring skips.
 */
const HONEST = vanillaReactivity().capabilities;

test("a check is registered whether or not it can be performed", () => {
  const { read } = ledgerFor(HONEST);
  assert.ok(read().registered.length >= 10, "the suite registered too few checks to be the real one");
});

test("what an adapter cannot answer is reported, with the reason", async () => {
  const { bodies, read } = ledgerFor(HONEST);
  for (const body of bodies) await body();

  const ledger = read();
  assert.ok(ledger.skipped.length > 0, "a capability answered false bought no check out");
  for (const skip of ledger.skipped) {
    assert.ok(skip.because.length > 0, `${skip.check} was skipped without saying why`);
    assert.ok(
      ledger.registered.includes(skip.check),
      `${skip.check} was reported skipped but never registered`,
    );
  }
});

test("turning a capability off costs a check, and the ledger names which", async () => {
  const run = async (capabilities) => {
    const { bodies, read } = ledgerFor(capabilities);
    for (const body of bodies) await body();
    return read();
  };

  const whole = await run(HONEST);
  const without = await run({ ...HONEST, batching: false });

  assert.ok(
    without.skipped.length > whole.skipped.length,
    "declaring a capability false bought no check out, so the flag guards nothing",
  );
  assert.ok(
    without.skipped.some((skip) => skip.because.includes("batching")),
    "a check was skipped without naming the capability that caused it",
  );
});
