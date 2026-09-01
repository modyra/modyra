/**
 * Core reactivity contract tests: the shared suite against the vanilla implementation used by Node
 * and CLI consumers, and by every adapter that re-tags it rather than bringing signals of its own.
 *
 * The harness is real rather than the old shim's: every effect the suite creates is owned by a scope
 * that is genuinely destroyed afterwards. Vanilla has no per-instance teardown, so `destroy` was a
 * no-op here for a reason — but the scope is not, and the suite now asks whether one owns what was
 * made inside it.
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { reactivityContractLedger, runReactivityContractTests } from "../dist/testing/index.js";
import { createForm, field, group, required, vanillaReactivity } from "../dist/index.js";
import { MdyComputedWriteError } from "../dist/reactivity-errors.js";

runReactivityContractTests(test, assert, "vanillaReactivity", () => {
  const reactivity = vanillaReactivity();
  const scope = reactivity.createScope({ debugName: "conformance" });
  return {
    reactivity: {
      ...reactivity,
      effect: (fn, options) => reactivity.effect(fn, { ...options, scope: options?.scope ?? scope }),
    },
    flushIfSupported: () => Promise.resolve(),
    destroy: () => scope.destroy(),
  };
});

/**
 * What this run could not check, said out loud.
 *
 * A capability answered `false` is usually the truth, and answering it honestly is the whole point
 * of the flags. What it also does is buy a conformance check out of running — and a check that
 * returns early reports as a passing test, so the number a runner prints is the number registered
 * rather than the number answered.
 *
 * Printed rather than asserted: which capabilities an adapter has is its own business, and a
 * threshold here would be this file having an opinion about that. What is not negotiable is that
 * the difference is visible.
 */
after(() => {
  const ledger = reactivityContractLedger();
  const answered = ledger.registered.length - ledger.skipped.length;
  console.log(`\nreactivity contract: ${answered} of ${ledger.registered.length} checks performed`);
  for (const skip of ledger.skipped) {
    console.log(`  not performed — ${skip.check}\n      because ${skip.because}`);
  }
});

/**
 * Where the purity rule actually bites (ADR 0032, amendment).
 *
 * A consumer of this library may never type the word "computed": what they type is a validator and a
 * `when` predicate, and both are evaluated to produce a derived value. These cases hold that
 * connection, and hold the promise that an author's mistake costs an exception rather than a form.
 */
test("a validator that writes a signal is refused, and the form survives it", () => {
  const rx = vanillaReactivity();
  const seen = rx.signal(0);
  const form = createForm(
    {
      a: field("start", [(value) => {
        if (value === "write") seen.set(seen() + 1);
        return [];
      }]),
      b: field("", [required()]),
    },
    { reactivity: rx },
  );
  form.activate();
  assert.equal(form.state.valid(), false, "b is required and empty");

  form.f.a.set("write");
  assert.throws(() => form.state.valid(), MdyComputedWriteError);
  // Repeatable while the cause is there, and the value is still readable meanwhile.
  assert.throws(() => form.state.valid(), MdyComputedWriteError);
  assert.deepEqual(form.getValue(), { a: "write", b: "" });

  form.f.a.set("start");
  assert.equal(form.state.valid(), false, "the form did not recover once the write was gone");
  form.f.b.set("filled");
  assert.equal(form.state.valid(), true);
  form.deactivate();
});

test("a `when` predicate that writes a signal is refused", () => {
  const rx = vanillaReactivity();
  const spy = rx.signal(0);
  const form = createForm(
    {
      flag: field(true),
      section: group({ x: field("1") }, {
        when: (_value, all) => {
          spy.set(spy() + 1);
          return all.flag === true;
        },
      }),
    },
    { reactivity: rx },
  );
  assert.throws(() => {
    form.activate();
    form.state.valid();
  }, MdyComputedWriteError);
});
