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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

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
  // The whole directive, reason included: a name keeping "# SKIP not in this environment" matches no
  // baseline entry, so a battle that closes while carrying one reads as a battle that vanished.
  const DIRECTIVE = /\s#\s*(TODO|SKIP)\b.*$/i;
  // The runner names a battle by its title, which the harness prefixes with severity and claims.
  // Anything else that fails is not a battle: a file the runner names because it did not finish, or
  // one of the harness's own tests. Neither is a defect this suite has measured, so neither is
  // baselined.
  const BATTLE_TITLE = /^\[S\d/;
  for (const line of tap.split("\n")) {
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
    if (BATTLE_TITLE.test(notOk[1])) failed.add(notOk[1]);
    else outside.add(notOk[1]);
  }
  // A name that appears both ways is a retry or a duplicate title; the failure is what matters.
  for (const name of failed) passed.delete(name);
  return { passed, failed, outside };
}

/**
 * What changed between a run and the baseline.
 *
 * `regressions` fail a build. `closed` never do — they are the thing the hunt is for.
 */
export function compareWithBaseline(run, baseline) {
  const known = new Set(baseline);
  return {
    regressions: [...run.failed].filter((name) => !known.has(name)).sort(),
    closed: [...known].filter((name) => run.passed.has(name)).sort(),
    stillOpen: [...run.failed].filter((name) => known.has(name)).sort(),
    // A baseline entry that neither passed nor failed is a battle that no longer exists under that
    // name — a rename, or a deletion. Not a regression, but the baseline is wrong about the world.
    vanished: [...known].filter((name) => !run.passed.has(name) && !run.failed.has(name)).sort(),
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

function writeBaseline(names, file = BASELINE_FILE) {
  const body = {
    note:
      "Battles that are red because the defect they describe is open. A red listed here does not " +
      "fail a build; a red that is not listed is a regression. Rewrite with `npm run battle:ci -- --accept`.",
    recordedAt: new Date().toISOString().slice(0, 10),
    knownRed: [...names].sort(),
  };
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, "utf8");
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

function main() {
  const accept = process.argv.includes("--accept");
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
  for (const name of regressions) console.log(`  REGRESSION: ${name}`);

  for (const name of run.outside) console.log(`  FAILED, AND NOT A BATTLE: ${name}`);

  // Never baselined: the baseline forgives a defect this suite has measured, and a file that does
  // not finish or a harness test that breaks is not that.
  if (run.outside.size > 0) {
    console.error(
      `\n${run.outside.size} failure(s) outside any battle. A file that does not finish, or a broken ` +
        "harness, is not a known red whatever the battles reported.",
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
