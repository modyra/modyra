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
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { compareWithBaseline } from "./against-baseline.mjs";
import { buildFreshness } from "./build-freshness.mjs";

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
  // One claim per block, so a claim's severity is the first one after its id rather than whichever
  // `severity:` a greedy read reaches first.
  for (const block of claimsSource.split(/\bid:\s*"/).slice(1)) {
    const id = block.slice(0, block.indexOf('"'));
    const severity = /severity:\s*"(S\d)"/.exec(block)?.[1];
    if (severity !== undefined) severityOfClaim.set(id, severity);
  }
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
  // Severity first, then name: the file is read to decide what to repair next.
  const severityOf = (name) => severities[name.split(" \u203a ")[0]] ?? "unknown";
  const ordered = [...names].sort((left, right) => {
    const bySeverity = severityOf(left).localeCompare(severityOf(right));
    return bySeverity !== 0 ? bySeverity : left.localeCompare(right);
  });
  const counts = {};
  for (const name of ordered) {
    counts[severityOf(name)] = (counts[severityOf(name)] ?? 0) + 1;
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

/** Every failing spec's file, read once, so a severity can be taken from the claims it names. */
function severitiesFor(names) {
  const files = {};
  for (const name of names) {
    const file = name.split(" \u203a ")[0];
    if (files[file] !== undefined) continue;
    const path = join(BATTLE_ROOT, "browser", file);
    files[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  return severitiesByFile(files, readFileSync(join(BATTLE_ROOT, "models", "claims.mjs"), "utf8"));
}

/**
 * Refusing to measure a page built before the code it renders.
 *
 * This tier has a third artefact the node tier does not: the host bundle under `.tmp-browser`, which
 * inlines `@modyra/plain` and everything it imports. So a stale reading survives two rebuilds — the
 * packages can be current and the page still be the old one — and what it produces is the worst kind
 * of red, a defect reported against code that no longer has it. Two findings were filed that way in
 * one night, one of them at the browser tier for exactly this reason.
 *
 * `battle:browser:ci` builds both before calling this. Running it, or `playwright test`, by hand does
 * not, which is when the page is a week old and says so to nobody.
 */
function assertPageIsCurrent() {
  const stale = [];
  const missing = [];
  for (const name of ["core", "widgets", "plain"]) {
    // Never built is not "unknown". On a fresh checkout `@modyra/core` has no `dist`, and this tier's
    // build step used to start at `build:plain` — so the page was compiled against nothing and the
    // job died 81 errors deep, every one of them the same missing module. Locally it passed, because
    // a developer's disk keeps a `dist` from the last time anything built it.
    if (!existsSync(join(REPO_ROOT, "packages", name, "dist"))) { missing.push(`@modyra/${name}`); continue; }
    const freshness = buildFreshness(name);
    if (freshness.known && !freshness.fresh) stale.push(`@modyra/${name} (${freshness.behindBySeconds}s behind its source)`);
  }
  if (missing.length > 0) {
    console.error(
      `browser baseline check: ${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} never been ` +
        "built, so the page under test was compiled against a package that is not there. " +
        "Run `npm run battle:browser:ci`, which builds them first.",
    );
    process.exit(2);
  }

  const host = join(BATTLE_ROOT, ".tmp-browser", "host.js");
  if (!existsSync(host)) {
    console.error(
      "browser baseline check: there is no host page to run against. Build it with " +
        "`npm run battle:browser:ci`, which builds the packages and the page before measuring.",
    );
    process.exit(2);
  }
  const builtAt = statSync(host).mtimeMs;
  for (const name of ["core", "widgets", "plain"]) {
    const dist = join(REPO_ROOT, "packages", name, "dist");
    if (!existsSync(dist)) continue;
    const distAt = newestUnder(dist);
    if (distAt !== null && distAt > builtAt) {
      stale.push(`the host page (@modyra/${name} was built ${Math.round((distAt - builtAt) / 1000)}s after it)`);
    }
  }

  if (stale.length === 0) return;
  console.error(
    `browser baseline check: ${stale.join(", ")}. What this measured would be an older version, and a ` +
      "red from it names a defect the code may no longer have. Run `npm run battle:browser:ci`, which builds first.",
  );
  process.exit(2);
}

/** The newest mtime under a directory — the same question `buildFreshness` asks of a package. */
function newestUnder(directory) {
  let newest = null;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    const at = entry.isDirectory() ? newestUnder(path) : statSync(path).mtimeMs;
    if (at !== null && (newest === null || at > newest)) newest = at;
  }
  return newest;
}

function main() {
  const accept = process.argv.includes("--accept");

  // Re-summarise what is already recorded, without a run. The list is the expensive part to produce
  // and the counts are derived from it, so a change to how severity is read costs nothing to apply.
  if (process.argv.includes("--recount")) {
    const names = readBaselineFile();
    writeBaselineFile(names, severitiesFor(names));
    console.log(`browser baseline check: re-counted ${names.length} known-red spec(s)`);
    return;
  }

  assertPageIsCurrent();

  const report = runSuite(join(mkdtempSync(join(tmpdir(), "mdy-browser-")), "report.json"));
  const run = readPlaywrightJson(report);

  if (run.passed.size + run.failed.size === 0) {
    console.error("browser baseline check: the run reported no specs at all, which is a broken run rather than a green one");
    process.exit(2);
  }

  const severities = severitiesFor([...run.failed]);

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
