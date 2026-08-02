/**
 * Counts what the conformance harnesses know about widgets that the contract does not tell them.
 *
 * Milestone G's third proof is "zero exceptions in the test harness": the tester must not know a
 * widget's structure from outside the contract, because a suite that was told the answer proves the
 * author's understanding rather than the specification's sufficiency.
 *
 * The number here is not expected to be zero yet. It is a **ratchet**: recorded, and not allowed to
 * grow. Reaching zero means every part resolver derives from `MDY_WIDGET_CONTRACTS` instead of from
 * a hand-written selector table, which is a much larger change than any one batch.
 *
 *   node scripts/audit-harness-exceptions.mjs            # report, and change nothing
 *   node scripts/audit-harness-exceptions.mjs --record   # accept the current count as the ratchet
 *   node scripts/audit-harness-exceptions.mjs --check    # fail if the count moved
 *
 * Recording is deliberately its own flag. A report that re-baselines as a side effect of being read
 * is not a ratchet — the debt would reset to whatever it happened to be the last time someone
 * looked, and growth would be recorded rather than caught.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const RATCHET = resolve(root, "packages/widgets/contract-baseline/harness-exceptions.json");
const check = process.argv.includes("--check");
const record = process.argv.includes("--record");

/**
 * The files that decide where a contract part lives in a rendered tree.
 *
 * Only these: a suite that branches on kind to pick a *value* or to skip an inapplicable state is
 * not the failure this proof is about. What counts is a harness knowing a widget's **structure**.
 */
const HARNESSES = [
  "packages/plain/test/contract-parts.mjs",
  "packages/plain/test/support/state-fixture.mjs",
  "packages/lit/test/support/state-fixture.mjs",
  "packages/angular/src/lib/renderers/catalog-host.spec.ts",
];

/** Every class the contract declares, so a harness selector can be told from an invented one. */
const DECLARED = new Set(
  MDY_WIDGET_KINDS.flatMap((kind) =>
    Object.values(MDY_WIDGET_CONTRACTS[kind].parts).flatMap((part) => [...(part.classes ?? [])]),
  ),
);

const report = [];
for (const file of HARNESSES) {
  const source = readFileSync(resolve(root, file), "utf8");

  // A branch on kind inside a part resolver: the tester choosing structure by widget.
  const kindBranches = [...source.matchAll(/^\s*case "([a-z]+)":/gm)]
    .map(([, kind]) => kind)
    .filter((kind) => MDY_WIDGET_KINDS.includes(kind));

  // A hardcoded class selector. Split by whether the contract already declares that class: a
  // selector the contract declares is *derivable today* and its presence is pure debt, while one it
  // does not declare is a gap in the contract as well as in the harness.
  const selectors = [...source.matchAll(/["'`]\.((?:mdy-)[\w-]+)/g)].map(([, name]) => name);
  const derivable = selectors.filter((name) => DECLARED.has(name));
  const undeclared = selectors.filter((name) => !DECLARED.has(name));

  // Reading an element out of a list by position is the archetype the roadmap names, because no
  // part of the contract is expressed by it.
  const positional = [...source.matchAll(/querySelectorAll\([^)]*\)(?:\s*\[\s*\d+\s*\]|\s*;?\s*$)/gm)].length
    + [...source.matchAll(/const \[[^\]]+\] = \w+\.querySelectorAll/g)].length;

  report.push({
    file,
    kindBranches: kindBranches.length,
    selectorsDerivable: derivable.length,
    selectorsUndeclared: [...new Set(undeclared)].length,
    positionalReads: positional,
  });
}

const total = report.reduce(
  (sum, row) => sum + row.kindBranches + row.selectorsDerivable + row.selectorsUndeclared + row.positionalReads,
  0,
);

console.log("Harness exceptions — what the tester knows that the contract does not tell it\n");
for (const row of report) {
  console.log(`  ${row.file}`);
  console.log(
    `    kind branches ${String(row.kindBranches).padStart(3)}`
    + ` · selectors derivable ${String(row.selectorsDerivable).padStart(3)}`
    + ` · selectors undeclared ${String(row.selectorsUndeclared).padStart(3)}`
    + ` · positional reads ${row.positionalReads}`,
  );
}
console.log(`\n  total ${total}`);
console.log(
  "\n  'derivable' counts selectors whose class the contract already declares: they can be replaced\n"
  + "  by findPartElement today. 'undeclared' ones need the contract to gain the class first.",
);

let baseline = null;
try {
  baseline = JSON.parse(readFileSync(RATCHET, "utf8"));
} catch {
  baseline = null;
}

if (record) {
  writeFileSync(RATCHET, `${JSON.stringify({ total, report }, null, 2)}\n`);
  console.log(`\n  recorded: ${RATCHET.replace(`${root}/`, "")}`);
  process.exit(0);
}

if (!check) {
  console.log(baseline === null ? "\n  no ratchet recorded" : `\n  ratchet: ${baseline.total}`);
  process.exit(0);
}

if (baseline === null) {
  console.error("\nNo ratchet recorded. Run without --check to record one.");
  process.exit(2);
}
if (total > baseline.total) {
  console.error(`\nHARNESS EXCEPTIONS GREW: ${baseline.total} → ${total}. The tester learned something the contract does not say.`);
  process.exit(1);
}
if (total < baseline.total) {
  console.error(`\nHARNESS EXCEPTIONS FELL: ${baseline.total} → ${total}. Re-record the ratchet so it cannot grow back.`);
  process.exit(1);
}
console.log("\nHARNESS EXCEPTION RATCHET HELD");
