/**
 * How big the visual red on `main` is, in one unit, recorded once per run.
 *
 * The question "is it growing?" was asked and answered with an estimate built from two numbers in
 * different units — a count of shots against a count of failures across the browser matrix, joined
 * by "from … to". That fabricates a slope out of a division: the same debt reads as growth because
 * the second number counts something the first never did.
 *
 * So this records the runner's own summary, which is the only vocabulary that knows what one case
 * is: `passed`, `failed`, `flaky`. A flaky is kept apart because it is not a red — it passed on a
 * retry — and folding it into the failures overstates the debt by exactly the cases that recovered.
 *
 * **Counting error texts was tried here and does not work.** One failure prints its error once per
 * retry and again inside its call log: a run with 47 failures printed 188 of them. A count of error
 * lines counts printings, so two such counts are not comparable even to each other.
 *
 * **A run whose log has expired is recorded as unmeasurable, never omitted and never zero.** GitHub
 * drops logs, and a missing row silently shortens the interval a reader compares over — an absence
 * that looks like a measurement is the failure this file exists to prevent. Two runs hours apart
 * already returned nothing at all here.
 *
 * What it does not judge: whether the failing step is the visual one. It records the step's name so
 * a reader can see that for themselves, because a run red for another reason belongs in a different
 * series and silently folding it in would be the same error one level down.
 *
 * Usage:
 *   node scripts/record-main-visual-count.mjs             # the latest failed CI run on main
 *   node scripts/record-main-visual-count.mjs <run-id>    # a particular run
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG = join(ROOT, "battle-tests/reports/main-visual-debt-log.json");

const gh = (...args) => execFileSync("gh", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function latestFailedRun() {
  const rows = JSON.parse(gh("run", "list", "--workflow=CI", "--branch=main", "--limit", "20",
    "--json", "databaseId,headSha,conclusion,createdAt"));
  return rows.find((row) => row.conclusion === "failure") ?? null;
}

function runById(id) {
  const one = JSON.parse(gh("run", "view", id, "--json", "databaseId,headSha,conclusion,createdAt"));
  return one.databaseId === undefined ? null : one;
}

const asked = process.argv[2];
const run = asked ? runById(asked) : latestFailedRun();
if (run === null) {
  console.log("No failed CI run on main to record.");
  process.exit(0);
}

const record = JSON.parse(existsSync(LOG) ? readFileSync(LOG, "utf8") : '{"note":"","runs":[]}');
record.note = "The size of the red on main, per run, in the runner's own vocabulary: passed, failed, "
  + "flaky. A row saying `unmeasurable` is a run whose log GitHub no longer serves — not a run with "
  + "nothing wrong. `failedSteps` says which step produced it, so a run red for another reason is "
  + "visible rather than folded into this series.";

if (record.runs.some((row) => row.runId === run.databaseId)) {
  console.log(`Run ${run.databaseId} is already recorded; nothing to do.`);
  process.exit(0);
}

// The step that failed, kept so a reader can tell one series from another.
const jobs = JSON.parse(gh("run", "view", String(run.databaseId), "--json", "jobs")).jobs;
const steps = jobs.flatMap((job) => job.steps.filter((step) => step.conclusion === "failure").map((step) => step.name));

let log = "";
try {
  log = gh("run", "view", String(run.databaseId), "--log-failed");
} catch {
  log = "";
}

const row = {
  runId: run.databaseId,
  head: run.headSha.slice(0, 8),
  at: run.createdAt,
  failedSteps: steps,
};

if (log.trim() === "") {
  row.measurable = false;
} else {
  const count = (word) => {
    const found = log.match(new RegExp(`(\\d+) ${word}`));
    return found === null ? null : Number(found[1]);
  };
  row.measurable = true;
  row.failed = count("failed");
  row.passed = count("passed");
  row.flaky = count("flaky") ?? 0;
  // Which error classes produced them, as a set of names rather than a count: a name tells a reader
  // whether a run belongs to this series at all, and cannot be mistaken for a size.
  row.errorKinds = [...new Set((log.match(/Error: expect\((?:locator|page|received)\)\.[a-zA-Z]+/g) ?? [])
    .map((one) => one.replace("Error: ", "")))].sort();
}

record.runs.push(row);
record.runs.sort((a, b) => (a.at < b.at ? -1 : 1));
writeFileSync(LOG, `${JSON.stringify(record, null, 2)}\n`);

console.log(`Recorded ${row.head} (${row.runId}): `
  + (row.measurable
    ? `${row.passed} passed, ${row.failed} failed, ${row.flaky} flaky  [${row.errorKinds.join(", ")}]`
    : "unmeasurable — log no longer served")
  + `\n  failing step(s): ${steps.join(", ") || "(none reported)"}`);

const measured = record.runs.filter((one) => one.measurable && one.failed !== null);
if (measured.length > 1) {
  const first = measured[0];
  const last = measured[measured.length - 1];
  const gone = record.runs.length - measured.length;
  console.log(`\nAcross ${measured.length} measurable run(s): ${first.failed} → ${last.failed} failed`
    + (gone > 0 ? `\n  ${gone} run(s) in this range could not be measured, so the interval is not continuous.` : ""));
}
