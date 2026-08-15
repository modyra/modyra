/**
 * Generated campaigns across two positional levels.
 *
 * `items → parts`, the shape the engine refused until the nesting limit came off. The operations are
 * drawn to keep crossing the boundary: a part written while its row is being moved, a row removed
 * with parts under it, a child list addressed through a row index that does not exist.
 *
 * The model is two nested arrays and one rule — a child row lives while its parent row does — so a
 * divergence means the engine has an opinion about depth that the shape does not.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { createBattleContext } from "../../harness/context.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { encodeValue } from "../../models/observations.mjs";
import { createNestedReferenceModel } from "../nested-reference-model.mjs";
import { generateRowValue, generateTextValue } from "../generators/field-values.mjs";

const OUTER_CELLS = Object.freeze({ ref: "" });
const INNER_CELLS = Object.freeze({ bin: "", qty: "0" });
const CLAIMS = Object.freeze(["COL-001", "COL-005", "SUB-002"]);

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    items: Object.freeze({
      kind: "array",
      of: Object.freeze({
        ref: Object.freeze({ kind: "text" }),
        parts: Object.freeze({
          kind: "array",
          of: Object.freeze({ bin: Object.freeze({ kind: "text" }), qty: Object.freeze({ kind: "text", initial: "0" }) }),
        }),
      }),
    }),
  }),
});

/** An operation at one level or the other, weighted towards the seam between them. */
function generateNestedOperation(rng, model) {
  const outerLength = model.length();
  const hasOuter = outerLength > 0;
  const outerIndex = hasOuter ? rng.int(outerLength) : 0;
  const innerLength = hasOuter ? model.innerLength(outerIndex) : 0;
  const hasInner = innerLength > 0;
  const innerIndex = hasInner ? rng.int(innerLength) : 0;
  const innerPath = `items.${outerIndex}.parts`;

  const kind = rng.weighted(
    [
      ["outer-push", hasOuter ? 3 : 10],
      ["outer-push-with-parts", 3],
      ["outer-insert", hasOuter ? 3 : 0],
      ["outer-remove", hasOuter ? 3 : 0],
      ["outer-move", outerLength > 1 ? 4 : 0],
      ["outer-set-all", 1],
      ["inner-push", hasOuter ? 5 : 0],
      ["inner-remove", hasInner ? 3 : 0],
      ["inner-move", innerLength > 1 ? 3 : 0],
      ["inner-set-all", hasOuter ? 2 : 0],
      ["inner-under-a-missing-row", 2],
      ["set-outer-cell", hasOuter ? 3 : 0],
      ["set-inner-cell", hasInner ? 4 : 0],
    ].filter(([, weight]) => weight > 0),
  );

  switch (kind) {
    case "outer-push":
      return { type: "array.push", path: "items", value: { ref: generateTextValue(rng) } };
    case "outer-push-with-parts":
      return {
        type: "array.push",
        path: "items",
        value: {
          ref: generateTextValue(rng),
          parts: Array.from({ length: rng.int(3) }, () => generateRowValue(rng, ["bin", "qty"])),
        },
      };
    case "outer-insert":
      return { type: "array.insert", path: "items", index: outerIndex, value: { ref: generateTextValue(rng) } };
    case "outer-remove":
      return { type: "array.remove", path: "items", index: outerIndex };
    case "outer-move":
      return { type: "array.move", path: "items", from: outerIndex, to: rng.int(outerLength) };
    case "outer-set-all":
      return {
        type: "array.setAll",
        path: "items",
        value: Array.from({ length: rng.int(3) }, () => ({ ref: generateTextValue(rng) })),
      };

    case "inner-push":
      return { type: "array.push", path: innerPath, value: generateRowValue(rng, ["bin", "qty"]) };
    case "inner-remove":
      return { type: "array.remove", path: innerPath, index: innerIndex };
    case "inner-move":
      return { type: "array.move", path: innerPath, from: innerIndex, to: rng.int(innerLength) };
    case "inner-set-all":
      return {
        type: "array.setAll",
        path: innerPath,
        value: Array.from({ length: rng.int(3) }, () => generateRowValue(rng, ["bin", "qty"])),
      };
    case "inner-under-a-missing-row":
      return { type: "array.push", path: `items.${outerLength + rng.int(3)}.parts`, value: generateRowValue(rng, ["bin", "qty"]) };

    case "set-outer-cell":
      return { type: "field.set", path: `items.${outerIndex}.ref`, value: generateTextValue(rng) };
    case "set-inner-cell":
      return { type: "field.set", path: `items.${outerIndex}.parts.${innerIndex}.bin`, value: generateTextValue(rng) };
    default:
      return { type: "flush" };
  }
}

async function runSequence(operations, { log }) {
  const context = createBattleContext({ spec: SPEC, log, formOptions: { devWarnings: false } });
  const model = createNestedReferenceModel({ outerCells: OUTER_CELLS, innerCells: INNER_CELLS });

  try {
    for (const [index, operation] of operations.entries()) {
      await context.execute(operation);
      model.apply(operation, { outerPath: "items" });

      const actual = encodeValue(context.form.getValue().items ?? [], "items");
      const expected = encodeValue(model.value(), "items");
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
    title: "two positional levels mean what two nested arrays say they mean",
    environments: ["node"],
    requires: ["structural", "operations"],
  },
  async (ctx) => {
    ctx.attach("schema", SPEC);

    const runs = runCount(20);
    const length = 22;
    const histogram = new Map();
    console.log(`  nested campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const seed = runSeed(ctx.seed, run);
      const rng = createRng(seed);
      const model = createNestedReferenceModel({ outerCells: OUTER_CELLS, innerCells: INNER_CELLS });
      const operations = [];
      for (let index = 0; index < length; index += 1) {
        const operation = generateNestedOperation(rng, model);
        operations.push(operation);
        model.apply(operation, { outerPath: "items" });
        const label = operation.path?.includes(".parts") ? `inner:${operation.type}` : operation.type;
        histogram.set(label, (histogram.get(label) ?? 0) + 1);
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
        // Which run this was, against how many were asked for. A property stops at its first
        // divergence, so this is how much of the configured search actually happened.
        search: {
          run,
          runs,
          operations: operations.length,
          minimizedTo: minimized.length,
          shrinkAttempts: attempts,
        },
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
    ctx.log.note("nested campaign histogram", Object.fromEntries(generated));
  },
);
