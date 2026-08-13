#!/usr/bin/env node
/**
 * Run a failure report again.
 *
 *   node battle-tests/harness/replay.mjs battle-tests/reports/failures/<id>.json
 *
 * The report carries the schema as data and the operations in order, so the same form is rebuilt
 * and the same sequence applied through the same interpreter the failing battle used. What replay
 * prints is the state after the last operation and, when the report recorded one, whether the
 * divergence is still there.
 *
 * A failure that does not reproduce is a finding of its own: either the operation log is missing
 * something the attack did, or the behaviour depends on timing the log does not capture. Both are
 * harness defects, and both are worth more than a quietly discarded report.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { diffCanonical } from "../models/observations.mjs";
import { createBattleContext } from "./context.mjs";

/** The shape {@link canonicalObservation} produces, as opposed to a battle's own projection. */
function isCanonicalObservation(state) {
  return typeof state === "object" && state !== null && "fieldNames" in state && "collections" in state;
}

export async function replay(report) {
  const context = createBattleContext({
    spec: report.schema,
    formOptions: report.formOptions?.options ?? {},
  });
  const operations = report.minimizedOperations?.length > 0 ? report.minimizedOperations : report.operations;

  try {
    for (const operation of operations) {
      // `sync` is part of the sequence, not decoration: an operation the attack made without
      // yielding is replayed the same way, or the window it attacked is never reopened.
      if (operation.sync) context.executeNow(operation);
      else await context.execute(operation);
    }
    const actual = context.observe("replay");

    // A report's recorded state is comparable only when it is a canonical observation. A campaign
    // that compares its own projection — a model's view of one collection — records that instead,
    // and replaying it reproduces the sequence rather than the comparison. Saying so is the point:
    // claiming reproduction against a shape that was never compared would be a false green.
    const comparable = isCanonicalObservation(report.actual);
    const divergence = comparable ? diffCanonical(report.actual, actual) : null;
    return {
      actual,
      operations,
      reproduced: comparable ? divergence === null : null,
      divergence,
      comparable,
    };
  } finally {
    await context.dispose();
  }
}

async function main() {
  const [file] = process.argv.slice(2);
  if (!file) {
    console.error("usage: node battle-tests/harness/replay.mjs <report.json>");
    process.exit(2);
  }

  const report = JSON.parse(readFileSync(resolve(file), "utf8"));
  console.log(`Replaying ${report.failureId} — ${report.message}`);
  console.log(`Seed: ${report.seed}  Environment: ${report.environment?.name ?? "node"}`);
  if (report.formOptions?.dropped?.length > 0) {
    console.log(`Options not carried by the report: ${report.formOptions.dropped.join(", ")}`);
  }

  const outcome = await replay(report);
  console.log(`Applied ${outcome.operations.length} operation(s).`);

  if (outcome.reproduced === null) {
    console.log(
      outcome.comparable === false
        ? "Report carried a battle-specific observation; the sequence replayed, final state:"
        : "Report carried no observed state; nothing to compare. Final state:",
    );
    console.log(JSON.stringify(outcome.actual, null, 2));
    return;
  }
  if (outcome.reproduced) {
    console.log("Reproduced: the replayed state matches the state recorded at failure.");
    return;
  }
  console.error("NOT reproduced — the replayed state differs from the recorded one.");
  console.error(`First difference at ${outcome.divergence.path}: recorded ${outcome.divergence.expected}, replayed ${outcome.divergence.actual}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  await main();
}
