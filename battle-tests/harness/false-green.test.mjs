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

import { createOperationLog, assertExercised, EmptyBattleError } from "./operation-log.mjs";
import { createRng, runSeed, resolveSeed, runCount } from "./seed.mjs";
import { shrink } from "./shrinking.mjs";
import { replay } from "./replay.mjs";
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
