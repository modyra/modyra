/**
 * Proves @modyra/core/testing's harness-based API works standalone, not
 * directly, rather than only via the adapters that consume it. The backward-compat shim other
 * adapter packages still use (piano-modyra-reactivity-adapter-api.md
 * Milestone 7).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "../dist/index.js";
import { runReactivityContractTests } from "../dist/testing/index.js";

let destroyed = 0;

runReactivityContractTests(test, assert, "core/testing harness", () => ({
  reactivity: vanillaReactivity(),
  flushIfSupported: () => Promise.resolve(),
  destroy: () => {
    destroyed++;
  },
}));

test("core/testing harness: destroy() was called once per registered test", () => {
  // 14 tests are registered above (4 universal + 7 scope/capability-gated +
  // 3 batch/flush/observe-gated); each calls destroy() exactly once via
  // createHarness()'s returned object.
  assert.equal(destroyed, 14);
});
