#!/usr/bin/env node
/**
 * The suite, judged against what it is already known to find.
 *
 * A hunt that files a red for every open defect makes a continuous-integration run permanently red,
 * and a permanently red run stops being read. The two things a run must still say are different from
 * each other and both are lost in that noise:
 *
 * - **a battle that was passing and is not any more** — a regression, and the only thing that should
 *   fail a build;
 * - **a battle that was failing and now passes** — a defect somebody closed, which must be recorded
 *   so the next regression in that battle is visible again.
 *
 * So the run is compared against a recorded baseline. A red that is in the baseline is expected and
 * costs nothing. A red that is not is a regression and fails. A green that is *in* the baseline is
 * reported loudly and **does not fail**: closing a defect must never be the thing that breaks a
 * build, or the incentive points the wrong way. It is accepted with `--accept`, which rewrites the
 * baseline from the run that produced it.
 *
 * The baseline is a list of test names, not a count. A count says a build got worse; a name says
 * which promise stopped being kept.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { buildFreshness } from "./build-freshness.mjs";

const HARNESS = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HARNESS, "..");
const REPO_ROOT = resolve(BATTLE_ROOT, "..");
export const BASELINE_FILE = join(BATTLE_ROOT, "reports", "known-red.json");

/**
 * Every test name TAP reported, split by how it ended.
 *
 * A `# TODO` or `# SKIP` directive is not a failure, and TAP writes both as `not ok`. Counting them
 * put seventeen battles into a first baseline that had twenty-nine real reds in it — a baseline that
 * forgives a todo is a baseline that would forgive it turning into a genuine break.
 */
export function readTap(tap) {
  const passed = new Set();
  const failed = new Set();
  const outside = new Set();
  // What a failing battle said, kept beside its name. A name alone is unreadable from anywhere but
  // the machine that produced it: a battle that fails only where the job runs cannot be reproduced
  // by whoever reads the log, and a report that names the battle while withholding its words leaves
  // them diagnosing by guessing at shapes. TAP puts it in the indented block after `not ok`.
  const why = new Map();
  // The whole directive, reason included: a name keeping "# SKIP not in this environment" matches no
  // baseline entry, so a battle that closes while carrying one reads as a battle that vanished.
  const DIRECTIVE = /\s#\s*(TODO|SKIP)\b.*$/i;
  // The runner names a battle by its title, which the harness prefixes with severity and claims.
  // Anything else that fails is not a battle: a file the runner names because it did not finish, or
  // one of the harness's own tests. Neither is a defect this suite has measured, so neither is
  // baselined.
  const BATTLE_TITLE = /^\[S\d/;
  let pending = null;
  let block = null;
  for (const line of tap.split("\n")) {
    // The YAML block belongs to the `not ok` above it, and ends at its `...`.
    if (pending !== null) {
      if (/^\s*---\s*$/.test(line)) { block = []; continue; }
      if (block !== null && /^\s*\.\.\.\s*$/.test(line)) {
        why.set(pending, block.join("\n"));
        pending = null; block = null; continue;
      }
      if (block !== null) { block.push(line.replace(/^\s{0,4}/, "")); continue; }
    }
    const ok = /^ok \d+ - (.+?)\s*$/.exec(line);
    if (ok) {
      const name = ok[1].replace(DIRECTIVE, "").trim();
      if (BATTLE_TITLE.test(name)) passed.add(name);
      continue;
    }
    const notOk = /^not ok \d+ - (.+?)\s*$/.exec(line);
    if (!notOk) continue;
    // A todo that fails is a todo. A todo that passes is reported by the runner as `ok`.
    if (DIRECTIVE.test(line)) continue;
    if (BATTLE_TITLE.test(notOk[1])) { failed.add(notOk[1]); pending = notOk[1]; }
    else outside.add(notOk[1]);
  }
  // A name that appears both ways is a retry or a duplicate title; the failure is what matters.
  for (const name of failed) passed.delete(name);
  return { passed, failed, outside, why };
}

/**
 * What changed between a run and the baseline.
 *
 * `regressions` fail a build. `closed` never do — they are the thing the hunt is for.
 */
/**
 * How a recorded name is matched, so two spellings of one separator are one name.
 *
 * A browser spec is recorded as `<file> \u203a <title>`, and a baseline written before that settled
 * carries a plain `>`. Compared as raw strings the two never meet: every red reads as a regression,
 * every recorded row as vanished, and the gate can neither refuse a new break nor confirm a repair.
 * Three sessions were repairing against it at the time.
 *
 * Normalised here rather than at each call site, because the comparison is the one place every path
 * goes through — and a baseline written by hand, or by an older version, keeps working.
 */
function comparableName(name) {
  return name.replace(" \u203a ", " > ");
}

export function compareWithBaseline(run, baseline) {
  const known = new Map(baseline.map((name) => [comparableName(name), name]));
  const failed = new Map([...run.failed].map((name) => [comparableName(name), name]));
  const passed = new Map([...run.passed].map((name) => [comparableName(name), name]));
  return {
    regressions: [...failed].filter(([key]) => !known.has(key)).map(([, name]) => name).sort(),
    closed: [...known].filter(([key]) => passed.has(key)).map(([, name]) => name).sort(),
    stillOpen: [...failed].filter(([key]) => known.has(key)).map(([, name]) => name).sort(),
    // A baseline entry that neither passed nor failed is a battle that no longer exists under that
    // name — a rename, or a deletion. Not a regression, but the baseline is wrong about the world.
    vanished: [...known].filter(([key]) => !passed.has(key) && !failed.has(key)).map(([, name]) => name).sort(),
  };
}

export function readBaseline(file = BASELINE_FILE) {
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed?.knownRed)) {
    throw new Error(`${relative(REPO_ROOT, file)} does not carry a knownRed array`);
  }
  return parsed.knownRed;
}

/**
 * The severity a battle's title carries, or `S9` for a name that carries none.
 *
 * The harness writes it into every title, so the list can be read by how much each open defect costs
 * without opening anything else.
 */
export function severityOf(name) {
  return /^\[(S\d)\]/.exec(name)?.[1] ?? "S9";
}

/** How many open reds there are, and how many at each severity. */
export function countBySeverity(names) {
  const counts = {};
  for (const name of names) {
    const severity = severityOf(name);
    counts[severity] = (counts[severity] ?? 0) + 1;
  }
  return Object.fromEntries(Object.keys(counts).sort().map((key) => [key, counts[key]]));
}

function writeBaseline(names, file = BASELINE_FILE) {
  // Severity first, then name: the file is read to decide what to repair next, and an S0 that sorts
  // under "a" while an S2 sorts under "A" is a list nobody can triage from.
  const ordered = [...names].sort((left, right) => {
    const bySeverity = severityOf(left).localeCompare(severityOf(right));
    return bySeverity !== 0 ? bySeverity : left.localeCompare(right);
  });
  const body = {
    note:
      "Battles that are red because the defect they describe is open. A red listed here does not " +
      "fail a build; a red that is not listed is a regression. Rewrite with `npm run battle:ci -- --accept`.",
    order:
      "Repair in severity order: every S0, then every S1, then S2 and below. `bySeverity` is the " +
      "count at each, and `knownRed` is sorted the same way, so the top of the list is the next work.",
    // Date and time, to the second, in UTC. A date alone cannot tell one of a day's runs from
    // another, and this file is read to decide what to repair next while three sessions are
    // repairing: which run a count came from is half of what the count means.
    recordedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    // The generative battles draw from this, so which names are here depends on it. A baseline
    // recorded under one seed and checked under another reports a regression that is a different
    // random walk rather than a new defect.
    seed: process.env.MDY_BATTLE_SEED ?? "(none — the run drew a fresh seed, so this list is one walk of many)",
    runs: process.env.MDY_BATTLE_RUNS ?? "(default)",
    openReds: ordered.length,
    bySeverity: countBySeverity(ordered),
    knownRed: ordered,
  };
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  writeRegisterSummary(body);
}

/**
 * The register's opening count, rewritten from the file a run just wrote.
 *
 * The two are read by different people for the same decision — what to repair next — and a count
 * kept by hand drifts the first time nobody remembers to change it. Only the fenced block is
 * touched, and a register without one is left alone rather than guessed at.
 *
 * That sentence was true of the prose beside the block as well, and went unnoticed there for as long
 * as it took somebody to read the two together: the register opened by naming a number of failing
 * battles and a suite size, both by hand, both wrong. The prose now points at the block instead of
 * repeating it — **a count stated once cannot disagree with itself** — which is the cheaper half of
 * what this function does and needed no code at all.
 */
export function writeRegisterSummary(body, file = join(BATTLE_ROOT, "reports", "open-findings.md")) {
  if (!existsSync(file)) return;
  const register = readFileSync(file, "utf8");
  // Every severity that has a row, however many there are: the block used to name S0, S1 and S2 and
  // nothing else, so the first S3 red raised the total without appearing in the list under it — the
  // rows and the total disagreed, and the section says the file is the one to believe.
  // The trailing lines are matched loosely and the word "node" optionally, so that adding a line to
  // what is written below cannot silently stop this from matching what it wrote last time — a block
  // that no longer matches is not an error here, it is a number that quietly stops being updated.
  const block = /```\nS0 +\d+ +the whole of it before any S1\n(?:S\d +\d+\n)* +--\n +\d+ +open (?:node )?reds, [\d:\- ]+(?:UTC)?\n(?: +\S[^\n]*\n)*```/;
  if (!block.test(register)) return;
  const at = (key) => String(body.bySeverity[key] ?? 0).padStart(2);
  const rows = [...new Set(["S0", ...Object.keys(body.bySeverity)])].sort()
    .map((key) => (key === "S0"
      ? `S0    ${at("S0")}      the whole of it before any S1`
      : `${key}    ${at(key)}`));
  const written = [
    "```",
    ...rows,
    "      --",
    `      ${String(body.openReds).padStart(2)}      open node reds, ${body.recordedAt.replace("T", " ").replace("Z", " UTC")}`,
    // **This gate sees one tier.** It runs the node battles and writes what they report; the browser
    // tier keeps a baseline of its own and never reaches this file. A reader who takes this total for
    // the project's total is reading a number that was never about the whole of it.
    "              the browser tier keeps its own count, in known-red-browser.json",
    "```",
  ].join("\n");
  writeFileSync(file, register.replace(block, written), "utf8");
}

function runSuite(pattern) {
  const result = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap", pattern],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  return result.stdout ?? "";
}

/**
 * The packages a run measures, checked against the source they were built from.
 *
 * This gate runs the suite; it does not build. Invoked on its own — rather than through `battle:ci`,
 * which builds first — it would report on whatever was last compiled, and a verdict about a build
 * nobody named is worth nothing whichever way it comes out. A closure recorded against a stale `dist`
 * is the worse half: a defect reads as repaired because the repair has not been compiled yet.
 */
/**
 * Every workspace package the suite imports, read off the suite itself.
 *
 * A fixed list goes out of date the moment a battle imports something new, and what it costs is not
 * a missing check: a package with no `dist` fails every battle that imports it, and each of those
 * reads as a regression against the baseline. Nineteen of them arrived in one run that way, all
 * saying `ERR_MODULE_NOT_FOUND` behind a name that sounded like a product defect.
 */
function packagesUnderMeasurement() {
  const found = new Set();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      // The node gate's own glob: the browser specs and the Angular tier are built and run by other
      // steps, and a name written in a comment is not an import.
      if (!path.endsWith(".mjs") || path.includes(`${sep}angular${sep}`)) continue;
      for (const match of readFileSync(path, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']@modyra\/([a-z0-9-]+)/g)) {
        if (existsSync(join(REPO_ROOT, "packages", match[1]))) found.add(match[1]);
      }
    }
  };
  walk(BATTLE_ROOT);
  return [...found].sort();
}

function assertBuildsAreCurrent() {
  const stale = [];
  const missing = [];
  for (const name of packagesUnderMeasurement()) {
    const freshness = buildFreshness(name);
    // `dist` absent is not "unknown": it is a package every battle that imports it will fail on,
    // for a reason that has nothing to do with what the battle claims.
    if (!existsSync(join(REPO_ROOT, "packages", name, "dist"))) { missing.push(`@modyra/${name}`); continue; }
    if (freshness.known && !freshness.fresh) stale.push(`@modyra/${name} (${freshness.behindBySeconds}s behind)`);
  }
  if (missing.length > 0) {
    console.error(
      `baseline check: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} imported by this ` +
        "suite and never built. Every battle that imports one fails with a resolution error, which " +
        "this gate would report as a regression. Build the workspace before measuring it.",
    );
    process.exit(2);
  }
  if (stale.length === 0) return;
  console.error(
    `baseline check: ${stale.join(", ")} built before last written. This gate does not build, so ` +
      "anything it reported would be about the older version. Run `npm run battle:ci`, which builds first.",
  );
  process.exit(2);
}

function main() {
  const accept = process.argv.includes("--accept");
  assertBuildsAreCurrent();
  const pattern = process.argv.find((a) => a.endsWith(".mjs") && a.includes("*")) ?? "battle-tests/**/*.test.mjs";

  const run = readTap(runSuite(pattern));
  if (run.passed.size + run.failed.size === 0) {
    console.error("baseline check: the run reported no tests at all, which is a broken run rather than a green one");
    process.exit(2);
  }

  if (accept) {
    writeBaseline(run.failed);
    console.log(`baseline check: recorded ${run.failed.size} known-red battle(s)`);
    for (const name of run.outside) console.log(`  not recorded, and not a battle: ${name}`);
    return;
  }

  const { regressions, closed, stillOpen, vanished } = compareWithBaseline(run, readBaseline());
  console.log(
    `baseline check: ${run.passed.size} green, ${run.failed.size} red — ` +
      `${stillOpen.length} known, ${regressions.length} new, ${closed.length} closed`,
  );
  for (const name of closed) console.log(`  CLOSED, update the baseline: ${name}`);
  for (const name of vanished) console.log(`  no longer in the suite under this name: ${name}`);
  for (const name of regressions) {
    console.log(`  REGRESSION: ${name}`);
    // Capped, because a battle that prints a page of state buries the next regression under it —
    // and the cap says so rather than truncating in silence.
    const said = (run.why?.get(name) ?? "").split("\n").filter((one) => one.trim() !== "");
    for (const line of said.slice(0, 12)) console.log(`      ${line}`);
    if (said.length > 12) console.log(`      … ${said.length - 12} more line(s), in the run's own output`);
  }

  // A failure outside any battle is never baselined — the baseline forgives a defect this suite has
  // measured, and a file that does not finish is not that. But it is also the one failure the run's
  // own load can invent, so each is offered a lone run before it is believed: a file that fails again
  // by itself has something wrong with it, and one that passes was competing with four hundred others.
  const stillOutside = [];
  for (const name of run.outside) {
    if (!existsSync(join(REPO_ROOT, name))) {
      stillOutside.push(name);
      continue;
    }
    const alone = readTap(runSuite(name));
    if (alone.outside.size > 0 || alone.failed.size > run.failed.size) stillOutside.push(name);
    else console.log(`  failed in the suite and passed alone, so it was the run and not the file: ${name}`);
  }
  for (const name of stillOutside) console.log(`  FAILED, AND NOT A BATTLE: ${name}`);

  if (stillOutside.length > 0) {
    console.error(
      `\n${stillOutside.length} failure(s) outside any battle, on a second look. A file that does not ` +
        "finish, or a broken harness, is not a known red whatever the battles reported.",
    );
    process.exit(1);
  }

  if (regressions.length > 0) {
    console.error(
      `\n${regressions.length} battle(s) that were not known to fail are failing. ` +
        "This is what a red build is for.",
    );
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) main();
