/**
 * Comparing renderers finds disagreement, and cannot find agreement that is wrong.
 *
 * Two renderers of one contract that disagree mean at least one is wrong, and a form drawn two ways
 * is two products — that is the half this catches, and it is the half a person meets.
 *
 * The other half it cannot reach, and the limit is stated here rather than discovered later: a
 * property all three get wrong in the same way passes silently. That has already happened in this
 * repository — three renderers agreed on a target size below the threshold, and on a position no
 * baseline had recorded. Agreement is evidence of consistency and of nothing else.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareReadings, reading, unread } from "../dist/testing/index.js";

const WHERE = { source: "input", at: "text.control", method: "getAttribute" };
const from = (name, entries) => ({
  name,
  readings: entries.map(([label, make]) => ({ label, reading: make() })),
});

test("two renderers that answer the same thing diverge nowhere", () => {
  const left = from("plain", [["id", () => reading(WHERE, () => "a")]]);
  const right = from("lit", [["id", () => reading(WHERE, () => "a")]]);
  assert.deepEqual(compareReadings(left, right), []);
});

test("two that answer differently are reported with both answers", () => {
  const left = from("plain", [["name", () => reading(WHERE, () => "Code")]]);
  const right = from("lit", [["name", () => reading(WHERE, () => "code")]]);
  const [only] = compareReadings(left, right);
  assert.equal(only.kind, "values");
  assert.equal(only.left, "Code");
  assert.equal(only.right, "code");
});

test("one that could not look is not the same as one that disagreed", () => {
  // A probe that failed on one renderer is usually a defect in the probe, and calling it a
  // divergence sends a reader to compare two renderers over a question neither was asked.
  const left = from("plain", [["id", () => reading(WHERE, () => "a")]]);
  const right = from("lit", [["id", () => reading(WHERE, () => undefined)]]);
  assert.equal(compareReadings(left, right)[0].kind, "one-unread");
});

test("two that could not look agree about nothing, and it is reported", () => {
  // The defect the reading layer exists to remove, reappearing one level up: a comparison that
  // treated two blanks as a match would report its own blindness as success.
  const left = from("plain", [["id", () => unread("absent-probe", "text.control")]]);
  const right = from("lit", [["id", () => unread("threw", "text.control")]]);
  const [only] = compareReadings(left, right);
  assert.equal(only.kind, "both-unread");
  assert.match(only.left, /not read/);
  assert.match(only.right, /not read/);
});

test("a question asked of one renderer only is a gap, not a disagreement", () => {
  const left = from("plain", [["id", () => reading(WHERE, () => "a")]]);
  const right = from("lit", []);
  const [only] = compareReadings(left, right);
  assert.equal(only.kind, "one-unread");
  assert.match(only.right, /not-attempted/);
});

test("agreement on a wrong answer is invisible here, by construction", () => {
  // Asserted so the limit is a property of the suite rather than a paragraph nobody reads. If this
  // ever fails, something started comparing against a threshold and the comment above is stale.
  const wrong = () => reading(WHERE, () => "20px");
  const left = from("plain", [["target size", wrong]]);
  const right = from("lit", [["target size", wrong]]);
  assert.deepEqual(
    compareReadings(left, right),
    [],
    "this instrument reported something about correctness, which it has no way to know",
  );
});
