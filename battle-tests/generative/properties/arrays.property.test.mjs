/**
 * Generated campaigns against a positional collection.
 *
 * Same shape as the keyed campaign: draw a sequence aimed at the boundaries, apply it to a real form
 * and to a model that shares none of its design, compare what a consumer can see, and shrink any
 * divergence before reporting it.
 *
 * What is compared: the rows, the submitted rows, the length, and which paths a user's interaction
 * marked — because a structural change is documented to rebuild the rows it moves, and "rebuilt
 * clean" is a claim about exactly those flags.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak } from "../../harness/assertions.mjs";
import { createBattleContext } from "../../harness/context.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { diffCanonical, encodeValue } from "../../models/observations.mjs";
import { createArrayReferenceModel } from "../array-reference-model.mjs";
import { generateArraySequence } from "../generators/array-operations.mjs";

const CELLS = Object.freeze({ sku: "", note: "unset" });
const CELL_NAMES = Object.keys(CELLS);
const CLAIMS = Object.freeze(["COL-001", "COL-008", "SUB-001", "SUB-002"]);

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    items: Object.freeze({
      kind: "array",
      of: Object.freeze({
        sku: Object.freeze({ kind: "text" }),
        note: Object.freeze({ kind: "text", initial: "unset" }),
      }),
    }),
  }),
});

/** Which paths carry a user's mark, as local `index.cell` names both sides can state. */
function touchedOf(form) {
  return form
    .fieldNames()
    .filter((name) => name.startsWith("items."))
    .filter((name) => form.getField(name)?.().touched())
    .map((name) => name.slice("items.".length))
    .sort();
}

function observableOf(form, handle) {
  return encodeValue(
    {
      length: handle.length(),
      value: form.getValue().items ?? [],
      submitted: form.submitValue().items ?? [],
      touched: touchedOf(form),
    },
    "observable",
  );
}

function expectedOf(model) {
  return encodeValue(
    {
      length: model.length(),
      value: model.value(),
      submitted: model.submitted(),
      touched: model.touchedPaths(),
    },
    "observable",
  );
}

async function runSequence(operations, { log }) {
  const context = createBattleContext({ spec: SPEC, log });
  const model = createArrayReferenceModel({ cells: CELLS });

  try {
    for (const [index, operation] of operations.entries()) {
      await context.execute(operation);
      model.apply(operation);

      const actual = observableOf(context.form, context.collections.items);
      const expected = expectedOf(model);
      const divergence = diffCanonical(expected, actual);
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
    title: "a positional collection means what a much simpler model says it means",
    environments: ["node"],
    requires: ["structural", "operations"],
  },
  async (ctx) => {
    ctx.attach("schema", SPEC);

    const runs = runCount(20);
    const length = 24;
    const histogram = new Map();

    console.log(`  array campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    for (let run = 0; run < runs; run += 1) {
      const seed = runSeed(ctx.seed, run);
      const rng = createRng(seed);
      const model = createArrayReferenceModel({ cells: CELLS });
      const operations = generateArraySequence(rng, model, {
        length,
        cells: CELL_NAMES,
        collectionPath: "items",
      });
      for (const operation of operations) {
        histogram.set(operation.type, (histogram.get(operation.type) ?? 0) + 1);
      }

      const outcome = await runSequence(operations, { log: ctx.log });
      if (!outcome.divergence) continue;

      // The same divergence, not merely some divergence: a shorter sequence can reach a *different*
      // finding, and a shrinker that accepts one minimises the report into a break nobody was
      // looking at.
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

    // What was generated, so a green run is a measurement rather than a claim.
    const generated = [...histogram.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  generated: ${generated.map(([type, count]) => `${type}×${count}`).join(", ")}`);
    ctx.log.note("array campaign histogram", Object.fromEntries(generated));
  },
);
