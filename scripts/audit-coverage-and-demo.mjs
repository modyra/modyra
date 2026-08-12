/**
 * Every public name is asserted somewhere, and shown somewhere.
 *
 * Two questions that look like housekeeping and are the same question: *has anyone ever exercised
 * this*. The rule this repository just spent a batch closing had reached fourteen call sites and no
 * test drove a field that was invalid **and** disabled, and no page could be put into that state by
 * hand — so it was wrong in one kind for as long as it took someone to notice by eye.
 *
 * - **Asserted**: the name appears in a test. That is weaker than "there is a check that fails when
 *   the behaviour changes" — `mutation-suite.spec.mjs` is where that is proved for the DOM contract.
 *   This is the floor: a public name no test mentions has never run outside the build.
 * - **Shown**: the name, or the kind it serves, is reachable in a demo. A behaviour nobody can put
 *   on screen cannot be reported as broken by the person using it.
 *
 * `coverage-baseline.json` records what is uncovered today. The list may only get shorter.
 *
 *   node scripts/audit-coverage-and-demo.mjs [--write]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const BASELINE = join(root, "packages/widgets/contract-baseline/coverage-baseline.json");

/** Where a name may be asserted. */
const TEST_ROOTS = [
  "packages/core/test", "packages/widgets/test", "packages/plain/test", "packages/lit/test",
  "packages/react/test", "packages/vue/test", "packages/svelte/test", "packages/solid/test",
  "packages/preact/test", "packages/zod/test", "packages/standard-schema/test",
  "packages/angular/src/lib", "docs/examples", "e2e",
];
/** Where a name may be shown. */
const DEMO_ROOTS = ["examples", "apps/plain-preview/src", "apps/studio/src", "site/src"];

const SKIP = new Set(["node_modules", "dist", "coverage", ".angular", "test-results", ".astro"]);
const TEXT = /\.(ts|mts|tsx|js|mjs|jsx|html|svelte|vue|astro|md|mdx)$/;

function collect(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (TEXT.test(entry)) out.push(path);
  }
  return out;
}

const corpus = (roots) =>
  roots.flatMap((r) => collect(join(root, r))).map((f) => readFileSync(f, "utf8")).join("\n");

const tests = corpus(TEST_ROOTS);
const demos = corpus(DEMO_ROOTS);

/** Every name the two contract packages publish, values and types alike. */
const surface = JSON.parse(readFileSync(join(root, "packages/widgets/contract-baseline/type-surface.json"), "utf8"));
const names = new Set(Object.keys(surface));
for (const pkg of ["core", "widgets"]) {
  const mod = await import(new URL(`../packages/${pkg}/dist/index.js`, import.meta.url).href);
  for (const name of Object.keys(mod)) names.add(name);
}

const mentions = (text, name) => new RegExp(`\\b${name}\\b`).test(text);

const uncovered = [];
for (const name of [...names].sort()) {
  const asserted = mentions(tests, name);
  const shown = mentions(demos, name);
  if (!asserted || !shown) uncovered.push({ name, asserted, shown });
}

const score = {
  published: names.size,
  asserted: names.size - uncovered.filter((u) => !u.asserted).length,
  shown: names.size - uncovered.filter((u) => !u.shown).length,
};

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({
    note: "Public names not yet asserted or not yet shown. The list may only get shorter.",
    score,
    uncovered: uncovered.map((u) => ({
      ...u,
      reason: u.asserted ? "published and never shown" : u.shown ? "published and never asserted" : "published, neither asserted nor shown",
    })),
  }, null, 2)}\n`);
  console.log(`Coverage baseline written: asserted ${score.asserted}/${score.published}, shown ${score.shown}/${score.published}.`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); }
catch { console.error("No coverage baseline. Record one with --write."); process.exit(1); }

console.log(`Public names: ${score.published}`);
console.log(`  asserted somewhere: ${score.asserted} (was ${baseline.score.asserted})`);
console.log(`  shown in a demo:    ${score.shown} (was ${baseline.score.shown})`);

const recorded = new Set(baseline.uncovered.map((u) => u.name));
const appeared = uncovered.filter((u) => !recorded.has(u.name));
const covered = baseline.uncovered.filter((u) => !uncovered.some((x) => x.name === u.name));

if (appeared.length) {
  console.error(`\nUNCOVERED PUBLIC NAMES (${appeared.length}) — published and unexercised`);
  for (const u of appeared) {
    console.error(`- ${u.name}: ${u.asserted ? "" : "no test mentions it"}${!u.asserted && !u.shown ? "; " : ""}${u.shown ? "" : "no demo shows it"}`);
  }
  console.error("\nAdd the check and the demo, or record it: node scripts/audit-coverage-and-demo.mjs --write");
}
if (covered.length) {
  console.log(`\nNewly covered (${covered.length}) — re-record so the list stops claiming otherwise:`);
  for (const u of covered) console.log(`  ${u.name}`);
}
if (appeared.length || covered.length) process.exit(1);
console.log("\nCOVERAGE HELD");
