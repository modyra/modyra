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

/**
 * Every spec in the report, split by how it ended, and what a failing one said.
 *
 * The reason is kept because a name alone is unreadable from anywhere but the machine that produced
 * it. A spec that fails only on the platform the job runs on cannot be reproduced by the person
 * reading the log, so a report naming the spec and withholding its own words leaves them to diagnose
 * by guessing at shapes — which they will, and some of the guesses will be wrong.
 *
 * A skipped spec is neither passed nor failed.
 */
export function readPlaywrightJson(report) {
  const passed = new Set();
  const failed = new Set();
  const why = new Map();
  const walk = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        const name = `${suite.file ?? "unknown"} › ${spec.title}`;
        const results = (spec.tests ?? []).flatMap((test) => test.results ?? []);
        if (results.length === 0) continue;
        if (results.every((result) => result.status === "skipped")) continue;
        if (results.every((result) => result.status === "passed" || result.status === "skipped")) passed.add(name);
        else {
          failed.add(name);
          const said = results.find((result) => result.error?.message)?.error?.message;
          if (said !== undefined && !why.has(name)) why.set(name, said);
        }
      }
      walk(suite.suites);
    }
  };
  walk(report.suites);
  for (const name of failed) passed.delete(name);
  return { passed, failed, why };
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

/**
 * The claim ids a spec names that the registry does not have.
 *
 * A file citing one live id and one dead one ranks by the live one, and the dead one is dropped
 * without a word — so the header reads as two claims covered and is one. Where every id is dead the
 * file ranks `unknown` and recording already refuses it; this is the mixed case, which looks ranked.
 *
 * Reported rather than refused: the citation is wrong in the header, not in the run, and a red build
 * here would stop a tier over a line of prose. `a-claim-nobody-registered` is the check that holds
 * the whole suite to it.
 */
export function unresolvedClaimsByFile(files, claimsSource) {
  const registered = new Set(
    claimsSource.split(/\bid:\s*"/).slice(1).map((block) => block.slice(0, block.indexOf('"'))),
  );
  const found = {};
  for (const [file, source] of Object.entries(files)) {
    const cited = [...new Set((source.match(/Claims under attack:([^\n]*)/) ?? ["", ""])[1]
      .match(/\b[A-Z0-9]{2,4}-\d{3}\b/g) ?? [])];
    const dangling = cited.filter((id) => !registered.has(id));
    if (dangling.length > 0) found[file] = dangling;
  }
  return found;
}

function readBaselineFile() {
  if (!existsSync(BASELINE_FILE)) return [];
  const parsed = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  if (!Array.isArray(parsed?.knownRed)) throw new Error(`${relative(REPO_ROOT, BASELINE_FILE)} does not carry a knownRed array`);
  return parsed.knownRed;
}

/**
 * Refusing to record a red nobody can rank.
 *
 * A third of the specs name no claim, and a red among them lands as `unknown` — which sorts after
 * `S2`, so a release blocker would be filed below a styling difference and read as the least urgent
 * thing in the file. The list is read to decide what to repair next; a row that cannot be ranked is
 * worse there than a missing row.
 *
 * The debt only has to be paid where it costs something: a spec that is green needs no claim line,
 * and one that goes red needs one before it can be recorded.
 */
function assertRedsAreRanked(names, severities) {
  const unranked = [...names]
    .filter((name) => (severities[specFileOf(name)] ?? "unknown") === "unknown")
    .sort();
  if (unranked.length === 0) return;
  console.error(
    `browser baseline check: ${unranked.length} red spec(s) name no claim, so nothing can rank them ` +
      "against the rest. Add a `Claims under attack:` line to each file's header and run this again:\n  " +
      unranked.map((name) => specFileOf(name)).filter((file, at, all) => all.indexOf(file) === at).join("\n  "),
  );
  process.exit(2);
}

function writeBaselineFile(names, severities) {
  // Severity first, then name: the file is read to decide what to repair next.
  const severityOf = (name) => severities[specFileOf(name)] ?? "unknown";
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
    // Date and time, to the second, in UTC. A date alone cannot tell one of a day's runs from
    // another, and this file is read to decide what to repair next while three sessions are
    // repairing: which run a count came from is half of what the count means.
    recordedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
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

/**
 * The spec file a recorded name begins with.
 *
 * A name is `<file> \u203a <title>`, and a baseline written before that separator settled carries a
 * plain `>` instead. Splitting on one of the two turned every severity into `unknown` — which sorts
 * after `S2`, so seven release blockers read as the least urgent rows in the file. Both are accepted
 * here rather than in four places, and the file is normalised the next time a run records it.
 */
function specFileOf(name) {
  const at = name.indexOf(" \u203a ");
  if (at !== -1) return name.slice(0, at);
  const ascii = name.indexOf(" > ");
  return ascii === -1 ? name : name.slice(0, ascii);
}

/** Every failing spec's file, read once, so a severity can be taken from the claims it names. */
function severitiesFor(names) {
  const files = {};
  for (const name of names) {
    const file = specFileOf(name);
    if (files[file] !== undefined) continue;
    const path = join(BATTLE_ROOT, "browser", file);
    files[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  return severitiesByFile(files, readFileSync(join(BATTLE_ROOT, "models", "claims.mjs"), "utf8"));
}

/** Says which of a red spec's claims name nothing, since ranking hides it. */
function reportUnresolvedClaims(names) {
  const files = {};
  for (const name of names) {
    const file = specFileOf(name);
    if (files[file] !== undefined) continue;
    const path = join(BATTLE_ROOT, "browser", file);
    files[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  const dangling = unresolvedClaimsByFile(files, readFileSync(join(BATTLE_ROOT, "models", "claims.mjs"), "utf8"));
  const entries = Object.entries(dangling);
  if (entries.length === 0) return;
  console.warn(
    `browser baseline check: ${entries.length} red spec(s) name a claim the registry does not have, ` +
      "and were ranked by the rest:\n  " +
      entries.map(([file, ids]) => `${file}: ${ids.join(", ")}`).join("\n  "),
  );
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
/**
 * The packages the host page is built from, read off its own entry files.
 *
 * A fixed list is how this went wrong twice: the page imports `@modyra/lit` as well, and the tier's
 * build step did not make it, so on a fresh checkout esbuild could not resolve `@modyra/lit/ui` and
 * the job died before a single spec ran. A guard that names three packages cannot notice a fourth.
 */
function packagesTheHostImports() {
  const found = new Set();
  const roots = [join(BATTLE_ROOT, "browser", "host"), join(BATTLE_ROOT, "browser")];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(mjs|ts)$/.test(entry.name)) continue;
      const source = readFileSync(join(root, entry.name), "utf8");
      for (const match of source.matchAll(/from\s*["']@modyra\/([a-z0-9-]+)/g)) {
        if (existsSync(join(REPO_ROOT, "packages", match[1]))) found.add(match[1]);
      }
    }
  }
  // Styles is not imported by name — the host build copies its stylesheet — so it is named here.
  found.add("styles");
  return [...found].sort();
}

function assertPageIsCurrent() {
  const stale = [];
  const missing = [];
  // What the tier's own build step covers. A package outside it is stale until somebody builds it by
  // hand, and the message has to say so or the reader repeats the run that failed.
  // Derived from the script that does the building, because a list beside a growing command is a
  // list that goes stale silently: this one still said `core styles widgets plain lit` after the
  // tier had gained vue and react, so its remedy sent a reader to run a build the tier had just run.
  //
  // Followed through `npm run` rather than read off one line. `build:plain` compiles widgets as well
  // as plain, and a reader that stopped at the first line would drop widgets — the derivation would
  // then be wrong in the opposite direction from the hand-written list, which is not an improvement.
  const scripts = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).scripts ?? {};
  const BUILT_BY_THIS_TIER = new Set();
  const readBuildStep = (command, seen = new Set()) => {
    for (const [, name] of command.matchAll(/packages\/([a-z-]+)\/tsconfig\.json/g)) {
      BUILT_BY_THIS_TIER.add(name);
    }
    for (const [, step] of command.matchAll(/npm run (build:[a-z-]+)/g)) {
      if (seen.has(step)) continue;
      seen.add(step);
      // A step whose body this manifest does not carry still names its package: `build:styles` runs
      // in the package's own directory, so the name is the only thing there is to read.
      BUILT_BY_THIS_TIER.add(step.slice("build:".length));
      if (scripts[step]) readBuildStep(scripts[step], seen);
    }
  };
  readBuildStep(scripts["battle:browser:ci"] ?? "");
  const needsOwnBuild = new Set();
  const measured = packagesTheHostImports();
  for (const name of measured) {
    // Never built is not "unknown". On a fresh checkout `@modyra/core` has no `dist`, and this tier's
    // build step used to start at `build:plain` — so the page was compiled against nothing and the
    // job died 81 errors deep, every one of them the same missing module. Locally it passed, because
    // a developer's disk keeps a `dist` from the last time anything built it.
    if (!existsSync(join(REPO_ROOT, "packages", name, "dist"))) { missing.push(`@modyra/${name}`); continue; }
    const freshness = buildFreshness(name);
    if (freshness.known && !freshness.fresh) {
      stale.push(`@modyra/${name} (${freshness.behindBySeconds}s behind its source)`);
      // `battle:browser:ci` builds core, styles, plain and lit and stops there — `@modyra/angular`
      // goes through ng-packagr and is built by nothing this tier runs. Telling a reader to run the
      // script that just failed them sends them round the loop that produced the message.
      if (!BUILT_BY_THIS_TIER.has(name)) needsOwnBuild.add(name);
    }
  }
  if (missing.length > 0) {
    console.error(
      `browser baseline check: ${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} never been ` +
        "built, so the page under test was compiled against a package that is not there. " +
        "Run `npm run battle:browser:ci`, which builds them first.",
    );
    process.exit(2);
  }

  // The host directory is overridable so a run can measure a page built from a copy of a package
  // carrying a planted defect. Read here as well as in the guard: this comparison is the one that
  // runs first, and pointed at the default it answers about a page this run did not build.
  const hostDir = process.env.MDY_HOST_OUT ?? join(BATTLE_ROOT, ".tmp-browser");
  const host = join(hostDir, "host.js");
  if (!existsSync(host)) {
    console.error(
      "browser baseline check: there is no host page to run against. Build it with " +
        "`npm run battle:browser:ci`, which builds the packages and the page before measuring.",
    );
    process.exit(2);
  }
  const builtAt = statSync(host).mtimeMs;
  for (const name of measured) {
    const dist = join(REPO_ROOT, "packages", name, "dist");
    if (!existsSync(dist)) continue;
    const distAt = newestUnder(dist);
    if (distAt !== null && distAt > builtAt) {
      stale.push(`the host page (@modyra/${name} was built ${Math.round((distAt - builtAt) / 1000)}s after it)`);
    }
  }

  if (stale.length === 0) return;
  const remedy = needsOwnBuild.size === 0
    ? "Run `npm run battle:browser:ci`, which builds first."
    : `Run \`npm run ${[...needsOwnBuild].sort().map((name) => `build:${name}`).join("` and `npm run ")}\` first — ` +
      "`battle:browser:ci` does not build " +
      `${needsOwnBuild.size === 1 ? "it" : "them"} — then \`npm run battle:browser:ci\`.`;
  console.error(
    `browser baseline check: ${stale.join(", ")}. What this measured would be an older version, and a ` +
      `red from it names a defect the code may no longer have. ${remedy}`,
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
    const recounted = severitiesFor(names);
    assertRedsAreRanked(names, recounted);
    writeBaselineFile(names, recounted);
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
  reportUnresolvedClaims([...run.failed]);

  if (accept) {
    assertRedsAreRanked(run.failed, severities);
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
  for (const name of regressions) {
    console.log(`  REGRESSION: ${name}`);
    // The spec's own words, indented under it. Capped because a battle that dumps a page of DOM
    // buries the next regression under it, and the cap is stated rather than silent.
    const said = (run.why.get(name) ?? "").replace(/\u001b\[[0-9;]*m/g, "").trim();
    if (said !== "") {
      const lines = said.split("\n").slice(0, 12);
      for (const line of lines) console.log(`      ${line}`);
      const dropped = said.split("\n").length - lines.length;
      if (dropped > 0) console.log(`      … ${dropped} more line(s), in the run's own report`);
    }
  }

  if (regressions.length > 0) {
    console.error(`\n${regressions.length} spec(s) that were not known to fail are failing. This is what a red build is for.`);
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
