/**
 * A conformance section reports what it established, never what it could not look at.
 *
 * `Multi-instance isolation` intersects the ids two live instances put on the page. Two instances
 * that mint no id produce an empty intersection, which reads identically to two that mint ids and
 * keep them apart — so a renderer with no ids at all would be declared isolated on the strength of
 * the thing being absent.
 *
 * The suite already refuses this shape elsewhere: a section it cannot reach is reported as not run,
 * with the reason. These hold that rule for the section that used to pass instead, and they run in
 * both directions — a skip that swallowed a real collision would be the same defect inverted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const BIN = "packages/widgets/bin/modyra-conformance.mjs";
const CONFIG = "packages/widgets/test/fixtures/ids.conformance.config.mjs";

/**
 * A renderer under test may legitimately be non-conformant — this fixture draws no anatomy, so it
 * is — and the exit code says so. What is read is the report it printed on its way out.
 */
function report(mode) {
  const options = { cwd: root, encoding: "utf8", env: { ...process.env, MDY_FIXTURE_IDS: mode } };
  try {
    return execFileSync(process.execPath, [BIN, CONFIG], options);
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.length > 0) return error.stdout;
    throw error;
  }
}

/** The section's marker and the line under it, which is where a reason or a finding lands. */
function isolation(mode) {
  const lines = report(mode).split("\n");
  const at = lines.findIndex((line) => line.includes("Multi-instance isolation"));
  assert.notEqual(at, -1, `the ${mode} run never reported the section`);
  return { marker: lines[at].trim()[0], detail: (lines[at + 1] ?? "").trim() };
}

test("a renderer that mints no id does not pass the section", () => {
  const { marker, detail } = isolation("none");
  assert.equal(marker, "~", "a section with no subject to look at reports as not run");
  assert.match(detail, /no kind emitted an id/);
});

test("a renderer that mints ids per scope passes it outright", () => {
  const { marker, detail } = isolation("all");
  assert.equal(marker, "✓");
  assert.doesNotMatch(detail, /not established/, "every kind was answerable, so nothing is owed");
});

test("a kind without ids is named even when its siblings have them", () => {
  const { marker, detail } = isolation("partial");
  assert.equal(marker, "✓", "the kinds that could be asked were asked");
  assert.match(detail, /not established for checkbox/);
});

test("two instances sharing an id still fail the section", () => {
  const { marker, detail } = isolation("collide");
  assert.equal(marker, "✗", "the skip must not swallow the defect the section exists to catch");
  assert.match(detail, /ID_COLLIDED_ACROSS_INSTANCES/);
});
