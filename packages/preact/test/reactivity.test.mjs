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
import { array, createForm, field, group, record } from "../../core/dist/index.js";
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
    { reactivity: preactReactivity() },
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
    { reactivity: preactReactivity() },
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
    { reactivity: preactReactivity() },
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
    { reactivity: preactReactivity() },
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
