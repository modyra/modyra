/**
 * Svelte against the conformance suite directly, with no compatibility shim.
 *
 * It runs `svelteReactivity()` — **the export this package actually ships** — rather than
 * `vanillaReactivity()`. It had been testing the latter, so the thing consumers import was covered by
 * nothing: `svelteReactivity` is core's graph re-tagged, and a re-tag is a spread, which is exactly
 * the shape that quietly drops a member.
 *
 * The harness owns every effect the suite creates (`options.scope` is the ownership channel, not
 * `scope.run()`) and destroys that scope after each test, which the shim's hardcoded
 * `destroy: () => {}` never did.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runReactivityContractTests } from "../../core/dist/testing/index.js";
import { svelteReactivity } from "../dist/index.js";

runReactivityContractTests(test, assert, "svelteReactivity", () => {
  const reactivity = svelteReactivity();
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

test("svelteReactivity is core's graph, correctly re-tagged", () => {
  const rx = svelteReactivity();
  assert.equal(rx.kind, "svelte", "the tag is what the capability matrix introspects");
  // The re-tag must not have cost a member. Spreading an object literal keeps everything today and
  // says nothing about tomorrow.
  for (const member of ["signal", "computed", "effect", "untracked", "createScope", "capabilities"]) {
    assert.ok(rx[member] !== undefined, `svelteReactivity lost \`${member}\` in the re-tag`);
  }
});
