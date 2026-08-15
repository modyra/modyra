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
import { createReferenceModel } from "./reference-model.mjs";
import { KEYED_ROWS_SPEC, POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

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

    // A binding waiting where no row is yet, which is the half the model was missing: it tracked
    // refusals and not permissions, so an `enable` stated for a row that had not arrived was nothing
    // at all, and a row carrying one into a waiting refusal left the refusal standing.
    for (const [what, operations] of [
      ["a refusal waiting at an index two rows arrive at", [
        { type: "field.disable", path: "items.1.code" }, push("A"), push("B"),
      ]],
      ["a refusal waiting where an insertion sends a row", [
        push("A"), { type: "field.disable", path: "items.1.code" },
        { type: "array.insert", path: "items", index: 0, value: { code: "X", note: "x" } },
      ]],
      ["a row carrying a permission into a waiting refusal", [
        { type: "field.enable", path: "items.0.code" }, push("A"),
        { type: "field.disable", path: "items.1.code" },
        { type: "array.insert", path: "items", index: 0, value: { code: "X", note: "x" } },
      ]],
      ["a permission whose row ended before the move", [
        { type: "array.setAll", path: "items", value: [{ code: "A", note: "" }] },
        { type: "field.enable", path: "items.0.code" },
        { type: "array.remove", path: "items", index: 0 },
        push("B"),
        { type: "array.insert", path: "items", index: 0, value: { code: "X", note: "x" } },
      ]],
    ]) {
      const seen = await both(ctx, operations);
      ctx.log.note("a binding waiting for a row", { what, ...seen });

      expectEqual(seen.model.disabled, seen.engine.disabled, {
        claimIds: ["VAL-002", "COL-001"],
        what: `the model and the engine disagree about ${what}`,
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

/** The cells `KEYED_ROWS_SPEC` declares, which is what the model has to be built from. */
const KEYED_CELLS = Object.freeze({ code: "", note: "", tax: "" });

/** Run one sequence through the keyed pair and hand back what each says. */
async function bothKeyed(ctx, operations) {
  const context = ctx.open(KEYED_ROWS_SPEC);
  const model = createReferenceModel({ cells: KEYED_CELLS });
  for (const operation of operations) {
    await context.execute(operation);
    model.apply(operation);
  }
  const rows = context.collections.rows;
  const submitted = context.form.submitValue().rows ?? {};
  return {
    engine: {
      keys: [...rows.keys()],
      value: context.form.getValue().rows ?? {},
      touched: [...rows.keys()]
        .flatMap((key) => Object.keys(KEYED_CELLS).filter((cell) => rows.cell(key, cell)?.touched()).map((cell) => `${key}.${cell}`))
        .sort(),
      disabled: [...rows.keys()]
        .flatMap((key) => Object.keys(KEYED_CELLS).filter((cell) => !(cell in (submitted[key] ?? {}))).map((cell) => `${key}.${cell}`))
        .sort(),
    },
    model: { keys: model.keys(), value: model.value(), touched: model.touchedPaths(), disabled: model.disabledPaths() },
  };
}

battle(
  {
    claims: ["COL-001", "COL-002", "VAL-002"],
    title: "what the keyed model says an operation does is what the engine does",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const upsert = (key, value) => ({ type: "record.upsert", path: "rows", key, value: value ?? { code: key } });

    // Each of these is a sentence in the model's own header, turned into an operation with an
    // answer. The model is the other side of every comparison a campaign makes, so a wrong sentence
    // here is a defect the campaign reports from every seed at once.
    for (const [what, operations] of [
      ["upsert replaces the row it names", [upsert("a", { code: "1", note: "x" }), upsert("a", { code: "2" })]],
      ["upsert with no value at all", [upsert("a", { code: "1" }), { type: "record.upsert", path: "rows", key: "a" }]],
      ["a rename onto a free key", [upsert("a"), { type: "record.rename", path: "rows", from: "a", to: "z" }]],
      ["a rename onto an occupied key", [upsert("a"), upsert("b"), { type: "record.rename", path: "rows", from: "a", to: "b" }]],
      ["a rename of a key that does not exist", [upsert("a"), { type: "record.rename", path: "rows", from: "q", to: "z" }]],
      ["a rename carries the row's marks", [upsert("a"), { type: "field.touch", path: "rows.a.note" }, { type: "record.rename", path: "rows", from: "a", to: "z" }]],
      ["a rename carries the row's bindings", [upsert("a"), { type: "field.disable", path: "rows.a.note" }, { type: "record.rename", path: "rows", from: "a", to: "z" }]],
      ["a removed row's marks do not come back with the key", [upsert("a"), { type: "field.touch", path: "rows.a.note" }, { type: "record.remove", path: "rows", key: "a" }, upsert("a")]],
      ["a removed row's bindings do not either", [upsert("a"), { type: "field.disable", path: "rows.a.note" }, { type: "record.remove", path: "rows", key: "a" }, upsert("a")]],
      ["a whole-value write states which rows there are", [upsert("a"), upsert("b"), { type: "record.setAll", path: "rows", value: { c: { code: "3" } } }]],
      ["a partial write prunes nothing", [upsert("a"), upsert("b"), { type: "record.patch", path: "rows", value: { a: { note: "N" } } }]],
      ["declaration order after a key is written again", [upsert("a"), upsert("b"), upsert("a", { code: "9" })]],
    ]) {
      const seen = await bothKeyed(ctx, operations);
      ctx.log.note("one rule of the keyed model", { what, ...seen });

      expectEqual(seen.model.keys, seen.engine.keys, {
        claimIds: ["COL-002"],
        what: `the model and the engine disagree about which keys exist after ${what}`,
      });
      expectEqual(seen.model.value, seen.engine.value, {
        claimIds: ["COL-001"],
        what: `the model and the engine disagree about the value after ${what}`,
      });
      expectEqual(seen.model.touched, seen.engine.touched, {
        claimIds: ["COL-001"],
        what: `the model and the engine disagree about marks after ${what}`,
      });
      expectEqual(seen.model.disabled, seen.engine.disabled, {
        claimIds: ["VAL-002"],
        what: `the model and the engine disagree about bindings after ${what}`,
      });
    }
  },
);

battle(
  {
    claims: ["VAL-002", "COL-001"],
    title: "what the keyed model says about a binding waiting for its row is what happens",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const upsert = (key) => ({ type: "record.upsert", path: "rows", key, value: { code: key } });

    // The half a model that tracks only refusals loses. The first of these is the four-operation
    // sequence the records campaign found at half a million runs, and it is the one that separates
    // "the waiting refusal wins" from "what the row carries wins".
    for (const [what, operations] of [
      ["a row carrying a permission into a waiting refusal", [
        { type: "field.disable", path: "rows.Z.note" },
        upsert("a"),
        { type: "field.enable", path: "rows.a.note" },
        { type: "record.rename", path: "rows", from: "a", to: "Z" },
      ]],
      ["the same row carrying nothing", [
        { type: "field.disable", path: "rows.Z.note" },
        upsert("a"),
        { type: "record.rename", path: "rows", from: "a", to: "Z" },
      ]],
      ["a row carrying its own refusal onto a free key", [
        upsert("a"),
        { type: "field.disable", path: "rows.a.note" },
        { type: "record.rename", path: "rows", from: "a", to: "Z" },
      ]],
      ["a permission whose row ended before the rename", [
        upsert("a"),
        { type: "field.enable", path: "rows.a.note" },
        { type: "record.remove", path: "rows", key: "a" },
        { type: "field.disable", path: "rows.Z.note" },
        upsert("b"),
        { type: "record.rename", path: "rows", from: "b", to: "Z" },
      ]],
    ]) {
      const seen = await bothKeyed(ctx, operations);
      ctx.log.note("a keyed binding waiting for its row", { what, ...seen });

      expectEqual(seen.model.disabled, seen.engine.disabled, {
        claimIds: ["VAL-002", "COL-001"],
        what: `the model and the engine disagree about ${what}`,
      });
    }
  },
);
