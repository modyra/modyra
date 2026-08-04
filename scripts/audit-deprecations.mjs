#!/usr/bin/env node
/**
 * Every deprecation says when, and what to use instead.
 *
 * `docs/contract-compatibility.md` § *What you are owed* states the policy; this is the half of it a
 * machine can hold. Prose about intent cannot be enforced — the shape of a marker can:
 *
 *   @deprecated since 1.2 — use `stateCarriers` instead.
 *
 * A marker with no version cannot be aged out and becomes permanent furniture. One with no
 * replacement is not a migration path, it is a warning with nowhere to go.
 *
 * It reports how many markers it checked, because a policy audit over an empty tree passes for the
 * wrong reason and should say so rather than imply coverage.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
/** The 1.0 perimeter. Adapters version independently and make their own promises. */
const ROOTS = ["packages/core/src", "packages/widgets/src"];

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) files.push(full);
  }
};
for (const dir of ROOTS) walk(join(ROOT, dir));

const problems = [];
let markers = 0;

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    const at = line.indexOf("@deprecated");
    if (at === -1) return;
    markers += 1;
    const where = `${relative(ROOT, file)}:${index + 1}`;
    // The rest of the marker, which may continue onto the following lines of the same block.
    const text = [line.slice(at), lines[index + 1] ?? "", lines[index + 2] ?? ""]
      .join(" ")
      .replace(/^\s*\*\s?/gm, " ");

    if (!/since\s+\d+\.\d+/.test(text)) {
      problems.push(`${where}: no "since <version>" — a deprecation with no date cannot be aged out`);
    }
    if (!/\buse\b|\breplaced by\b|\bmoved to\b/i.test(text)) {
      problems.push(`${where}: names no replacement — say what to use, or say plainly that it is going away`);
    }
  });
}

console.log(`Deprecation markers checked: ${markers}, across ${files.length} files in the 1.0 packages.`);
if (markers === 0) {
  console.log("None declared. This audit has never seen a marker, so it proves the policy is stated — not that it is followed.");
}

if (problems.length > 0) {
  console.error(`\nDEPRECATION POLICY: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("DEPRECATION POLICY CLEAN");
