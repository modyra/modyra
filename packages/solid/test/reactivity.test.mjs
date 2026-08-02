/**
 * Solid against the conformance suite directly, with no compatibility shim.
 *
 * `core/test/reactivity-contract.mjs` hardcodes `destroy: () => {}` and a flush that resolves
 * immediately, so an adapter tested through it is never asked to tear anything down and never asked
 * to flush anything real.
 *
 * The harness below owns every effect the suite creates — `options.scope` is the ownership channel,
 * not `scope.run()` — and destroys that scope after each test, so a scope that registers nothing is
 * visible here rather than leaking into whatever runs next.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runReactivityContractTests } from "../../core/dist/testing/index.js";
import { solidReactivity } from "../dist/index.js";

runReactivityContractTests(test, assert, "solidReactivity", () => {
  const reactivity = solidReactivity();
  const scope = reactivity.createScope({ debugName: "conformance" });
  return {
    reactivity: {
      ...reactivity,
      effect: (fn, options) => reactivity.effect(fn, { ...options, scope: options?.scope ?? scope }),
    },
    // Solid propagates synchronously; a microtask turn is enough to let anything queued settle.
    flushIfSupported: () => Promise.resolve(),
    destroy: () => scope.destroy(),
  };
});
