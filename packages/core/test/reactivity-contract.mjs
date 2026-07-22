/**
 * Backward-compatible shim over the canonical conformance suite.
 *
 * The real implementation moved to `@modyra/core/testing`
 * (`src/testing/reactivity-contract.ts`, piano-modyra-reactivity-adapter-api.md
 * Milestone 7) so it has a documented, harness-based public API adapters
 * outside this monorepo can depend on. This file adapts the old
 * `runReactivityContract(name, factory, options)` signature — still used by
 * every adapter package's own `test/reactivity.test.mjs` — onto the new
 * `runReactivityContractTests(test, assert, name, createHarness)` one, so
 * none of those call sites needed to change.
 *
 * @param {string} name
 * @param {() => import('../dist/index.js').MdyReactivity} factory
 * @param {{ flush?: () => Promise<void> }} [options]
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { runReactivityContractTests } from "../dist/testing/index.js";

export function runReactivityContract(name, factory, options = {}) {
  const { flush = () => Promise.resolve() } = options;
  runReactivityContractTests(test, assert, name, () => ({
    reactivity: factory(),
    flushIfSupported: flush,
    destroy: () => {},
  }));
}
