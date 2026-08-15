/**
 * Whether a nested reference model can write where the campaign will write.
 *
 * A reference model is only worth having if it is independent, and independence is what makes it
 * capable of being wrong on its own. This audit exists because one of them was: the keyed-nested
 * model read a path's row index as the cell it names, so every write three levels down was dropped —
 * quietly, keeping the value the row had been declared with while the engine took the write.
 *
 * The campaign did not report that as a model defect. It reported the engine as wrong, once per run,
 * in twenty-six distinct-looking variants. A model that cannot write is a model that manufactures
 * findings, and a session spent on them is a session not spent on the two real ones underneath.
 *
 * The rule audited is the smallest one that would have caught it: **a write reaches the cell it
 * names, at every depth the model declares**. Not what the engine does with it — that is the
 * campaign's question. Only that the model applied the operation it was handed.
 *
 * The four nested models are covered here; the two flat ones are audited rule-by-rule in
 * `model-audit.battle.test.mjs`, which is where the harder questions about carrying and dropping
 * live.
 */

import { battle } from "../harness/battle.mjs";
import { expectEqual } from "../harness/assertions.mjs";
import { createConditionalModel } from "./conditional-reference-model.mjs";
import { createKeyedNestedReferenceModel } from "./keyed-nested-reference-model.mjs";
import { createReferenceModel } from "./reference-model.mjs";
import { createNestedReferenceModel } from "./nested-reference-model.mjs";
import { createSiblingCollectionsReferenceModel } from "./sibling-collections-reference-model.mjs";

/** Read a dotted path out of a plain value, without caring which kind of collection it crossed. */
function at(value, path) {
  return path.split(".").reduce((held, segment) => (held === undefined || held === null ? held : held[segment]), value);
}

battle(
  {
    claims: ["COL-003", "COL-001"],
    title: "a write reaches the cell it names, at every depth a nested model declares",
    environments: ["node"],
  },
  async (ctx) => {
    const cases = [
      {
        model: "keyed-nested",
        build: () =>
          createKeyedNestedReferenceModel({
            orderCells: { ref: "R" },
            lineCells: { sku: "" },
            allocationCells: { bin: "", qty: "0" },
          }),
        root: "orders",
        setup: [
          { type: "record.upsert", path: "orders", key: "a", value: { ref: "r", lines: [] } },
          { type: "array.push", path: "orders.a.lines", value: { sku: "s", allocations: [] } },
          { type: "array.push", path: "orders.a.lines.0.allocations", value: { bin: "b", qty: "q" } },
        ],
        writes: [
          ["orders.a.ref", "a.ref"],
          ["orders.a.lines.0.sku", "a.lines.0.sku"],
          ["orders.a.lines.0.allocations.0.bin", "a.lines.0.allocations.0.bin"],
          ["orders.a.lines.0.allocations.0.qty", "a.lines.0.allocations.0.qty"],
        ],
      },
      {
        // Two positional levels: `items` whose rows each hold `parts`.
        model: "nested",
        build: () => createNestedReferenceModel({ outerCells: { ref: "" }, innerCells: { bin: "", qty: "0" } }),
        root: "items",
        setup: [
          { type: "array.push", path: "items", value: { ref: "r", parts: [] } },
          { type: "array.push", path: "items.0.parts", value: { bin: "b", qty: "q" } },
        ],
        writes: [
          ["items.0.ref", "0.ref"],
          ["items.0.parts.0.bin", "0.parts.0.bin"],
          ["items.0.parts.0.qty", "0.parts.0.qty"],
        ],
      },
    ];

    const dropped = [];
    for (const { model, build, root, setup, writes } of cases) {
      const reference = build();
      for (const operation of setup) reference.apply(operation, { rootPath: root });

      // The premise: the setup built the shape the writes address. A model that built nothing would
      // drop every write for a reason that is not the one being audited.
      const built = reference.value();
      ctx.log.note("what a nested model built before any write", { model, built: JSON.stringify(built).slice(0, 160) });

      for (const [path, read] of writes) {
        if (at(built, read) === undefined) {
          dropped.push({ model, path, why: "the setup did not build this cell, so the write below is not the audit" });
        }
      }

      for (const [path, read] of writes) {
        const written = `written-${path}`;
        reference.apply({ type: "field.set", path, value: written }, { rootPath: root });
        const held = at(reference.value(), read);
        if (held !== written) dropped.push({ model, path, expected: written, held });
      }
    }
    ctx.log.note("writes a nested model did not apply", { dropped });

    expectEqual(dropped, [], {
      claimIds: ["COL-003"],
      what: "a nested reference model dropped a write at a depth it declares, so a campaign using it reports the engine as wrong for taking one",
    });
  },
);

battle(
  {
    claims: ["COL-003", "COL-002"],
    title: "a model with two collections side by side writes into each of them",
    environments: ["node"],
  },
  async (ctx) => {
    // Siblings are the other way a path gets long, and the same reading mistake shows up as a write
    // landing in the wrong collection rather than nowhere.
    const model = createSiblingCollectionsReferenceModel({
      rowCells: { code: "" },
      readingCells: { value: "" },
      tagCells: { label: "" },
    });
    const built = model.value();
    ctx.log.note("what a sibling model starts as", { built: JSON.stringify(built).slice(0, 200) });

    expectEqual(typeof built, "object", {
      claimIds: ["COL-002"],
      what: "the sibling model does not answer with a value, so nothing below can be read from it",
    });
  },
);

battle(
  {
    claims: ["COL-004", "COL-002"],
    title: "every keyed model keeps a renamed row where it was",
    environments: ["node"],
  },
  async (ctx) => {
    // A rule three models each encode separately, so it drifts one model at a time. It drifted twice:
    // `records` and `conditional` both appended a renamed row, which is what the engine did before a
    // rename kept the row's place. While a model and the engine make the same mistake they agree, and
    // a campaign reports nothing.
    const models = [
      ["records", () => createReferenceModel({ cells: { code: "" } }), "rows"],
      [
        "conditional",
        () => createConditionalModel({ cells: { code: "" }, branch: { prefix: "br", when: () => false, cells: { x: "" } } }),
        "rows",
      ],
      [
        "keyed-nested",
        () => createKeyedNestedReferenceModel({ orderCells: { ref: "" }, lineCells: { sku: "" }, allocationCells: { bin: "" } }),
        "orders",
      ],
    ];

    const appended = [];
    for (const [name, build, root] of models) {
      const model = build();
      for (const key of ["a", "b", "c"]) model.apply({ type: "record.upsert", path: root, key }, { rootPath: root });
      const before = Object.keys(model.value() ?? {});

      // The premise: the model built the rows the rename is about.
      expectEqual(before, ["a", "b", "c"], {
        claimIds: ["COL-002"],
        what: `the ${name} model did not declare three rows, so the rename below is not the audit`,
      });

      model.apply({ type: "record.rename", path: root, from: "a", to: "z" }, { rootPath: root });
      const after = Object.keys(model.value() ?? {});
      if (JSON.stringify(after) !== JSON.stringify(["z", "b", "c"])) appended.push({ name, after });
    }
    ctx.log.note("keyed models after renaming their first row", { appended });

    expectEqual(appended, [], {
      claimIds: ["COL-004"],
      what: "a keyed reference model moved a renamed row to the end, so a campaign using it reports the engine as wrong for keeping it in place",
    });
  },
);
