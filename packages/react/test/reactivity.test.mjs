/**
 * React against the conformance suite directly, with no compatibility shim.
 *
 * It runs `reactReactivity()` — **the export this package actually ships** — rather than
 * `vanillaReactivity()`. It had been testing the latter, so the thing consumers import was covered by
 * nothing: `reactReactivity` is core's graph re-tagged, and a re-tag is a spread, which is exactly
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
import { reactReactivity } from "../dist/index.js";

runReactivityContractTests(test, assert, "reactReactivity", () => {
  const reactivity = reactReactivity();
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

test("reactReactivity is core's graph, correctly re-tagged", () => {
  const rx = reactReactivity();
  assert.equal(rx.kind, "react", "the tag is what the capability matrix introspects");
  // The re-tag must not have cost a member. Spreading an object literal keeps everything today and
  // says nothing about tomorrow.
  for (const member of ["signal", "computed", "effect", "untracked", "createScope", "capabilities"]) {
    assert.ok(rx[member] !== undefined, `reactReactivity lost \`${member}\` in the re-tag`);
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
    { reactivity: reactReactivity() },
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
    { reactivity: reactReactivity() },
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
