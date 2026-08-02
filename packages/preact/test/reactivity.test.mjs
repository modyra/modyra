/**
 * Preact against the conformance suite directly, with no compatibility shim.
 *
 * It runs `preactReactivity()` — **the export this package actually ships** — rather than
 * `vanillaReactivity()`. It had been testing the latter, so the thing consumers import was covered by
 * nothing: `preactReactivity` is core's graph re-tagged, and a re-tag is a spread, which is exactly
 * the shape that quietly drops a member.
 *
 * The harness owns every effect the suite creates (`options.scope` is the ownership channel, not
 * `scope.run()`) and destroys that scope after each test, which the shim's hardcoded
 * `destroy: () => {}` never did.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runReactivityContractTests } from "../../core/dist/testing/index.js";
import { preactReactivity } from "../dist/index.js";

runReactivityContractTests(test, assert, "preactReactivity", () => {
  const reactivity = preactReactivity();
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

test("preactReactivity is core's graph, correctly re-tagged", () => {
  const rx = preactReactivity();
  assert.equal(rx.kind, "preact", "the tag is what the capability matrix introspects");
  // The re-tag must not have cost a member. Spreading an object literal keeps everything today and
  // says nothing about tomorrow.
  for (const member of ["signal", "computed", "effect", "untracked", "createScope", "capabilities"]) {
    assert.ok(rx[member] !== undefined, `preactReactivity lost \`${member}\` in the re-tag`);
  }
});
