/**
 * The browser tier's build colour, decided the way the node tier's is.
 *
 * A hunt that files a red for every open defect makes a continuous-integration run permanently red,
 * and a job that is always red is a job nobody reads. The node tier answers this with
 * `known-red.json`; this is the same mechanism for the tier that needs a browser, because that job
 * has been failing on seventy-three specs and telling nobody anything by it.
 *
 * Playwright has no TAP reporter, so the run is read from its JSON one. A spec is named
 * `<file> › <title>` — no line number, because a name that moves when an unrelated spec grows a line
 * is a name a baseline cannot hold.
 *
 * Severity is carried where a spec names its claims in its header and marked `unknown` where it does
 * not; a third of the specs name one. The count is what this file is read for.
 *
 *   node battle-tests/harness/against-browser-baseline.mjs [--accept]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { compareWithBaseline } from "./against-baseline.mjs";

const HARNESS = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HARNESS, "..");
const REPO_ROOT = resolve(BATTLE_ROOT, "..");
export const BASELINE_FILE = join(BATTLE_ROOT, "reports", "known-red-browser.json");

/** Every spec in the report, split by how it ended. A skipped spec is neither. */
export function readPlaywrightJson(report) {
  const passed = new Set();
  const failed = new Set();
  const walk = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        const name = `${suite.file ?? "unknown"} › ${spec.title}`;
        const results = (spec.tests ?? []).flatMap((test) => test.results ?? []);
        if (results.length === 0) continue;
        if (results.every((result) => result.status === "skipped")) continue;
        if (results.every((result) => result.status === "passed" || result.status === "skipped")) passed.add(name);
        else failed.add(name);
      }
      walk(suite.suites);
    }
  };
  walk(report.suites);
  for (const name of failed) passed.delete(name);
  return { passed, failed };
}

/**
 * The severities a spec's own header claims, or nothing.
 *
 * A browser spec's title carries no severity the way a battle's does, so it is read from the claim
 * ids the file names and the registry those belong to.
 */
export function severitiesByFile(files, claimsSource) {
  const severityOfClaim = new Map();
  const entries = claimsSource.matchAll(/id:\s*"([A-Z0-9-]+)"[\s\S]{0,400?}?severity:\s*"(S\d)"/g);
  for (const [, id, severity] of entries) severityOfClaim.set(id, severity);
  const found = {};
  for (const [file, source] of Object.entries(files)) {
    const ids = [...new Set((source.match(/\b[A-Z0-9]{2,4}-\d{3}\b/g) ?? []))];
    const severities = ids.map((id) => severityOfClaim.get(id)).filter(Boolean).sort();
    found[file] = severities[0] ?? "unknown";
  }
  return found;
}

function readBaselineFile() {
  if (!existsSync(BASELINE_FILE)) return [];
  const parsed = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  if (!Array.isArray(parsed?.knownRed)) throw new Error(`${relative(REPO_ROOT, BASELINE_FILE)} does not carry a knownRed array`);
  return parsed.knownRed;
}

function writeBaselineFile(names, severities) {
  const ordered = [...names].sort();
  const counts = {};
  for (const name of ordered) {
    const severity = severities[name.split(" › ")[0]] ?? "unknown";
    counts[severity] = (counts[severity] ?? 0) + 1;
  }
  const body = {
    note:
      "Browser specs that are red because the defect they describe is open. A red listed here does " +
      "not fail a build; a red that is not listed is a regression. Rewrite with " +
      "`npm run battle:browser:ci -- --accept`.",
    order:
      "Repair in severity order, as the node tier does. A spec's severity is the worst of the claims " +
      "its header names; `unknown` is a spec that names none, which is most of them.",
    recordedAt: new Date().toISOString().slice(0, 10),
    openReds: ordered.length,
    bySeverity: Object.fromEntries(Object.keys(counts).sort().map((key) => [key, counts[key]])),
    knownRed: ordered,
  };
  writeFileSync(BASELINE_FILE, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function runSuite(jsonPath) {
  // Playwright exits non-zero on any failure, which is the thing this gate exists to reinterpret.
  spawnSync(
    "npx",
    ["playwright", "test", "-c", "battle-tests/playwright.config.ts", "--reporter=json"],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath } },
  );
  if (!existsSync(jsonPath)) throw new Error("the browser run wrote no report, which is a broken run rather than a green one");
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

function main() {
  const accept = process.argv.includes("--accept");
  const report = runSuite(join(mkdtempSync(join(tmpdir(), "mdy-browser-")), "report.json"));
  const run = readPlaywrightJson(report);

  if (run.passed.size + run.failed.size === 0) {
    console.error("browser baseline check: the run reported no specs at all, which is a broken run rather than a green one");
    process.exit(2);
  }

  const files = {};
  for (const name of [...run.failed]) {
    const file = name.split(" › ")[0];
    const path = join(BATTLE_ROOT, "browser", file);
    if (files[file] === undefined) files[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  const severities = severitiesByFile(files, readFileSync(join(BATTLE_ROOT, "models", "claims.mjs"), "utf8"));

  if (accept) {
    writeBaselineFile(run.failed, severities);
    console.log(`browser baseline check: recorded ${run.failed.size} known-red spec(s)`);
    return;
  }

  const { regressions, closed, stillOpen, vanished } = compareWithBaseline(run, readBaselineFile());
  console.log(
    `browser baseline check: ${run.passed.size} green, ${run.failed.size} red — ` +
      `${stillOpen.length} known, ${regressions.length} new, ${closed.length} closed`,
  );
  for (const name of closed) console.log(`  CLOSED, update the baseline: ${name}`);
  for (const name of vanished) console.log(`  no longer in the suite under this name: ${name}`);
  for (const name of regressions) console.log(`  REGRESSION: ${name}`);

  if (regressions.length > 0) {
    console.error(`\n${regressions.length} spec(s) that were not known to fail are failing. This is what a red build is for.`);
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
