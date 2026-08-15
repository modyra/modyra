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
  search = null,
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
    search,
    diagnostics,
    console: consoleOutput,
    replayCommand: isReplayable({ schema, operations, minimizedOperations })
      ? `npm run battle:replay -- ${relative(REPO_ROOT, file)}`
      : null,
  };
}

/**
 * Whether a report holds enough to be run again.
 *
 * Both halves are needed: the schema rebuilds the form, the operations drive it. A battle that
 * attacks the public API directly carries neither, and its report is a record of what was observed
 * rather than a sequence — announcing a replay command on it sends every reader to a crash, and
 * answering "reproduced" for it would be worse.
 */
export function isReplayable(report) {
  const schema = report?.schema;
  if (schema === null || schema === undefined) return false;
  return (report.minimizedOperations?.length ?? 0) > 0 || (report.operations?.length ?? 0) > 0;
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
  if (report.search) {
    const { run, runs, shrinkAttempts } = report.search;
    const reached = run === undefined || runs === undefined ? null : `${run + 1} of ${runs} run(s)`;
    lines.push(
      `Search: ${reached ?? "run index not recorded"}` +
        (shrinkAttempts === undefined ? "" : `, minimized in ${shrinkAttempts} attempt(s)`),
    );
  }
  const firstOperations = report.operations.slice(0, 8);
  if (firstOperations.length > 0) {
    lines.push(`Operations: ${report.operations.length} (${firstOperations.length} shown)`);
  }
  lines.push(
    report.replayCommand
      ? `Replay: ${report.replayCommand}`
      : "Replay: none — this failure was not driven through the operation interpreter, so the report " +
        "records what was observed rather than a sequence that reproduces it.",
  );
  return lines.join("\n");
}
