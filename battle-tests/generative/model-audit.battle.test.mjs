/**
 * The reference model, checked against the engine directly.
 *
 * A campaign compares a model to the engine thousands of times and reports where they disagree. What
 * it cannot do is say which of the two is wrong, and a model with one wrong sentence in it produces
 * a divergence from every seed at once — which reads exactly like a defect, and was carried as one.
 *
 * So the model's rules are stated here as single operations with a known answer, checked against the
 * engine one at a time. This is the check the campaign cannot make for itself: it does not need a
 * generator, it names the rule it is testing, and when it fails it fails on one line rather than on
 * a sequence of twenty-four.
 *
 * The pairs matter more than the cases. `insert at 1` after marking rows 0 and 2 distinguishes "marks
 * are cleared from the moved index onward" from "marks are cleared entirely" — two rules that agree
 * on every sequence with a single mark in it, which is most of them.
 */

import { battle } from "../harness/battle.mjs";
import { expectEqual } from "../harness/assertions.mjs";
import { createArrayReferenceModel } from "./array-reference-model.mjs";
import { POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

const CELLS = Object.freeze({ code: "", note: "" });

const push = (code) => ({ type: "array.push", path: "items", value: { code, note: "n" } });
const touch = (index) => ({ type: "field.touch", path: `items.${index}.note` });

/** Run one sequence through both and hand back what each says. */
async function both(ctx, operations) {
  const context = ctx.open(POSITIONAL_ROWS_SPEC);
  const model = createArrayReferenceModel({ cells: CELLS });
  for (const operation of operations) {
    await context.execute(operation);
    model.apply(operation);
  }
  const rows = context.form.getValue().items ?? [];
  const submitted = context.form.submitValue().items ?? [];
  return {
    engine: {
      value: rows.map((row) => `${row.code}/${row.note}`),
      touched: rows.flatMap((_, index) =>
        Object.keys(CELLS)
          .filter((cell) => context.form.getField(`items.${index}.${cell}`)?.().touched())
          .map((cell) => `${index}.${cell}`)),
      disabled: rows.flatMap((_, index) =>
        Object.keys(CELLS)
          .filter((cell) => !(cell in (submitted[index] ?? {})))
          .map((cell) => `${index}.${cell}`)),
    },
    model: {
      value: model.value().map((row) => `${row.code}/${row.note}`),
      touched: model.touchedPaths(),
      disabled: model.disabledPaths(),
    },
  };
}

battle(
  {
    claims: ["COL-001", "COL-005"],
    title: "what the positional model says a structural operation does is what the engine does",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const three = [push("A"), push("B"), push("C")];

    for (const [what, operations] of [
      ["a whole-value write states which rows there are", [...three, { type: "array.setAll", path: "items", value: [{ code: "X", note: "x" }] }]],
      ["a partial row in a whole-value write", [push("A"), { type: "array.setAll", path: "items", value: [{ code: "X" }] }]],
      ["an empty row in a whole-value write", [push("A"), { type: "array.setAll", path: "items", value: [{}] }]],
      ["a write to an index that has no row", [push("A"), { type: "field.set", path: "items.5.code", value: "Z" }]],
      ["an insert past the end", [push("A"), { type: "array.insert", path: "items", index: 9, value: { code: "Z", note: "z" } }]],
      ["an insert before the start", [push("A"), { type: "array.insert", path: "items", index: -3, value: { code: "Z", note: "z" } }]],
      ["a move from an index that has no row", [...three, { type: "array.move", path: "items", from: 7, to: 0 }]],
      ["a remove of an index that has no row", [...three, { type: "array.remove", path: "items", index: 7 }]],
    ]) {
      const seen = await both(ctx, operations);
      ctx.log.note("one rule of the model", { what, ...seen });

      expectEqual(seen.model.value, seen.engine.value, {
        claimIds: ["COL-001"],
        what: `the model and the engine disagree about ${what}`,
      });
    }
  },
);

battle(
  {
    claims: ["COL-001", "VAL-002"],
    title: "what the positional model says happens to marks and bindings is what happens",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const marked = [push("A"), push("B"), push("C"), touch(0), touch(2)];

    // Two marks, and an operation that moves one of them. A rule that cleared every mark and a rule
    // that clears from the moved index onward agree on a collection with one mark and part company
    // here — which is why the pair is the case and not the single.
    for (const [what, operation] of [
      ["an insert between them", { type: "array.insert", path: "items", index: 1, value: { code: "X", note: "x" } }],
      ["a move of the second onto the first", { type: "array.move", path: "items", from: 2, to: 1 }],
      ["a remove of the second", { type: "array.remove", path: "items", index: 2 }],
      ["a push, which moves nothing", push("D")],
    ]) {
      const seen = await both(ctx, [...marked, operation]);
      ctx.log.note("marks across a structural change", { what, ...seen });

      expectEqual(seen.model.touched, seen.engine.touched, {
        claimIds: ["COL-001"],
        what: `the model and the engine disagree about which marks survive ${what}`,
      });
    }

    // And the binding, which the record says travels with its row rather than staying at its index.
    for (const [what, operation] of [
      ["an insert before it", { type: "array.insert", path: "items", index: 0, value: { code: "X", note: "x" } }],
      ["a remove before it", { type: "array.remove", path: "items", index: 0 }],
      ["a move that carries it", { type: "array.move", path: "items", from: 1, to: 2 }],
      ["a move that passes it", { type: "array.move", path: "items", from: 0, to: 2 }],
    ]) {
      const seen = await both(ctx, [
        push("A"), push("B"), push("C"),
        { type: "field.disable", path: "items.1.code" },
        operation,
      ]);
      ctx.log.note("a binding across a structural change", { what, ...seen });

      expectEqual(seen.model.disabled, seen.engine.disabled, {
        claimIds: ["VAL-002", "COL-001"],
        what: `the model and the engine disagree about where a binding is after ${what}`,
      });
    }
  },
);
