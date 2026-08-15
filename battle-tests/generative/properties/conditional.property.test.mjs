/**
 * A generated campaign over a row that changes shape while it is being edited.
 *
 * The keyed and positional campaigns search rows whose cells are always there. This one searches the
 * case where a row's own data decides which cells it has: the branch opens and closes as the
 * deciding cell is written, and what a read shows changes underneath every other operation.
 *
 * The generator is weighted at that seam. It flips the deciding cell far more often than a uniform
 * draw would, writes into the branch while it is closed, and renames and removes rows in both
 * states, because the interesting sequences are the ones where a structural change lands on a row
 * whose shape is not the shape it had a moment ago.
 *
 * The model it is compared against holds every cell always and decides only what a read can see —
 * a different design from the engine's inactive paths, which is what makes the comparison evidence
 * rather than a restatement.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { encodeValue } from "../../models/observations.mjs";
import { buildSchema, CONDITIONAL_ROWS_SPEC } from "../../models/schemas.mjs";
import { createConditionalModel } from "../conditional-reference-model.mjs";

const CELLS = Object.freeze({ tier: "basic", code: "C" });
const BRANCH = Object.freeze({
  prefix: "extras",
  when: Object.freeze({ field: "tier", equals: "full" }),
  cells: Object.freeze({ reference: "", memo: "unset" }),
});

const KEYS = Object.freeze(["a", "b", "0", "01"]);
const TIERS = Object.freeze(["basic", "full", "other"]);

/** Everything a consumer can see about the collection, from the form and from the model alike. */
function observableOf(form) {
  return encodeValue(
    {
      keys: [...form.f.rows.keys()],
      value: form.getValue().rows ?? {},
      submitted: form.submitValue().rows ?? {},
    },
    "observable",
  );
}

function expectedOf(model) {
  return encodeValue(
    { keys: model.keys(), value: model.value(), submitted: model.submitted() },
    "observable",
  );
}

/**
 * One operation, drawn where the shapes meet.
 *
 * `declared` is what the model believes exists, so an operation aimed at a row is aimed at a real
 * one — and the deliberate misses are drawn on purpose rather than by accident.
 */
function drawOperation(rng, declared) {
  const any = declared.length > 0;
  const key = any ? rng.pick(declared) : rng.pick(KEYS);
  const kind = rng.weighted([
    ["declare", any ? 3 : 10],
    ["declare-valueless", 2],
    ["flip-tier", any ? 6 : 0],
    ["write-flat", any ? 3 : 0],
    ["write-branch", any ? 4 : 0],
    ["rename", any ? 3 : 0],
    ["remove", any ? 3 : 0],
    ["touch", any ? 2 : 0],
    ["disable", any ? 2 : 0],
    ["enable", any ? 1 : 0],
    ["mount", 2],
    ["unmount", 2],
  ].filter(([, weight]) => weight > 0));

  switch (kind) {
    case "declare":
      return {
        type: "record.upsert",
        path: "rows",
        key: rng.pick(KEYS),
        value: { tier: rng.pick(TIERS), code: `C${rng.int(9)}` },
      };
    case "declare-valueless":
      return { type: "record.upsert", path: "rows", key: rng.pick(KEYS) };
    case "flip-tier":
      return { type: "field.set", path: `rows.${key}.tier`, value: rng.pick(TIERS) };
    case "write-flat":
      return { type: "field.set", path: `rows.${key}.code`, value: `C${rng.int(99)}` };
    case "write-branch":
      // Written whether or not the branch is open: a closed branch keeps what was typed into it.
      return {
        type: "field.set",
        path: `rows.${key}.extras.${rng.pick(["reference", "memo"])}`,
        value: `R${rng.int(99)}`,
      };
    case "rename":
      return { type: "record.rename", path: "rows", from: key, to: rng.pick(KEYS) };
    case "remove":
      return { type: "record.remove", path: "rows", key };
    case "touch":
      return { type: "field.touch", path: `rows.${key}.${rng.pick(["tier", "code"])}` };
    case "disable":
      return { type: "field.disable", path: `rows.${key}.code` };
    case "enable":
      return { type: "field.enable", path: `rows.${key}.code` };
    case "mount":
      return { type: "mount", paths: [`rows.${rng.pick(KEYS)}.extras.reference`] };
    default:
      return { type: "unmount", paths: [`rows.${rng.pick(KEYS)}.extras.reference`] };
  }
}

function generateSequence(rng, length) {
  const model = createConditionalModel({ cells: CELLS, branch: BRANCH });
  const operations = [];
  for (let index = 0; index < length; index += 1) {
    const operation = drawOperation(rng, model.keys());
    model.apply(operation);
    operations.push(operation);
  }
  return operations;
}

/** Apply a sequence to a fresh form and a fresh model; report the first operation they disagreed on. */
function runSequence(operations) {
  const rx = vanillaReactivity();
  const form = createForm(buildSchema(CONDITIONAL_ROWS_SPEC).schema, { reactivity: rx, devWarnings: false });
  const model = createConditionalModel({ cells: CELLS, branch: BRANCH });

  try {
    for (const [index, operation] of operations.entries()) {
      applyToForm(form, rx, operation);
      model.apply(operation);

      const divergence = compareCanonical(expectedOf(model), observableOf(form));
      if (divergence) return { divergence, index, operation };
    }
    return { divergence: null };
  } finally {
    form.destroy();
  }
}

/** The interpreter's vocabulary, over the handles this spec exposes. */
function applyToForm(form, rx, operation) {
  const rows = form.f.rows;
  switch (operation.type) {
    case "record.upsert":
      rows.upsert(operation.key, operation.value);
      break;
    case "record.remove":
      rows.remove(operation.key);
      break;
    case "record.rename":
      rows.rename(operation.from, operation.to);
      break;
    case "field.set": {
      const [, key, ...rest] = operation.path.split(".");
      rows.cell(key, rest.join("."))?.set(operation.value);
      break;
    }
    case "field.touch": {
      const [, key, ...rest] = operation.path.split(".");
      rows.cell(key, rest.join("."))?.markAsTouched();
      break;
    }
    // `setDisabled` binds a signal rather than taking a boolean: what is disabled is a thing the
    // consumer can keep changing, not a state the form is told once.
    case "field.disable":
      form.setDisabled(operation.path, rx.signal(true));
      break;
    case "field.enable":
      form.setDisabled(operation.path, rx.signal(false));
      break;
    case "mount":
      for (const path of operation.paths) form.claimField(path);
      break;
    case "unmount":
      for (const path of operation.paths) form.removeField(path);
      break;
    default:
      break;
  }
}

battle(
  {
    claims: ["VAL-003", "COL-001", "COL-007", "COL-008", "SUB-001"],
    title: "a row whose shape depends on its own data means what a much simpler model says",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const runs = runCount(20);
    const length = 24;
    ctx.log.note("campaign", { seed: ctx.seed, runs, length });
    console.log(`  conditional campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const rng = createRng(runSeed(ctx.seed, run));
      const operations = generateSequence(rng, length);

      // Recorded before it is executed: a sequence that broke something has to be replayable even
      // if the break is in the executing.
      for (const operation of operations) ctx.log.record(operation);

      const outcome = runSequence(operations);
      if (!outcome.divergence) continue;

      const signature = `${outcome.divergence.path}|${outcome.divergence.expected}|${outcome.divergence.actual}`;
      const { minimized } = await shrink(operations, (candidate) => {
        const attempt = runSequence(candidate);
        if (!attempt.divergence) return false;
        const seen = `${attempt.divergence.path}|${attempt.divergence.expected}|${attempt.divergence.actual}`;
        return seen === signature;
      });

      throw new BattleBreak({
        claimIds: ["VAL-003", "COL-001", "COL-007", "COL-008", "SUB-001"],
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
          `a conditional row diverged from the model at ${outcome.divergence.path} — ` +
          `expected ${outcome.divergence.expected}, got ${outcome.divergence.actual} ` +
          `(run ${run}, operation ${outcome.index})`,
        divergence: outcome.divergence,
        expected: minimized,
        actual: operations,
      });
    }
  },
);
