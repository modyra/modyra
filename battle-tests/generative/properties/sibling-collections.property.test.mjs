/**
 * Generated campaigns across a row that holds two collections of different kinds.
 *
 * `batches → readings` and `batches → tags`: every other property in this directory gives a row one
 * child. This is the shape where a row carries two that disagree about what identity means — an
 * index on one side, a key on the other — and where a change to the row has to carry both without
 * either learning anything about the other.
 *
 * The operations are drawn to keep the two children out of step: a reading pushed while a tag is
 * renamed, a row moved with both populated, a tag written through a row index that does not exist,
 * a `setAll` at the row level that must take both children with it.
 *
 * The model is an array of objects each holding an array and a `Map`, and one rule — a child lives
 * while its row does — so a divergence means the engine has an opinion about siblings that the shape
 * does not.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { createBattleContext } from "../../harness/context.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { encodeValue } from "../../models/observations.mjs";
import { POSITIONAL_ROOT_SPEC } from "../../models/schemas.mjs";
import { createSiblingCollectionsReferenceModel } from "../sibling-collections-reference-model.mjs";
import { generateRowValue, generateTextValue } from "../generators/field-values.mjs";

const ROW_CELLS = Object.freeze({ label: "batch" });
const READING_CELLS = Object.freeze({ value: "0" });
const TAG_CELLS = Object.freeze({ note: "unset" });
const CLAIMS = Object.freeze(["COL-001", "COL-002", "COL-005", "SUB-002"]);

/** Tag keys, few enough that renames and re-declarations actually collide. */
const TAG_KEYS = Object.freeze(["t1", "t2", "t3"]);

/** A row value that declares both children, which is what brings them into being. */
const rowValue = (rng) => ({ label: generateTextValue(rng), readings: [], tags: {} });

/**
 * An operation at the row level or at one of its two children.
 *
 * The generator reads the model rather than the form: it has to know which rows and keys exist to
 * draw an operation that reaches something, and asking the engine would make the campaign compare
 * the engine against a sequence the engine chose.
 */
function generateSiblingOperation(rng, model) {
  const length = model.length();

  // With no row there is nothing below one to address, so the only operation available is the one
  // that creates a row — and it declares both children.
  if (length === 0) return { type: "array.push", path: "batches", value: rowValue(rng) };

  const index = rng.int(length);
  const readingCount = model.readingCount(index);
  const tagKeys = model.tagKeys(index);
  const readingsPath = `batches.${index}.readings`;
  const tagsPath = `batches.${index}.tags`;

  const choices = [
    "row-push", "row-insert", "row-remove", "row-move", "row-set-all",
    "reading-push", "reading-push", "reading-remove", "reading-move", "reading-set-all",
    "tag-upsert", "tag-upsert", "tag-remove", "tag-rename", "tag-patch",
    "set-row-cell", "set-reading-cell", "set-tag-cell",
    "reading-under-a-missing-row", "tag-under-a-missing-row",
  ];

  switch (choices[rng.int(choices.length)]) {
    case "row-push":
      return { type: "array.push", path: "batches", value: rowValue(rng) };
    case "row-insert":
      return { type: "array.insert", path: "batches", index: rng.int(length + 1), value: rowValue(rng) };
    case "row-remove":
      return { type: "array.remove", path: "batches", index };
    case "row-move":
      return { type: "array.move", path: "batches", from: index, to: rng.int(length) };
    case "row-set-all":
      return { type: "array.setAll", path: "batches", value: Array.from({ length: rng.int(3) }, () => rowValue(rng)) };

    case "reading-push":
      return { type: "array.push", path: readingsPath, value: generateRowValue(rng, ["value"]) };
    case "reading-remove":
      return { type: "array.remove", path: readingsPath, index: readingCount > 0 ? rng.int(readingCount) : 0 };
    case "reading-move":
      return {
        type: "array.move",
        path: readingsPath,
        from: readingCount > 0 ? rng.int(readingCount) : 0,
        to: rng.int(Math.max(1, readingCount)),
      };
    case "reading-set-all":
      return {
        type: "array.setAll",
        path: readingsPath,
        value: Array.from({ length: rng.int(3) }, () => generateRowValue(rng, ["value"])),
      };

    case "tag-upsert":
      return { type: "record.upsert", path: tagsPath, key: TAG_KEYS[rng.int(TAG_KEYS.length)], value: generateRowValue(rng, ["note"]) };
    case "tag-remove":
      return { type: "record.remove", path: tagsPath, key: tagKeys.length > 0 ? tagKeys[rng.int(tagKeys.length)] : TAG_KEYS[0] };
    case "tag-rename":
      return {
        type: "record.rename",
        path: tagsPath,
        from: tagKeys.length > 0 ? tagKeys[rng.int(tagKeys.length)] : TAG_KEYS[0],
        to: TAG_KEYS[rng.int(TAG_KEYS.length)],
      };
    case "tag-patch":
      return {
        type: "record.patch",
        path: tagsPath,
        value: tagKeys.length > 0 ? { [tagKeys[rng.int(tagKeys.length)]]: { note: generateTextValue(rng) } } : {},
      };

    case "set-row-cell":
      return { type: "field.set", path: `batches.${index}.label`, value: generateTextValue(rng) };
    case "set-reading-cell":
      return {
        type: "field.set",
        path: `${readingsPath}.${readingCount > 0 ? rng.int(readingCount) : 0}.value`,
        value: generateTextValue(rng),
      };
    case "set-tag-cell":
      return {
        type: "field.set",
        path: `${tagsPath}.${tagKeys.length > 0 ? tagKeys[rng.int(tagKeys.length)] : TAG_KEYS[0]}.note`,
        value: generateTextValue(rng),
      };

    // Both children, addressed through a row index that is not there. A write that reaches nothing
    // must create nothing, and it must do so the same way on either side.
    case "reading-under-a-missing-row":
      return { type: "array.push", path: `batches.${length + rng.int(3)}.readings`, value: generateRowValue(rng, ["value"]) };
    case "tag-under-a-missing-row":
      return { type: "record.upsert", path: `batches.${length + rng.int(3)}.tags`, key: TAG_KEYS[0], value: generateRowValue(rng, ["note"]) };

    default:
      return { type: "flush" };
  }
}

/**
 * The value with each row's tags in key order, on both sides.
 *
 * `COL-002` states the rule this exists for: *record identity is the domain key, not presentation
 * order*. So where a renamed key ends up among its siblings is not something the contract promises,
 * and a model that reproduced the engine's answer would be agreeing with the engine rather than with
 * the shape.
 *
 * Membership and values are still compared, and so is the order of the *positional* sibling — an
 * index is identity there, and losing that order is a defect. This normalises the one collection
 * whose order the contract disclaims, and nothing else.
 */
function inKeyOrder(rows) {
  return rows.map((row) => ({
    ...row,
    tags: Object.fromEntries(Object.entries(row.tags ?? {}).sort(([a], [b]) => a.localeCompare(b))),
  }));
}

async function runSequence(operations, { log }) {
  const context = createBattleContext({ spec: POSITIONAL_ROOT_SPEC, log, formOptions: { devWarnings: false } });
  const model = createSiblingCollectionsReferenceModel({
    rowCells: ROW_CELLS,
    readingCells: READING_CELLS,
    tagCells: TAG_CELLS,
  });

  try {
    for (const [index, operation] of operations.entries()) {
      // A refusal is evidence rather than a crash: the generator only draws what the shape permits,
      // so the engine declining one is a disagreement about what the shape permits.
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
          expected: encodeValue(inKeyOrder(model.value()), "batches"),
          actual: encodeValue(inKeyOrder(context.form.getValue().batches ?? []), "batches"),
        };
      }
      model.apply(operation, { rootPath: "batches" });

      const actual = encodeValue(inKeyOrder(context.form.getValue().batches ?? []), "batches");
      const expected = encodeValue(inKeyOrder(model.value()), "batches");
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
    title: "a row holding two kinds of collection carries both of them",
    environments: ["node"],
    requires: ["structural", "operations"],
  },
  async (ctx) => {
    ctx.attach("schema", POSITIONAL_ROOT_SPEC);

    const runs = runCount(20);
    const length = 24;
    const histogram = new Map();
    console.log(`  sibling-collections campaign seed ${ctx.seed}, ${runs} run(s) of ${length} operation(s)`);

    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const seed = runSeed(ctx.seed, run);
      const rng = createRng(seed);
      const model = createSiblingCollectionsReferenceModel({
        rowCells: ROW_CELLS,
        readingCells: READING_CELLS,
        tagCells: TAG_CELLS,
      });
      const operations = [];
      for (let index = 0; index < length; index += 1) {
        const operation = generateSiblingOperation(rng, model);
        operations.push(operation);
        model.apply(operation, { rootPath: "batches" });
        const where = String(operation.path ?? "").includes(".readings")
          ? "reading"
          : String(operation.path ?? "").includes(".tags")
            ? "tag"
            : "row";
        histogram.set(`${where}:${operation.type}`, (histogram.get(`${where}:${operation.type}`) ?? 0) + 1);
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
    ctx.log.note("sibling-collections campaign histogram", Object.fromEntries(generated));
  },
);
