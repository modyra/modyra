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

test("a row that is a collection is declared and read on this adapter's graph", () => {
  // The engine nests without a limit, and every adapter's own reactivity has to carry it: a row of a
  // row is registered under the row that owns it, so a runtime that batches or schedules differently
  // is exactly where a partially built subtree would show.
  const form = createForm(
    { orders: record(group({ customer: field(""), lines: array(group({ sku: field(""), qty: field(0) })) })) },
    { reactivity: vueReactivity() },
  );

  form.f.orders.upsert("o1", { customer: "Ada" });
  form.f.orders.row("o1").lines.push({ sku: "S-1", qty: 3 });
  form.f.orders.row("o1").lines.push({ sku: "S-2", qty: 1 });
  form.f.orders.row("o1").lines.move(0, 1);

  assert.deepEqual(form.getValue().orders.o1, {
    customer: "Ada",
    lines: [{ sku: "S-2", qty: 1 }, { sku: "S-1", qty: 3 }],
  });
  assert.equal(form.f.orders.row("o1").lines.at(0).sku.value(), "S-2");
  form.destroy();
});

test("a row is taken apart as one change: rename and remove on this adapter's graph", () => {
  // Declaring a row was made atomic; ending one was not, and the two are the same hazard. A row ends
  // cell by cell, so a runtime whose computations run eagerly reads the form between two of them and
  // finds a shape the schema does not describe.
  const form = createForm(
    { rows: record(group({ a: field(""), b: field("") })), lines: array(group({ a: field(""), b: field("") })) },
    { reactivity: vueReactivity() },
  );

  form.f.rows.upsert("r", { a: "A" });
  form.f.rows.rename("r", "q");
  assert.deepEqual(form.getValue().rows, { q: { a: "A", b: "" } });
  form.f.rows.remove("q");
  assert.deepEqual(form.getValue().rows, {});

  form.f.lines.push({ a: "A", b: "B" });
  form.f.lines.push({ a: "C", b: "D" });
  form.f.lines.remove(0);
  assert.deepEqual(form.getValue().lines, [{ a: "C", b: "D" }]);
  form.f.lines.setAll([{ a: "X", b: "Y" }]);
  assert.deepEqual(form.getValue().lines, [{ a: "X", b: "Y" }]);
  form.destroy();
});
