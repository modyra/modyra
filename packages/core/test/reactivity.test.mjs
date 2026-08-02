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
import { test } from "node:test";
import { runReactivityContractTests } from "../dist/testing/index.js";
import { vanillaReactivity } from "../dist/index.js";

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
