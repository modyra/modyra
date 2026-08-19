/**
 * What the harness itself must guarantee.
 *
 * These are not battles: they attack the machinery every battle depends on. A suite whose reports
 * are not replayable, or which accepts a test that exercised nothing, produces green runs that mean
 * nothing at all — so the machinery is checked before anything it measures.
 *
 * @source-inspection — it builds a fake package with a `src` directory to exercise the freshness
 * check above. Nothing here reads the real packages.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { auditBlackBox, auditedFileCount } from "./black-box-audit.mjs";
import { diffCanonical, encodeValue, BattleHarnessError } from "../models/observations.mjs";
import { createOperationLog, assertExercised, EmptyBattleError } from "./operation-log.mjs";
import { assertFreshBuild, buildFreshness } from "./build-freshness.mjs";
import { createRng, runSeed } from "./seed.mjs";
import { claim } from "../models/claims.mjs";
import { replay } from "./replay.mjs";

const HARNESS_DIR = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HARNESS_DIR, "..");

/**
 * Run a fixture battle in its own process and hand back its exit code and output.
 *
 * The test-runner context is stripped from the child's environment: inherited, it makes the child
 * report into this process's runner and exit 0, which would turn "the fixture failed as designed"
 * into a silent pass — the exact shape of failure this file exists to rule out.
 */
function runFixture(name, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST")) delete env[key];
  }
  try {
    const stdout = execFileSync(process.execPath, ["--test", join(HARNESS_DIR, "self-check", name)], {
      encoding: "utf8",
      cwd: BATTLE_ROOT,
      env,
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

test("a failing battle writes a report that replays to the same state", async () => {
  // A directory of this check's own. The shared one holds the artefacts of every battle in the run,
  // so emptying it would destroy a real failure's evidence, and reading "whichever JSON is there"
  // would pick up another battle's report whenever one landed between the two steps.
  const reportsDir = mkdtempSync(join(tmpdir(), "mdy-battle-reports-"));

  const run = runFixture("failing-battle.fixture.mjs", { MDY_BATTLE_REPORTS: reportsDir });
  assert.notEqual(run.code, 0, "the deliberately failing battle must fail");
  assert.match(run.output, /Replay: npm run battle:replay/, "the failure names how to replay it");

  const found = existsSync(reportsDir) ? findReport(reportsDir) : undefined;
  const reports = found ? readFileSync(join(reportsDir, found), "utf8") : null;
  assert.ok(reports, "a failing battle writes a JSON artefact");

  const report = JSON.parse(reports);
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.claimIds, ["COL-001"]);
  assert.equal(report.severity, claim("COL-001").severity);
  assert.ok(report.operations.length > 0, "the report carries the operations that were executed");
  assert.ok(report.schema, "the report carries the schema as data");
  assert.ok(report.divergence, "the report names where the two states first disagreed");

  const outcome = await replay(report);
  assert.equal(outcome.reproduced, true, "replaying the report reaches the recorded state");

  rmSync(reportsDir, { recursive: true, force: true });
});

test("a battle that records no action fails", () => {
  const run = runFixture("empty-battle.fixture.mjs");
  assert.notEqual(run.code, 0, "an empty battle must not pass");
  assert.match(run.output, /battle did not do what it declared/);
});

test("assertExercised refuses a log that did nothing, and accepts one that did", () => {
  const log = createOperationLog();
  assert.throws(() => assertExercised(log), EmptyBattleError);

  log.record({ type: "record.upsert", path: "rows", key: "a" });
  log.asserted();
  assert.equal(assertExercised(log, ["structural"]).structural, 1);
  assert.throws(() => assertExercised(log, ["asyncStarted"]), EmptyBattleError);
});

test("assertExercised refuses a log that acted and concluded nothing", () => {
  const log = createOperationLog();
  log.record({ type: "record.upsert", path: "rows", key: "a" });
  log.record({ type: "mount", paths: ["rows.a.code"] });
  // Acted, and by every counter a battle can name: structural, mounted, and a note besides.
  log.note("mounted the row");
  assert.throws(() => assertExercised(log, ["structural", "mountedPhases"]), EmptyBattleError);

  log.asserted();
  assert.equal(assertExercised(log, ["structural", "mountedPhases"]).assertions, 1);
});

test("a battle citing an S0 or S1 claim may not report instead of failing", () => {
  const run = runFixture("open-blocker.fixture.mjs");
  assert.notEqual(run.code, 0, "an open battle on a blocking claim must not be accepted");
  assert.match(run.output, /cannot report without failing/);
});

test("a detail that cannot be produced does not replace the claim it was attached to", () => {
  const run = runFixture("unreportable-detail.fixture.mjs");
  assert.notEqual(run.code, 0, "a broken claim must still fail the run");
  // What matters is which failure comes out: the promise, not the reporting line.
  assert.match(run.output, /the promise this battle is about/);
  assert.match(run.output, /detail unavailable/);
  assert.doesNotMatch(run.output, /Converting circular structure/);
});

test("a battle that attacks and asserts nothing fails", () => {
  const run = runFixture("unchecked-battle.fixture.mjs");
  assert.notEqual(run.code, 0, "a battle that concluded nothing must not pass");
  assert.match(run.output, /assertions: needed > 0/);
});

test("the operation log refuses an operation that cannot be written down", () => {
  const log = createOperationLog();
  assert.throws(() => log.record({ type: "field.set", path: "a", value: () => 1 }), /non-serializable/);
  assert.throws(() => log.record({ type: "nonsense" }), /unknown operation type/);
});

test("the canonical encoding keeps apart what JSON would merge", () => {
  const withUndefined = encodeValue({ a: undefined });
  const withAbsent = encodeValue({});
  assert.ok(diffCanonical(withUndefined, withAbsent), "undefined and absent are different states");

  assert.notDeepEqual(encodeValue(new Date(0)), encodeValue(0));
  assert.notDeepEqual(encodeValue("1"), encodeValue(1));
  assert.deepEqual(encodeValue([1, 2]), [1, 2], "array order is preserved");

  const cyclic = { name: "row" };
  cyclic.self = cyclic;
  assert.throws(() => encodeValue(cyclic), BattleHarnessError, "a cycle is a harness error, not a truncation");
});

test("diffCanonical reports the first divergence and honours a narrow ignore list", () => {
  const left = { valid: true, mountedPaths: ["a"], value: { rows: { a: 1 } } };
  const right = { valid: true, mountedPaths: [], value: { rows: { a: 2 } } };

  assert.equal(diffCanonical(left, left), null);
  assert.equal(diffCanonical(left, right).path, "mountedPaths[0]");
  assert.equal(diffCanonical(left, right, { ignore: ["mountedPaths"] }).path, "value.rows.a");
});

test("the same seed produces the same sequence, and different runs differ", () => {
  const first = Array.from({ length: 8 }, () => createRng(4242).int(1000));
  const second = Array.from({ length: 8 }, () => createRng(4242).int(1000));
  assert.deepEqual(first, second, "a seed is a promise about what will happen");

  assert.notEqual(runSeed(4242, 1), runSeed(4242, 2));
  assert.equal(runSeed(4242, 1), runSeed(4242, 1));
});

test("citing an unregistered claim is an error", () => {
  assert.throws(() => claim("NOPE-999"), /unregistered claim/);
});

test("no battle test reaches past a package entry point", () => {
  assert.ok(auditedFileCount() > 10, "the audit must have a corpus to audit");
  assert.deepEqual(auditBlackBox(), [], "battle tests import published entry points only");
});

test("the black-box audit catches a source-level import", () => {
  const dir = mkdtempSync(join(tmpdir(), "battle-audit-"));
  try {
    writeFileSync(join(dir, "sneaky.mjs"), 'import { thing } from "../../packages/core/src/typed-form.js";\n');
    const violations = auditBlackBox(dir);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /workspace packages|implementation source/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function findReport(dir) {
  return readdirSync(dir).find((name) => name.endsWith(".json"));
}

test("a build older than its source is refused before anything is measured", () => {
  const root = mkdtempSync(join(tmpdir(), "mdy-freshness-"));
  try {
    const pkg = join(root, "packages", "sample");
    mkdirSync(join(pkg, "src"), { recursive: true });
    mkdirSync(join(pkg, "dist"), { recursive: true });

    // Built first, written second: the shape a fix in source and no rebuild leaves behind.
    writeFileSync(join(pkg, "dist", "index.js"), "export {};\n", "utf8");
    const built = Date.now() - 60_000;
    utimesSync(join(pkg, "dist", "index.js"), built / 1000, built / 1000);
    writeFileSync(join(pkg, "src", "index.ts"), "export {};\n", "utf8");

    const stale = buildFreshness("sample", { root });
    assert.equal(stale.known, true);
    assert.equal(stale.fresh, false);
    assert.ok(stale.behindBySeconds >= 30, `behind by ${stale.behindBySeconds}s`);
    assert.throws(() => assertFreshBuild("sample", { root }), /built before it was last written/);

    // And the other way round, so the guard is answering about the order rather than refusing any
    // package it is handed.
    //
    // A second past the source rather than `Date.now()`: a file written by `writeFileSync` carries a
    // sub-millisecond mtime and `utimesSync` stores whole milliseconds, so a rebuild stamped "now"
    // lands a fraction *before* a source written in the same millisecond. That made this check fail
    // about one run in five — a self-check that fails at random is the same problem as a battle that
    // does, and it costs more because it is what the rest is trusted on.
    const rebuilt = statSync(join(pkg, "src", "index.ts")).mtimeMs + 1000;
    utimesSync(join(pkg, "dist", "index.js"), rebuilt / 1000, rebuilt / 1000);
    const fresh = buildFreshness("sample", { root });
    assert.equal(fresh.fresh, true);
    assert.doesNotThrow(() => assertFreshBuild("sample", { root }));

    // A package with nothing to compare is not a failure — it is a question this cannot answer.
    const bare = join(root, "packages", "nodist");
    mkdirSync(join(bare, "src"), { recursive: true });
    writeFileSync(join(bare, "src", "index.ts"), "export {};\n", "utf8");
    assert.equal(buildFreshness("nodist", { root }).known, false);
    assert.doesNotThrow(() => assertFreshBuild("nodist", { root }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
