/**
 * A conformance section reports what it established, never what it could not look at.
 *
 * `Multi-instance isolation` intersects the ids two live instances put on the page. Two instances
 * that mint no id produce an empty intersection, which is indistinguishable from two that mint ids
 * and keep them apart — so a renderer with no ids at all would be declared isolated on the strength
 * of the thing being absent.
 *
 * The suite already refuses this shape elsewhere: a section it cannot reach is reported as not run,
 * with the reason. This holds that rule for the one section that used to pass instead.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const bin = "packages/widgets/bin/modyra-conformance.mjs";

// A renderer under test may legitimately be non-conformant — the stub is — so the exit code is
// not the subject here. What is read is the report it printed on its way out.
const run = (config) => {
  try {
    return execFileSync(process.execPath, [bin, config], { cwd: root, encoding: "utf8" });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.length > 0) return error.stdout;
    throw error;
  }
};

const sectionOf = (output, title) => {
  const lines = output.split("\n");
  const at = lines.findIndex((line) => line.includes(title));
  assert.notEqual(at, -1, `the run never reported a section called ${title}`);
  return { marker: lines[at].trim()[0], detail: (lines[at + 1] ?? "").trim() };
};

test("a renderer that mints no id does not pass the isolation section", () => {
  const { marker, detail } = sectionOf(
    run("examples/baseline/stub.conformance.config.mjs"),
    "Multi-instance isolation",
  );
  assert.equal(marker, "~", "a section with no subject to look at must report as not run");
  assert.match(detail, /no kind emitted an id/);
});

test("a renderer that does mint ids still has the section run against it", () => {
  const { marker } = sectionOf(
    run("packages/plain/conformance.config.mjs"),
    "Multi-instance isolation",
  );
  assert.equal(marker, "✓", "the skip must not silence a renderer whose ids can collide");
});
