/**
 * Every renderer's demo draws every kind the shared scenarios declare.
 *
 * `examples/shared/scenarios` says what a demo is *of* — which fields, which kinds, which words —
 * and it guards itself: a kind the vocabulary declares and no scenario draws throws at import. That
 * check faces one way. It says nothing about whether the pages actually put those kinds on a screen,
 * and that is the half a reader meets: a demo missing five kinds looks finished, because the absent
 * control is the one nobody thinks to look for.
 *
 * So this asks the other side of the same declaration: **for each renderer, does its demo name every
 * kind the scenarios cover?**
 *
 * **The roster is derived, and the unclassified is named.** A published package that depends on
 * `@modyra/widgets` is a renderer, and every renderer owes a demo — so a renderer added tomorrow is
 * a subject the day it lands, and one that stops shipping stops being asked about. A hand-written
 * list would have gone on excusing whatever it forgot to mention, which is how a roster stops being
 * a question and becomes a place to hide.
 *
 * **What it reads, said out loud rather than left to be discovered.** It reads demo *source* with
 * comments stripped, so what it sees is a kind **named**, not a kind **drawn**. A page naming a kind
 * it never mounts passes here; a page that mounted every kind through a loop that named none would
 * fail. The first is why this is a floor and not a proof, and the second is why the demos that
 * consume the shared declaration are reported separately: `everyKind.fields()` hands a demo the
 * whole catalogue, and a demo that refuses a kind it cannot draw — rather than skipping it — has
 * already made this check at the only moment it can be made, which is with the page in front of it.
 *
 * Comments are stripped first because prose answers a presence check. A kind named only in a doc
 * block is a kind the page does not have, and counting it would make this gate most wrong exactly
 * where a demo is best documented.
 *
 * `demo-parity.json` records where each renderer stands. A number may only go up: a demo that draws
 * fewer kinds than it did is a page that lost a control, and that is the regression this exists for.
 *
 *   node scripts/audit-demo-parity.mjs           # report
 *   node scripts/audit-demo-parity.mjs --check   # and exit 1 on a renderer that went backwards
 *   node scripts/audit-demo-parity.mjs --write   # record where they stand today
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MDY_FIELD_KINDS } from "@modyra/core";
import { kindsCovered } from "../examples/shared/scenarios/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "packages/widgets/contract-baseline/demo-parity.json");
const CHECK = process.argv.includes("--check");
const WRITE = process.argv.includes("--write");

/**
 * The renderers, from the declaration that already exists.
 *
 * Depending on `@modyra/widgets` is what makes a package a renderer: it is the framework-agnostic UI
 * contract, and a package that consumes it exists to draw it for one framework.
 */
function renderers() {
  return readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifest = join(ROOT, "packages", name, "package.json");
      if (!existsSync(manifest)) return false;
      const parsed = JSON.parse(readFileSync(manifest, "utf8"));
      // Publication is not the question. `@modyra/angular` is marked private because it ships
      // through its own release step, and a demo is owed for a renderer people can use whatever
      // route its package takes to them — filtering on `private` dropped it out of the roster
      // silently, which is the thing a derived roster exists to stop.
      const declared = { ...parsed.dependencies, ...parsed.peerDependencies };
      return "@modyra/widgets" in declared;
    })
    .sort();
}

/** Every source file a demo is made of. Built artefacts are not the page an author maintains. */
function demoSources(directory) {
  const found = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|jsx|ts|tsx|svelte|vue|html)$/.test(entry.name)) found.push(path);
    }
  };
  walk(directory);
  return found;
}

const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .replace(/<!--[\s\S]*?-->/g, " ");

const COVERED = kindsCovered();

function measure(name) {
  const directory = join(ROOT, "examples", name);
  if (!existsSync(directory)) return { name, present: false, named: [], missing: COVERED, sharesScenarios: false };
  const files = demoSources(directory);
  const code = files.map((path) => withoutComments(readFileSync(path, "utf8"))).join("\n");
  const named = COVERED.filter((kind) => new RegExp(`\\b${kind}\\b`).test(code));
  return {
    name,
    present: true,
    files: files.length,
    named,
    missing: COVERED.filter((kind) => !named.includes(kind)),
    // A demo built from the shared scenarios is measured against the same declaration this gate
    // reads, so the two cannot drift apart without one of them saying so.
    sharesScenarios: /shared\/scenarios|everyKind|SCENARIOS/.test(code),
  };
}

const measured = renderers().map(measure);

console.log("# Demo parity\n");
console.log(`Scenarios cover ${COVERED.length} of ${MDY_FIELD_KINDS.length} declared kinds.`);
console.log("Read from demo source with comments stripped: a kind **named**, never a kind drawn.\n");

for (const row of measured) {
  const score = `${String(row.named.length).padStart(2)}/${COVERED.length}`;
  if (!row.present) {
    console.log(`  ${row.name.padEnd(9)} ${score}  no demo at examples/${row.name}`);
    continue;
  }
  console.log(
    `  ${row.name.padEnd(9)} ${score}  ${String(row.files).padStart(2)} file(s)`
    + `  ${row.sharesScenarios ? "from the shared scenarios" : "its own field list"}`
    + (row.missing.length > 0 ? `\n    absent: ${row.missing.join(", ")}` : ""),
  );
}

// An examples directory that belongs to no renderer is named rather than counted: it is not a
// failure, and a reader comparing this list with the directory should not have to work out why the
// two differ.
const unmeasured = readdirSync(join(ROOT, "examples"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !measured.some((row) => row.name === name))
  .sort();
if (unmeasured.length > 0) {
  console.log(`\nNot a renderer's demo, so not measured: ${unmeasured.join(", ")}`);
}

if (WRITE) {
  const body = {
    note:
      "Where each renderer's demo stands against the shared scenarios. A number may only go up: a "
      + "demo drawing fewer kinds than it did has lost a control. Rewrite with "
      + "`node scripts/audit-demo-parity.mjs --write`.",
    reads:
      "Demo source with comments stripped, so a kind named rather than a kind drawn. A page naming a "
      + "kind it never mounts passes here.",
    recordedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    kindsCovered: COVERED.length,
    renderers: Object.fromEntries(measured.map((row) => [row.name, row.named.length])),
  };
  writeFileSync(BASELINE, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  console.log(`\nrecorded ${measured.length} renderer(s) → ${BASELINE.slice(ROOT.length + 1)}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.log("\nNo baseline recorded yet. Write one with `node scripts/audit-demo-parity.mjs --write`.");
  process.exit(CHECK ? 1 : 0);
}

const recorded = JSON.parse(readFileSync(BASELINE, "utf8"));
const lost = measured.filter((row) => row.named.length < (recorded.renderers?.[row.name] ?? 0));
// A renderer the baseline never heard of is not a pass. It is a subject nobody has ranked, and a
// gate that stayed quiet about it would be excusing exactly what the derived roster exists to catch.
const unrecorded = measured.filter((row) => recorded.renderers?.[row.name] === undefined);

if (lost.length === 0 && unrecorded.length === 0) {
  console.log(`\nNO PARITY LOSS — every renderer draws at least what it drew on ${recorded.recordedAt}.`);
} else {
  console.log("");
  for (const row of lost) {
    console.log(`  LOST: ${row.name} names ${row.named.length} kind(s), was ${recorded.renderers[row.name]}`
      + ` — absent now: ${row.missing.join(", ")}`);
  }
  for (const row of unrecorded) {
    console.log(`  UNRECORDED: ${row.name} is a renderer the baseline does not rank`);
  }
  if (CHECK) process.exit(1);
}
