/**
 * The ways this suite could go green while proving nothing.
 *
 * `harness.test.mjs` checks that the machinery does its job. This file checks the opposite: that
 * each way of doing the job badly is caught. Every case here is a run that would look clean — a
 * campaign that generated nothing, a comparison that could not tell two different values apart, a
 * report that replayed a shorter sequence than the one that failed, a shrinker that removed the
 * operation the break depended on.
 *
 * A false green is worse than a red, because a red gets investigated.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createOperationLog, assertExercised, EmptyBattleError } from "./operation-log.mjs";
import { createRng, runSeed, resolveSeed, runCount } from "./seed.mjs";
import { shrink } from "./shrinking.mjs";
import { replay } from "./replay.mjs";
import { buildReport, formatSummary } from "./reporting.mjs";
import { createBattleContext } from "./context.mjs";
import { diffCanonical, encodeValue } from "../models/observations.mjs";
import { KEYED_ROWS_SPEC } from "../models/schemas.mjs";

test("a campaign that generated only no-ops fails instead of passing", () => {
  const log = createOperationLog();

  // A generator that drew nothing but reads is the shape a narrowed weighting produces: the run
  // executes, the clock advances, and not one row is declared.
  for (let index = 0; index < 40; index += 1) log.note("generated a no-op", { index });
  log.asserted();

  assert.throws(() => assertExercised(log, ["structural"]), EmptyBattleError);
  assert.throws(() => assertExercised(log, ["mountedPhases"]), EmptyBattleError);
  assert.throws(() => assertExercised(log, ["asyncStarted"]), EmptyBattleError);

  // And the counters are not merely absent — they are zero, which is what the message has to say.
  try {
    assertExercised(log, ["structural"]);
    assert.fail("expected the empty campaign to be refused");
  } catch (error) {
    assert.match(error.message, /structural: needed > 0, got 0/);
  }
});

test("a run without a declared seed still reports one that reproduces it", async () => {
  // Not an error: a local run draws its own seed deliberately. What it may never do is draw one it
  // cannot report, because then a failure found by chance is a failure nobody can replay.
  //
  // The module memoises the seed for the process, which is the point — every battle in a run shares
  // it — so a fresh instance is loaded to observe the drawing rather than the cached answer.
  const fresh = await import("./seed.mjs?draw-a-seed");
  const drawn = fresh.resolveSeed({});
  assert.equal(Number.isInteger(drawn), true, "a seed is always available");
  assert.equal(drawn >= 0, true);

  const first = createRng(runSeed(drawn, 3));
  const second = createRng(runSeed(drawn, 3));
  const draw = (rng) => Array.from({ length: 12 }, () => rng.int(1000));
  assert.deepEqual(draw(first), draw(second), "the reported seed reproduces the run exactly");

  const other = createRng(runSeed(drawn, 4));
  assert.notDeepEqual(draw(createRng(runSeed(drawn, 3))), draw(other), "different runs differ");
});

test("a malformed seed or run count is refused rather than silently replaced", async () => {
  // One fresh module per assertion: the first call is the only one that reads the environment, so a
  // shared instance would answer the second from its cache and the check would pass without looking.
  const first = await import("./seed.mjs?bad-seed");
  assert.throws(() => first.resolveSeed({ MDY_BATTLE_SEED: "not-a-number" }), /must be a non-negative integer/);
  const second = await import("./seed.mjs?negative-seed");
  assert.throws(() => second.resolveSeed({ MDY_BATTLE_SEED: "-1" }), /must be a non-negative integer/);
  assert.throws(() => runCount(25, { MDY_BATTLE_RUNS: "0" }), /must be a positive integer/);
  assert.throws(() => runCount(25, { MDY_BATTLE_RUNS: "1.5" }), /must be a positive integer/);
});

test("the comparison tells apart every pair of values JSON would blur", () => {
  // The six shapes a form's value can hold that a naive comparison merges. Each is compared against
  // every other: a differ that missed one pair would let a real divergence through in exactly the
  // case where "the value looks the same" is the defect.
  const shapes = {
    absent: {},
    undefined: { cell: undefined },
    null: { cell: null },
    nan: { cell: Number.NaN },
    emptyString: { cell: "" },
    record: { cell: {} },
    array: { cell: [] },
  };

  const names = Object.keys(shapes);
  for (const left of names) {
    for (const right of names) {
      const divergence = diffCanonical(
        encodeValue(shapes[left], "left"),
        encodeValue(shapes[right], "right"),
      );
      if (left === right) {
        assert.equal(divergence, null, `${left} must equal itself`);
      } else {
        assert.notEqual(divergence, null, `${left} and ${right} must not compare equal`);
      }
    }
  }
});

test("shrinking never drops the operation the break depended on", async () => {
  const causal = { type: "record.remove", path: "rows", key: "a" };
  const sequence = [
    { type: "record.upsert", path: "rows", key: "a", value: { code: "A" } },
    { type: "field.set", path: "rows.a.note", value: "one" },
    { type: "field.set", path: "rows.a.note", value: "two" },
    { type: "field.touch", path: "rows.a.note" },
    causal,
    { type: "record.upsert", path: "rows", key: "b", value: { code: "B" } },
    { type: "field.set", path: "rows.b.note", value: "three" },
  ];

  // The break exists only while the removal is in the sequence. A shrinker that reported a shorter
  // sequence without it would hand a maintainer a case that does not reproduce.
  const stillFails = (candidate) => candidate.some((operation) => operation.type === "record.remove");
  const { minimized } = await shrink(sequence, stillFails);

  assert.ok(minimized.some((operation) => operation.type === "record.remove"), "the causal operation survived");
  assert.ok(minimized.length < sequence.length, "the sequence was actually reduced");
  assert.equal(stillFails(minimized), true, "the reported sequence still reproduces");
});

test("shrinking keeps every operation when none of them may be removed", async () => {
  const sequence = [
    { type: "record.upsert", path: "rows", key: "a", value: { code: "A" } },
    { type: "field.set", path: "rows.a.note", value: "one" },
  ];

  // Every operation is load-bearing, so the honest answer keeps all of them — not a shorter sequence
  // that no longer fails, and not an empty one. The values may still be simplified: reducing what a
  // cell was set to is the shrinker's second pass, and a report that says `"x"` where the campaign
  // drew `"one"` is still the same break stated more plainly.
  const { minimized } = await shrink(sequence, (candidate) => candidate.length === sequence.length);

  assert.equal(minimized.length, sequence.length, "no operation was dropped");
  assert.deepEqual(
    minimized.map((operation) => operation.type),
    sequence.map((operation) => operation.type),
    "the sequence kept its shape",
  );
});

test("replaying a report whose log is missing an operation says it did not reproduce", async () => {
  const context = createBattleContext({ spec: KEYED_ROWS_SPEC });
  const operations = [
    { type: "record.upsert", path: "rows", key: "a", value: { code: "A" } },
    { type: "record.upsert", path: "rows", key: "b", value: { code: "B" } },
  ];
  for (const operation of operations) await context.execute(operation);
  const recorded = context.observe("both rows declared");
  await context.dispose();

  // The report says two rows were declared and carries only the first operation — a log that lost
  // something the attack did. Replay has to say so rather than print a state and call it a match.
  const outcome = await replay({
    schema: KEYED_ROWS_SPEC,
    operations: operations.slice(0, 1),
    actual: recorded,
  });

  assert.equal(outcome.comparable, true, "the recorded state is a canonical observation");
  assert.equal(outcome.reproduced, false, "an incomplete log must not report reproduction");
  assert.ok(outcome.divergence, "and it must name where the two states disagreed");

  // The control: the same report with its whole log does reproduce, so the check above is failing
  // for the missing operation rather than for anything else about the report's shape.
  const whole = await replay({ schema: KEYED_ROWS_SPEC, operations, actual: recorded });
  assert.equal(whole.reproduced, true, "the complete log reproduces the recorded state");
});

test("a report that cannot be re-run does not print a command that pretends it can", () => {
  const base = {
    claimIds: ["COL-001"],
    severity: "S1",
    seed: 7,
    environment: { name: "node", runtime: "node" },
    message: "a break",
    operations: [],
  };

  // A battle that attacks the public API directly has no schema and no sequence. Its report is a
  // record; offering a replay command on it points the reader at a crash, and a reader who runs it
  // and sees no failure learns the opposite of the truth.
  const record = buildReport({ ...base, schema: null });
  assert.equal(record.replayCommand, null, "a report with no schema offers no replay");
  assert.match(formatSummary(record), /Replay: none/);

  // A schema with nothing to drive it rebuilds an untouched form. Comparing that against the state
  // a battle recorded would report a divergence the sequence never caused.
  const nothingToDrive = buildReport({ ...base, schema: KEYED_ROWS_SPEC });
  assert.equal(nothingToDrive.replayCommand, null, "a schema alone is not a replayable report");

  const replayable = buildReport({
    ...base,
    schema: KEYED_ROWS_SPEC,
    operations: [{ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } }],
  });
  assert.ok(replayable.replayCommand, "a report carrying both halves says how to re-run it");
  assert.match(formatSummary(replayable), /Replay: npm run battle:replay/);
});

test("the replay command answers about the report it was given, separator or not", async () => {
  const context = createBattleContext({ spec: KEYED_ROWS_SPEC });
  const operations = [
    { type: "record.upsert", path: "rows", key: "a", value: { code: "A" } },
    { type: "field.set", path: "rows.a.note", value: "one" },
  ];
  for (const operation of operations) await context.execute(operation);
  const actual = context.observe("after the sequence");
  await context.dispose();

  const dir = mkdtempSync(join(tmpdir(), "mdy-replay-"));
  const write = (name, report) => {
    const file = join(dir, name);
    writeFileSync(file, JSON.stringify(report), "utf8");
    return file;
  };
  const run = (...args) =>
    spawnSync(process.execPath, [fileURLToPath(new URL("./replay.mjs", import.meta.url)), ...args], {
      encoding: "utf8",
    });

  try {
    const good = write("reproduces.json", {
      failureId: "SELF-CHECK-1",
      message: "a sequence that reproduces",
      seed: 1,
      schema: KEYED_ROWS_SPEC,
      operations,
      actual,
    });

    const plain = run(good);
    assert.equal(plain.status, 0, `a reproducing report exits clean: ${plain.stderr}`);
    assert.match(plain.stdout, /Reproduced/);

    // `npm run` eats the separator before the script sees it; pnpm hands it through. The command
    // printed on every report is the same string under both, so a bare separator must not be read
    // as the file to replay.
    const separated = run("--", good);
    assert.equal(separated.status, 0, `the separator is not an argument: ${separated.stderr}`);
    assert.equal(separated.stdout, plain.stdout, "the separator changed nothing about the answer");

    // And the answer it must never give: a report it cannot rebuild is refused, not called clean.
    const unreplayable = write("record.json", {
      failureId: "SELF-CHECK-2",
      message: "a battle that attacked the API directly",
      seed: 1,
      schema: null,
      operations: [],
      actual,
    });
    const refused = run(unreplayable);
    assert.notEqual(refused.status, 0, "an unreplayable report must not exit as though it passed");
    assert.match(refused.stderr, /Not replayable/);

    // A report that carries a state the tool cannot compare is the same answer for a different
    // reason: the sequence ran, and reproduction is still unproven.
    const incomparable = write("projection.json", {
      failureId: "SELF-CHECK-3",
      message: "a battle comparing its own projection",
      seed: 1,
      schema: KEYED_ROWS_SPEC,
      operations,
      actual: { rows: { a: { code: "A" } } },
    });
    const unproven = run(incomparable);
    assert.notEqual(unproven.status, 0, "'I could not tell' must not exit as 'verified'");
    assert.match(unproven.stderr, /Not verified/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a differential that compares two inert things is not a comparison", () => {
  // The way a differential passes while proving nothing, twice over in one night: two construction
  // routes were compared on a field declared `required` in a spelling the contract does not have,
  // through a route that needed a second call to compile any rule at all. Neither form enforced
  // anything, the two agreed perfectly, and the check was green.
  //
  // The guard is not a comparison at all — it is the demand that each side *bite* before the two are
  // put side by side. This is that demand written down: a rule that refuses nothing cannot be the
  // subject of a differential, however well the two sides agree about it.
  const inert = () => [];
  const enforcing = (value) => (value === "" ? [{ path: "a", message: "required" }] : []);

  const compare = (left, right, value) => JSON.stringify(left(value)) === JSON.stringify(right(value));

  // Two inert rules agree about everything, which is what makes agreement alone worthless.
  assert.equal(compare(inert, inert, ""), true, "two rules that do nothing agree");
  assert.equal(compare(inert, inert, "filled"), true);

  // The check a differential owes: at least one side must refuse the value being compared.
  const bites = (rule, value) => rule(value).length > 0;
  assert.equal(bites(inert, ""), false, "an inert rule refuses nothing, whatever it is given");
  assert.equal(bites(enforcing, ""), true, "an enforcing rule refuses the value it exists to refuse");

  // And the pair that is worth comparing: both bite, and they agree.
  assert.equal(bites(enforcing, "") && compare(enforcing, enforcing, ""), true);

  // The failure the guard catches: one side enforces and the other does not. Without the bite check
  // this is the only case a differential notices, and it is the *less* likely of the two.
  assert.equal(compare(inert, enforcing, ""), false, "an inert side and an enforcing side disagree");
});

test("a comparison of what a form holds is not a comparison of what it enforces", async () => {
  // The second shape of the same mistake, from the same night: a draft restored a row at a time was
  // compared by its keys, which a partial restore keeps intact while emptying the cells. The check
  // was green because it was looking at the half of the state the defect does not touch.
  const before = { rows: { a: { code: "A" }, b: { code: "B" } } };
  const partiallyRestored = { rows: { a: { code: "A" }, b: { code: "" } } };

  const byKeys = (left, right) =>
    JSON.stringify(Object.keys(left.rows)) === JSON.stringify(Object.keys(right.rows));
  const byValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

  assert.equal(byKeys(before, partiallyRestored), true, "the keys survive a partial restore");
  assert.equal(byValue(before, partiallyRestored), false, "the value does not");
});
