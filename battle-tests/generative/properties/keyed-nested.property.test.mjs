/**
 * Generated campaigns across a keyed level and two positional ones.
 *
 * `orders → lines → allocations`, which is the geometry the nesting limit opened up and the one the
 * campaign was not searching. `nested.property` stops at two positional levels; nothing put a keyed
 * level above them, so the seam this fixture exists for — an identity above two positions — had no
 * search running against it at all.
 *
 * The operations are drawn to keep crossing both seams: an order renamed with lines and allocations
 * under it, an allocation written while its line is moving, a line list addressed through a key that
 * was removed, a whole subtree replaced by `setAll` at either depth.
 *
 * The model is a `Map` of plain objects and two rules — a key names an order, and a row lives while
 * the row above it does — so a divergence means the engine has an opinion about depth or identity
 * that the shape does not.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { createBattleContext } from "../../harness/context.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { encodeValue } from "../../models/observations.mjs";
import { NESTED_ORDERS_SPEC } from "../../models/schemas.mjs";
import { createKeyedNestedReferenceModel } from "../keyed-nested-reference-model.mjs";
import { generateRowValue, generateTextValue } from "../generators/field-values.mjs";

const ORDER_CELLS = Object.freeze({ ref: "R" });
const LINE_CELLS = Object.freeze({ sku: "" });
const ALLOCATION_CELLS = Object.freeze({ bin: "", qty: "0" });
const CLAIMS = Object.freeze(["COL-001", "COL-005", "COL-007", "SUB-002"]);

/** Keys the campaign draws from, small enough that renames and reuses actually collide. */
const KEYS = Object.freeze(["a", "b", "c"]);

/**
 * An operation at one of the three levels, weighted towards the seams between them.
 *
 * The generator reads the *model* rather than the form: it has to know which keys and rows exist to
 * draw an operation that reaches something, and asking the engine would make the campaign compare
 * the engine against a sequence chosen by the engine.
 */
function generateKeyedNestedOperation(rng, model) {
  const keys = model.keys();
  const hasKey = keys.length > 0;

  // With no order there is nothing below one to address: every deeper path would name a row that
  // does not exist, which the engine refuses by name rather than treating as a write that reached
  // nothing. So the only operation available is the one that creates an order.
  if (!hasKey) {
    return {
      type: "record.upsert",
      path: "orders",
      key: KEYS[rng.int(KEYS.length)],
      value: { ref: generateTextValue(rng), lines: [] },
    };
  }

  const key = keys[rng.int(keys.length)];
  const lineCount = hasKey ? model.lineCount(key) : 0;
  const hasLine = lineCount > 0;
  const lineIndex = hasLine ? rng.int(lineCount) : 0;
  const allocationCount = hasLine ? model.allocationCount(key, lineIndex) : 0;
  const hasAllocation = allocationCount > 0;
  const allocationIndex = hasAllocation ? rng.int(allocationCount) : 0;

  const linesPath = `orders.${key}.lines`;
  const allocationsPath = `orders.${key}.lines.${lineIndex}.allocations`;

  const choices = [
    "order-upsert", "order-upsert", "order-remove", "order-rename", "order-patch",
    "line-push", "line-push", "line-insert", "line-remove", "line-move", "line-set-all",
    "allocation-push", "allocation-push", "allocation-remove", "allocation-move", "allocation-set-all",
    "set-order-cell", "set-line-cell", "set-allocation-cell",
    "allocation-under-a-missing-line",
  ];

  switch (choices[rng.int(choices.length)]) {
    // The nested list is declared by the value that creates the order: a collection nobody declared
    // is refused by name, which is the rule `declaration-owns-existence` pins.
    case "order-upsert":
      return {
        type: "record.upsert",
        path: "orders",
        key: KEYS[rng.int(KEYS.length)],
        value: { ref: generateTextValue(rng), lines: [] },
      };
    case "order-remove":
      return { type: "record.remove", path: "orders", key };
    case "order-rename":
      return { type: "record.rename", path: "orders", from: key, to: KEYS[rng.int(KEYS.length)] };
    case "order-patch":
      return { type: "record.patch", path: "orders", value: { [key]: { ref: generateTextValue(rng) } } };

    case "line-push":
      return { type: "array.push", path: linesPath, value: { ...generateRowValue(rng, ["sku"]), allocations: [] } };
    case "line-insert":
      return { type: "array.insert", path: linesPath, index: rng.int(lineCount + 1), value: { ...generateRowValue(rng, ["sku"]), allocations: [] } };
    case "line-remove":
      return { type: "array.remove", path: linesPath, index: lineIndex };
    case "line-move":
      return { type: "array.move", path: linesPath, from: lineIndex, to: rng.int(Math.max(1, lineCount)) };
    case "line-set-all":
      return {
        type: "array.setAll",
        path: linesPath,
        value: Array.from({ length: rng.int(3) }, () => ({ ...generateRowValue(rng, ["sku"]), allocations: [] })),
      };

    case "allocation-push":
      return { type: "array.push", path: allocationsPath, value: generateRowValue(rng, ["bin", "qty"]) };
    case "allocation-remove":
      return { type: "array.remove", path: allocationsPath, index: allocationIndex };
    case "allocation-move":
      return { type: "array.move", path: allocationsPath, from: allocationIndex, to: rng.int(Math.max(1, allocationCount)) };
    case "allocation-set-all":
      return {
        type: "array.setAll",
        path: allocationsPath,
        value: Array.from({ length: rng.int(3) }, () => generateRowValue(rng, ["bin", "qty"])),
      };

    case "set-order-cell":
      return { type: "field.set", path: `orders.${key}.ref`, value: generateTextValue(rng) };
    case "set-line-cell":
      return { type: "field.set", path: `orders.${key}.lines.${lineIndex}.sku`, value: generateTextValue(rng) };
    case "set-allocation-cell":
      return { type: "field.set", path: `${allocationsPath}.${allocationIndex}.bin`, value: generateTextValue(rng) };

    // The seam, addressed through a row that is not there: a write that reaches nothing must create
    // nothing. The keyed level has no equivalent draw — `orders.<absent>.lines` is an *undeclared*
    // collection rather than a missing row, and the engine refuses it by name, which is a contract
    // about declaration rather than a question about depth.
    case "allocation-under-a-missing-line":
      return { type: "array.push", path: `orders.${key}.lines.${lineCount + rng.int(3)}.allocations`, value: generateRowValue(rng, ["bin", "qty"]) };

    default:
      return { type: "flush" };
  }
}

async function runSequence(operations, { log }) {
  const context = createBattleContext({ spec: NESTED_ORDERS_SPEC, log, formOptions: { devWarnings: false } });
  const model = createKeyedNestedReferenceModel({
    orderCells: ORDER_CELLS,
    lineCells: LINE_CELLS,
    allocationCells: ALLOCATION_CELLS,
  });

  try {
    for (const [index, operation] of operations.entries()) {
      // A refusal is evidence rather than a crash. The generator only draws operations the shape
      // permits, so the engine declining one is a disagreement about what the shape permits — and
      // reporting it as a divergence lets the shrinker reduce it like any other.
      try {
        await context.execute(operation);
      } catch (error) {
        return {
          divergence: {
            path: `refused/${operation.path ?? ""}`,
            expected: "the operation applies",
            actual: JSON.stringify(String(error.message).slice(0, 120)),
          },
          index,
          operation,
          expected: encodeValue(model.value(), "orders"),
          actual: encodeValue(context.form.getValue().orders ?? {}, "orders"),
        };
      }
      model.apply(operation, { rootPath: "orders" });

      const actual = encodeValue(context.form.getValue().orders ?? {}, "orders");
      const expected = encodeValue(model.value(), "orders");
      // Through the counting comparator: a campaign that compares is a campaign that concluded
      // something, and the wrapper requires an assertion for exactly that reason.
      const divergence = compareCanonical(expected, actual);
      if (divergence) return { divergence, index, operation, expected, actual };
    }
    return { divergence: null };
  } finally {
    await context.dispose();
  }
}

battle(
  {
    claims: CLAIMS,
    title: "a keyed level above two positional ones means what a map of arrays says it means",
    environments: ["node"],
    requires: ["structural", "operations"],
  },
  async (ctx) => {
    ctx.attach("schema", NESTED_ORDERS_SPEC);

    const runs = runCount(20);
    const length = 24;
    const histogram = new Map();
    console.log(`  keyed-nested campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const seed = runSeed(ctx.seed, run);
      const rng = createRng(seed);
      const model = createKeyedNestedReferenceModel({
        orderCells: ORDER_CELLS,
        lineCells: LINE_CELLS,
        allocationCells: ALLOCATION_CELLS,
      });
      const operations = [];
      for (let index = 0; index < length; index += 1) {
        const operation = generateKeyedNestedOperation(rng, model);
        operations.push(operation);
        model.apply(operation, { rootPath: "orders" });
        const depth = String(operation.path ?? "").includes(".allocations")
          ? "allocation"
          : String(operation.path ?? "").includes(".lines")
            ? "line"
            : "order";
        histogram.set(`${depth}:${operation.type}`, (histogram.get(`${depth}:${operation.type}`) ?? 0) + 1);
      }

      const outcome = await runSequence(operations, { log: ctx.log });
      if (!outcome.divergence) continue;

      const signature = `${outcome.divergence.path}|${outcome.divergence.expected}|${outcome.divergence.actual}`;
      const stillFails = async (candidate) => {
        const { divergence } = await runSequence(candidate, { log: ctx.log });
        return divergence !== null && `${divergence.path}|${divergence.expected}|${divergence.actual}` === signature;
      };
      const { minimized, attempts } = await shrink(operations, stillFails);
      ctx.attach("minimizedOperations", minimized);
      const minimalOutcome = await runSequence(minimized, { log: ctx.log });

      throw new BattleBreak({
        claimIds: CLAIMS,
        message:
          `run ${run} (seed ${seed}) diverged at operation ${outcome.index} (${outcome.operation.type}); ` +
          `minimized to ${minimized.length} operation(s) in ${attempts} attempt(s)`,
        divergence: minimalOutcome.divergence ?? outcome.divergence,
        expected: minimalOutcome.expected ?? outcome.expected,
        actual: minimalOutcome.actual ?? outcome.actual,
      });
    }

    const generated = [...histogram.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  generated: ${generated.map(([type, count]) => `${type}×${count}`).join(", ")}`);
    ctx.log.note("keyed-nested campaign histogram", Object.fromEntries(generated));
  },
);
