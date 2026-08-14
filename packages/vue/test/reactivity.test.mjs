/**
 * Vue against the conformance suite directly, with no compatibility shim.
 *
 * `core/test/reactivity-contract.mjs` adapts the old signature onto the canonical suite, and in
 * doing so hardcodes `destroy: () => {}` and a flush that resolves immediately. An adapter tested
 * through it is never asked to tear anything down and never asked to flush anything real — the two
 * questions a harness exists to ask.
 *
 * This file supplies a real harness instead: each test runs against a scope that is genuinely
 * destroyed afterwards, and the flush is Vue's own scheduler.
 */
import assert from "node:assert/strict";
import { array, createForm, field, group, record } from "../../core/dist/index.js";
import { test } from "node:test";
import { nextTick } from "vue";
import { runReactivityContractTests } from "../../core/dist/testing/index.js";
import { vueReactivity } from "../dist/index.js";

runReactivityContractTests(test, assert, "vueReactivity", () => {
  const reactivity = vueReactivity();
  // One scope per harness, destroyed at the end of each test: a leak or a double-destroy surfaces
  // here rather than in whatever runs next.
  const scope = reactivity.createScope({ debugName: "conformance" });
  return {
    // Every effect the suite creates is owned by the scope. Handing over the bare reactivity would
    // leave the scope empty, and destroying an empty scope is the shim's no-op wearing a hat.
    // `options.scope` is the ownership channel — `scope.run()` only enters the reactive context.
    reactivity: {
      ...reactivity,
      effect: (fn, options) => reactivity.effect(fn, { ...options, scope: options?.scope ?? scope }),
    },
    // Vue's own scheduler, not a resolved promise. A flush that never flushes proves nothing about
    // an adapter that batches.
    flushIfSupported: () => nextTick(),
    destroy: () => scope.destroy(),
  };
});

/**
 * A collection row, declared on this adapter's own reactivity.
 *
 * The adapter suites had four files each and none declared a collection, so every claim about rows
 * was proven on the vanilla graph alone. That is how a runtime whose computations run eagerly could
 * ship unable to declare a row with more than one cell: a row registers its cells one at a time, and
 * a read landing between two of them sees a shape the schema does not describe.
 */
test("a keyed row with several cells is declared, and reads back whole", () => {
  const form = createForm(
    { rows: record(group({ code: field(""), note: field(""), qty: field(0) })) },
    { reactivity: vueReactivity() },
  );

  form.f.rows.upsert("a", { code: "A" });

  assert.deepEqual(form.getValue().rows.a, { code: "A", note: "", qty: 0 });
  assert.deepEqual([...form.f.rows.keys()], ["a"]);
  assert.deepEqual(form.submitValue().rows.a, { code: "A", note: "", qty: 0 });
  form.destroy();
});

test("a positional row with several cells is declared, and survives a reorder", () => {
  const form = createForm(
    { items: array(group({ code: field(""), note: field("") })) },
    { reactivity: vueReactivity() },
  );

  form.f.items.push({ code: "A", note: "first" });
  form.f.items.push({ code: "B", note: "second" });
  form.f.items.move(0, 1);

  assert.deepEqual(form.getValue().items, [
    { code: "B", note: "second" },
    { code: "A", note: "first" },
  ]);
  form.destroy();
});
