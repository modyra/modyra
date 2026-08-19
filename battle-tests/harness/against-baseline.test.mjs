/**
 * What the gate that decides a build's colour must guarantee.
 *
 * This is not a battle: it attacks the instrument every battle's verdict passes through. A gate that
 * reads TAP wrongly either hides a regression or records a name no battle has, and both are worse
 * than a red build — one is a green lie, the other a baseline that drifts until nobody trusts it.
 *
 * The reader's rule is that a battle is named by its title, which the harness prefixes with severity
 * and claims. Everything else the runner reports — a file it names because the process did not
 * finish, a harness test of its own — is a failure that is not a battle, and is never baselined.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { compareWithBaseline, readTap } from "./against-baseline.mjs";

const TAP = [
  "TAP version 13",
  "ok 1 - [S2][X-001] a battle that passes",
  "not ok 2 - [S1][Y-001] a battle that fails",
  "not ok 3 - [S1][Z-001] a battle whose defect is open # TODO reported, not enforced",
  "ok 4 - [S1][Z-002] a battle that passes under a directive # SKIP not in this environment",
  "not ok 5 - battle-tests/adversarial/x/a-file-that-did-not-finish.battle.test.mjs",
  "ok 6 - battle-tests/adversarial/x/a-file-that-did.battle.test.mjs",
  "not ok 7 - the harness itself, tested",
].join("\n");

test("a battle is named by its title, and nothing else is a battle", () => {
  const run = readTap(TAP);
  assert.deepEqual([...run.passed], ["[S2][X-001] a battle that passes", "[S1][Z-002] a battle that passes under a directive"]);
  assert.deepEqual([...run.failed], ["[S1][Y-001] a battle that fails"]);
  assert.deepEqual([...run.outside], [
    "battle-tests/adversarial/x/a-file-that-did-not-finish.battle.test.mjs",
    "the harness itself, tested",
  ]);
});

test("a directive is not a failure, whichever way the runner writes it", () => {
  const run = readTap(TAP);
  assert.ok(!run.failed.has("[S1][Z-001] a battle whose defect is open"));
  assert.ok(!run.outside.has("[S1][Z-001] a battle whose defect is open"));
});

test("a name that both passed and failed counts as failed", () => {
  const run = readTap([
    "ok 1 - [S1][A-001] a battle that was retried",
    "not ok 2 - [S1][A-001] a battle that was retried",
  ].join("\n"));
  assert.deepEqual([...run.failed], ["[S1][A-001] a battle that was retried"]);
  assert.equal(run.passed.size, 0);
});

test("the baseline forgives what it lists and nothing else", () => {
  const run = readTap([
    "not ok 1 - [S1][A-001] a defect that is open",
    "not ok 2 - [S1][B-001] a defect nobody knew about",
    "ok 3 - [S1][C-001] a defect that was closed",
  ].join("\n"));
  const { regressions, closed, stillOpen, vanished } = compareWithBaseline(run, [
    "[S1][A-001] a defect that is open",
    "[S1][C-001] a defect that was closed",
    "[S1][D-001] a battle under a name the suite no longer has",
  ]);
  assert.deepEqual(regressions, ["[S1][B-001] a defect nobody knew about"]);
  assert.deepEqual(closed, ["[S1][C-001] a defect that was closed"]);
  assert.deepEqual(stillOpen, ["[S1][A-001] a defect that is open"]);
  assert.deepEqual(vanished, ["[S1][D-001] a battle under a name the suite no longer has"]);
});

test("a run that reported nothing is not a green run", () => {
  const run = readTap("TAP version 13\n1..0\n");
  assert.equal(run.passed.size + run.failed.size, 0);
});
