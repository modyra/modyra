/**
 * Generated campaigns against an independent model.
 *
 * Each run draws a sequence of operations aimed at the boundaries — declare, mount, edit, remove
 * while mounted, rename onto a free and an occupied key, re-declare, reset — applies it to both a
 * real form and a model that shares none of its design, and compares what a consumer can see.
 *
 * A divergence is shrunk before it is reported: the sequence that reaches the report is the smallest
 * one that still produces it, and the seed that produced the original is printed either way.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { createBattleContext } from "../../harness/context.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { createSurvey, signatureOf, surveying } from "../../harness/survey.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { encodeValue } from "../../models/observations.mjs";
import { createReferenceModel } from "../reference-model.mjs";
import { generateSequence } from "../generators/operations.mjs";

const CELLS = Object.freeze({ code: "", note: "unset" });
const CELL_NAMES = Object.keys(CELLS);

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        code: Object.freeze({ kind: "text" }),
        note: Object.freeze({ kind: "text", initial: "unset" }),
      }),
    }),
  }),
});

/**
 * Everything a consumer can see about the collection, from the form and from the model alike.
 *
 * The interaction state is here as well as the value. The generator draws `touch`, `disable` and
 * `enable`, and a campaign that compares only what a row holds cannot tell whether the flag that
 * survived a rename, a removal or an undo is the one that belongs to the row now standing there —
 * which is where a collection loses track of an identity without ever losing a value.
 */
function statePathsUnder(form, prefix, read) {
  const paths = [];
  for (const name of form.fieldNames()) {
    if (!name.startsWith(prefix)) continue;
    const ref = form.getField(name);
    if (ref && read(ref())) paths.push(name.slice(prefix.length));
  }
  return paths.sort();
}

function observableOf(form, rowsHandle) {
  return encodeValue(
    {
      keys: [...rowsHandle.keys()],
      value: form.getValue().rows ?? {},
      submitted: form.submitValue().rows ?? {},
      touched: statePathsUnder(form, "rows.", (state) => state.touched()),
      dirty: statePathsUnder(form, "rows.", (state) => state.dirty()),
      disabled: statePathsUnder(form, "rows.", (state) => state.disabled()),
    },
    "observable",
  );
}

function expectedOf(model) {
  return encodeValue(
    {
      keys: model.keys(),
      value: model.value(),
      submitted: model.submitted(),
      touched: model.touchedPaths(),
      dirty: model.dirtyPaths(),
      disabled: model.disabledPaths(),
    },
    "observable",
  );
}

/**
 * Apply a sequence to a fresh form and a fresh model, and report the first operation after which
 * they disagreed. Building both from scratch is what makes a candidate sequence testable in
 * isolation, which is what shrinking needs.
 */
async function runSequence(operations, { log }) {
  const context = createBattleContext({ spec: SPEC, log });
  const model = createReferenceModel({ cells: CELLS });

  try {
    for (const [index, operation] of operations.entries()) {
      await context.execute(operation);
      model.apply(operation);

      const actual = observableOf(context.form, context.collections.rows);
      const expected = expectedOf(model);
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
    claims: ["COL-001", "COL-002", "COL-004", "COL-007", "COL-008", "SUB-001", "SUB-002"],
    title: "a keyed collection means what a much simpler model says it means",
    environments: ["node"],
    requires: ["structural", "operations"],
  },
  async (ctx) => {
    // The campaign builds its own contexts, so it states the schema a report must rebuild from.
    ctx.attach("schema", SPEC);

    const runs = runCount(20);
    const length = 24;
    ctx.log.note("campaign", { seed: ctx.seed, runs, length });
    console.log(`  campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    // Survey mode keeps going past a divergence and reports every distinct kind, each reduced.

    // Every run builds a fresh form and model, so each kind is an independent first divergence.

    const survey = surveying() ? createSurvey() : null;


    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const seed = runSeed(ctx.seed, run);
      const rng = createRng(seed);
      const model = createReferenceModel({ cells: CELLS });
      const operations = generateSequence(rng, model, {
        length,
        cells: CELL_NAMES,
        collectionPath: "rows",
      });

      const outcome = await runSequence(operations, { log: ctx.log });
      if (!outcome.divergence) continue;

      if (survey !== null) {
        survey.record({ divergence: outcome.divergence, run, seed: runSeed(ctx.seed, run), operations });
        continue;
      }

      // Reduce before reporting: what reaches the report is the smallest sequence that still fails.
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
        claimIds: ["COL-001", "COL-002", "COL-004", "COL-007", "COL-008", "SUB-001", "SUB-002"],
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
          `run ${run} (seed ${seed}) diverged from the reference model at operation ${outcome.index} ` +
          `(${outcome.operation.type}); minimized to ${minimized.length} operation(s) in ${attempts} attempt(s)`,
        divergence: minimalOutcome.divergence ?? outcome.divergence,
        expected: minimalOutcome.expected ?? outcome.expected,
        actual: minimalOutcome.actual ?? outcome.actual,
      });
    }
    if (survey !== null && survey.size > 0) {
      const reduced = [];
      for (const kind of survey.kinds()) {
        const stillFails = async (candidate) => {
          const { divergence } = await runSequence(candidate, { log: ctx.log });
          return divergence !== null && signatureOf(divergence) === kind.signature;
        };
        const { minimized } = await shrink(kind.operations, stillFails);
        reduced.push({ ...kind, minimized });
      }

      throw new BattleBreak({
        claimIds: ["COL-001", "COL-002", "COL-004", "COL-007", "COL-008", "SUB-001", "SUB-002"],
        message:
          `survey of ${runs} run(s) met ${survey.size} distinct kind(s) of divergence, each reduced:\n` +
          reduced
            .map(
              (kind) =>
                `  ×${String(kind.count).padStart(5)}  run ${kind.firstRun} (seed ${kind.seed}), ` +
                `${kind.operations.length} → ${kind.minimized.length} operation(s)\n` +
                `           ${kind.signature}\n` +
                kind.minimized.map((operation) => `             ${JSON.stringify(operation)}`).join("\n"),
            )
            .join("\n"),
      });
    }

  },
);
