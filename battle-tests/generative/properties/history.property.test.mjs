/**
 * The same campaign, with a past.
 *
 * The generator has drawn `undo` and `redo` since it was written, behind a `withHistory` flag no
 * campaign ever passed — so every property so far has attacked a form that could only move forward.
 * Undo is where a defect hides best: it restores a value while leaving everything else where it is,
 * so a collection that has lost track of an identity keeps the right cells and attaches them to the
 * wrong row, and nothing about the value says so.
 *
 * The model's rule for what becomes a step was measured against the engine rather than assumed: an
 * entry exists because the value changed. A write of the value a cell already holds, a removal of a
 * key that is not there, a rename onto itself and a touch all record nothing, and a form that has
 * been edited fifty thousand times in one synchronous block offers two undos.
 *
 * What is compared is the value, the submission, the interaction state and — the point of this
 * property — `canUndo` and `canRedo`, which is where the affordance defect was found by hand. A
 * button that lights up for a step that does not exist, or stays dark over one that does, is a
 * capability the consumer cannot reach and cannot be told about.
 *
 * What it found first — undoing an operation that ended several rows restores them one per undo
 * instead of restoring the collection — is isolated to four operations, with its single-row control
 * beside it, in `adversarial/persistence/undo-of-a-whole-write.battle.test.mjs`. That is where the
 * defect is pinned; this is where it was found, and the two jobs are not the same one.
 *
 * At the default run count and an undrawn seed this campaign finds it about four times in five:
 * a campaign is a search, so whether a particular run reaches a particular sequence is a matter of
 * what it drew. Reading its green as "the defect is gone" is the mistake that shape invites — the
 * battle beside it is the one that answers that question every time.
 *
 * It stays as it is rather than routing around the defect, because a model taught to expect it would
 * stop being the independent half.
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
import { generateOperation } from "../generators/operations.mjs";

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
      disabled: statePathsUnder(form, "rows.", (state) => state.disabled()),
      canUndo: form.canUndo(),
      canRedo: form.canRedo(),
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
      disabled: model.disabledPaths(),
      canUndo: model.canUndo(),
      canRedo: model.canRedo(),
    },
    "observable",
  );
}

/**
 * Draw a sequence against a model that moves as the form does.
 *
 * Generated one operation at a time rather than in a batch, because an `undo` changes which keys
 * exist: a sequence drawn ahead of its own history would aim at rows the undo has taken away, and
 * the campaign would spend its runs on operations that do nothing.
 */
function draw(rng, length) {
  const scratch = createReferenceModel({ cells: CELLS, history: true });
  const operations = [];
  for (let index = 0; index < length; index += 1) {
    const operation = generateOperation(rng, scratch, {
      collectionPath: "rows",
      cells: CELL_NAMES,
      withHistory: true,
    });
    operations.push(operation);
    scratch.apply(operation);
  }
  return operations;
}

async function runSequence(operations, { log }) {
  const context = createBattleContext({ spec: SPEC, formOptions: { history: true }, log });
  const model = createReferenceModel({ cells: CELLS, history: true });

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
    claims: ["PER-002", "COL-001", "COL-007", "SUB-001"],
    title: "a collection with a past means what a much simpler model with a past says it means",
    environments: ["node"],
    requires: ["structural", "operations"],
  },
  async (ctx) => {
    ctx.attach("schema", SPEC);

    const runs = runCount(20);
    const length = 24;
    ctx.log.note("campaign", { seed: ctx.seed, runs, length });
    console.log(`  history campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    // Survey mode keeps going past a divergence and reports every distinct kind, each reduced.

    // Every run builds a fresh form and model, so each kind is an independent first divergence.

    const survey = surveying() ? createSurvey() : null;


    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const rng = createRng(runSeed(ctx.seed, run));
      const operations = draw(rng, length);

      const outcome = await runSequence(operations, { log: ctx.log });
      if (!outcome.divergence) continue;

      if (survey !== null) {
        survey.record({ divergence: outcome.divergence, run, seed: runSeed(ctx.seed, run), operations });
        continue;
      }

      const signature = `${outcome.divergence.path}|${outcome.divergence.expected}|${outcome.divergence.actual}`;
      const stillFails = async (candidate) => {
        const { divergence } = await runSequence(candidate, { log: ctx.log });
        return divergence !== null && `${divergence.path}|${divergence.expected}|${divergence.actual}` === signature;
      };
      const { minimized, attempts } = await shrink(operations, stillFails);
      ctx.attach("minimizedOperations", minimized);

      throw new BattleBreak({
        claimIds: ["PER-002", "COL-001", "COL-007", "SUB-001"],
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
          `run ${run} (seed ${runSeed(ctx.seed, run)}) diverged at operation ${outcome.index} ` +
          `(${outcome.operation.type}); minimised to ${minimized.length} operation(s) in ${attempts} attempt(s)`,
        divergence: outcome.divergence,
        expectedState: outcome.expected,
        actualState: outcome.actual,
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
        claimIds: ["PER-002", "COL-001", "COL-007", "SUB-001"],
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
