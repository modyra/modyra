/**
 * A break, written down well enough to be reproduced by someone who was not here.
 *
 * The report is the deliverable of a failing battle: the seed, the schema as data, every operation
 * in order, the two states that disagreed and the command that replays them. A failure that exists
 * only as a stack trace in a CI log is a failure nobody can fix.
 *
 * Fixtures are synthetic by construction, and the report is written from them; nothing here reads
 * application data, and nothing written here should ever contain a secret.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const REPORT_SCHEMA_VERSION = 1;

const BATTLE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = resolve(BATTLE_ROOT, "..");
/**
 * Where failure artefacts land.
 *
 * Overridable so a check that has to read back the report it just caused can point one battle at a
 * directory of its own. The shared directory is one place, and a run executes many battles: a
 * self-check that emptied it and then read whichever file appeared would delete a real failure's
 * artefact and might read another battle's in its place.
 */
export const FAILURES_DIR = process.env.MDY_BATTLE_REPORTS
  ? resolve(process.env.MDY_BATTLE_REPORTS)
  : join(BATTLE_ROOT, "reports", "failures");

/** Stable per failure content, so the same break rewrites one file instead of accumulating many. */
export function failureId({ claimIds, message, seed, environment }) {
  const digest = createHash("sha256")
    .update([claimIds.join("+"), message, String(seed), environment].join("|"))
    .digest("hex")
    .slice(0, 8);
  return `${claimIds.join("+")}-${digest}`;
}

export function buildReport({
  claimIds,
  severity,
  seed,
  environment,
  schema,
  formOptions = null,
  operations,
  minimizedOperations = [],
  expected = null,
  actual = null,
  divergence = null,
  diagnostics = [],
  consoleOutput = [],
  message,
  counts = null,
}) {
  const id = failureId({ claimIds, message, seed, environment: environment.name });
  const file = join(FAILURES_DIR, `${id}.json`);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    failureId: id,
    claimIds,
    severity,
    message,
    seed,
    environment,
    schema,
    formOptions,
    operations,
    minimizedOperations,
    divergence,
    expected,
    actual,
    counts,
    diagnostics,
    console: consoleOutput,
    replayCommand: `npm run battle:replay -- ${relative(REPO_ROOT, file)}`,
  };
}

export function writeReport(report) {
  mkdirSync(FAILURES_DIR, { recursive: true });
  const file = join(FAILURES_DIR, `${report.failureId}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return file;
}

/** The short form a person reads in the test output; the JSON holds everything else. */
export function formatSummary(report) {
  const lines = [
    `[${report.severity}][${report.claimIds.join(",")}] ${report.message}`,
    `Seed: ${report.seed}`,
    `Environment: ${report.environment.name} (${report.environment.runtime})`,
  ];
  if (report.divergence) {
    lines.push(`First divergence: ${report.divergence.path}`);
  }
  const firstOperations = report.operations.slice(0, 8);
  if (firstOperations.length > 0) {
    lines.push(`Operations: ${report.operations.length} (${firstOperations.length} shown)`);
  }
  lines.push(`Replay: ${report.replayCommand}`);
  return lines.join("\n");
}
