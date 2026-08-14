/**
 * What the harness itself must guarantee.
 *
 * These are not battles: they attack the machinery every battle depends on. A suite whose reports
 * are not replayable, or which accepts a test that exercised nothing, produces green runs that mean
 * nothing at all — so the machinery is checked before anything it measures.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { auditBlackBox, auditedFileCount } from "./black-box-audit.mjs";
import { diffCanonical, encodeValue, BattleHarnessError } from "../models/observations.mjs";
import { createOperationLog, assertExercised, EmptyBattleError } from "./operation-log.mjs";
import { createRng, runSeed } from "./seed.mjs";
import { claim } from "../models/claims.mjs";
import { replay } from "./replay.mjs";

const HARNESS_DIR = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HARNESS_DIR, "..");
const FAILURES_DIR = join(BATTLE_ROOT, "reports", "failures");

/**
 * Run a fixture battle in its own process and hand back its exit code and output.
 *
 * The test-runner context is stripped from the child's environment: inherited, it makes the child
 * report into this process's runner and exit 0, which would turn "the fixture failed as designed"
 * into a silent pass — the exact shape of failure this file exists to rule out.
 */
function runFixture(name) {
  const env = { ...process.env };
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
  rmSync(FAILURES_DIR, { recursive: true, force: true });

  const run = runFixture("failing-battle.fixture.mjs");
  assert.notEqual(run.code, 0, "the deliberately failing battle must fail");
  assert.match(run.output, /Replay: npm run battle:replay/, "the failure names how to replay it");

  const reports = existsSync(FAILURES_DIR)
    ? readFileSync(join(FAILURES_DIR, findReport(FAILURES_DIR)), "utf8")
    : null;
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
