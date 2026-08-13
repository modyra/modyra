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
 * - **Shown**: the name appears in a demo. Weaker than it sounds, and measured: a page that drives
 *   validation, drafts, collections and a parsed document through `createForm` and `renderField`
 *   moved this number by two, because the types and codes those behaviours are made of are never
 *   *named* by the page exercising them. Read it as "is this name reachable from something that
 *   runs", not as "is this behaviour demonstrated" — the second needs a check per behaviour, and the
 *   panels' own browser suite is where those live.
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
/**
 * Where a name is *shown* — declared by a panel, and checked by that panel's own browser test.
 *
 * Searching the demo sources for a name was the first attempt and it measured nothing: an import
 * line counted as a demonstration, the documentation site counted as a demo, and six panels that
 * drive validation, drafts, collections and a parsed document moved the number by two. A name is
 * shown when a panel says it drives it and a test says the panel works.
 */
/**
 * Names that will never appear in a demo, and should not be counted against one.
 *
 * The conformance kit is published so a renderer outside this repository can be held to the same
 * contract. It is exercised by the suites it exists for; a page that demonstrated it would be
 * demonstrating the test harness rather than the library.
 */
const TESTING_ONLY = new Set([
  "settleFor", "MdyPaintBeat", "MDY_PAINT_BEATS",
  // The icon geometry a theme sizes against and the conformance kit measures — the grid the paths
  // are drawn on, which span each glyph occupies, the stroke width. A renderer reads `MDY_ICONS`
  // and nothing else, so there is no demo that could show these without inventing one.
  "MDY_ICON_GRID", "MDY_ICON_SPANS", "MDY_ICON_STROKE",
]);

const PANELS = join(root, "examples/plain/panels");
const PANEL_SUITE = join(root, "e2e/plain/lab.spec.ts");

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

/**
 * What each panel declares it drives, and whether its own suite covers it.
 *
 * A declaration nobody exercises is the same empty claim the string search was: the panel id has to
 * appear in the browser suite, or the names it lists do not count.
 */
const suite = (() => { try { return readFileSync(PANEL_SUITE, "utf8"); } catch { return ""; } })();
const shownNames = new Set();
const panelReport = [];
for (const file of readdirSync(PANELS).filter((f) => f.endsWith(".js"))) {
  const source = readFileSync(join(PANELS, file), "utf8");
  const block = source.match(/exercises:\s*\[([^\]]*)\]/);
  if (!block) continue;
  const id = source.match(/\bid:\s*"([^"]+)"/)?.[1] ?? file.replace(/\.js$/, "");
  const declared = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const covered = suite.includes(`"${id}"`);
  panelReport.push({ id, declared: declared.length, covered });
  if (covered) for (const name of declared) shownNames.add(name);
}

/** Every name the two contract packages publish, values and types alike. */
const surface = JSON.parse(readFileSync(join(root, "packages/widgets/contract-baseline/type-surface.json"), "utf8"));
const names = new Set(Object.keys(surface));
// `plain` is here because it is the renderer the panels drive: its two entry points are the surface
// a person actually touches, and leaving them out measured the contract while ignoring the way in.
for (const pkg of ["core", "widgets", "plain"]) {
  const mod = await import(new URL(`../packages/${pkg}/dist/index.js`, import.meta.url).href);
  for (const name of Object.keys(mod)) names.add(name);
}

const mentions = (text, name) => new RegExp(`\\b${name}\\b`).test(text);

const uncovered = [];
for (const name of [...names].sort()) {
  const asserted = mentions(tests, name);
  const shown = shownNames.has(name) || TESTING_ONLY.has(name);
  if (!asserted || !shown) uncovered.push({ name, asserted, shown });
}

/** A declared name that is not published is a typo inflating the number. */
const phantom = [...shownNames].filter((name) => !names.has(name)).sort();

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
      reason: TESTING_ONLY.has(u.name)
        ? "a testing utility: exercised by the suites it exists for, and not demonstrable in a demo"
        : u.asserted ? "published and never shown" : u.shown ? "published and never asserted" : "published, neither asserted nor shown",
    })),
  }, null, 2)}\n`);
  console.log(`Coverage baseline written: asserted ${score.asserted}/${score.published}, shown ${score.shown}/${score.published}.`);
  for (const p of panelReport) console.log(`  ${p.id}: ${p.declared} declared${p.covered ? "" : " — NOT covered by the panel suite"}`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); }
catch { console.error("No coverage baseline. Record one with --write."); process.exit(1); }

if (phantom.length > 0) {
  console.error("\nDECLARED AND NOT PUBLISHED — a panel claims a name the packages do not export");
  for (const name of phantom) console.error(`- ${name}`);
  process.exit(1);
}
const uncoveredPanels = panelReport.filter((p) => !p.covered);
if (uncoveredPanels.length > 0) {
  console.error("\nPANEL WITHOUT A SUITE — its declarations do not count");
  for (const p of uncoveredPanels) console.error(`- ${p.id}`);
  process.exit(1);
}

console.log(`Panels: ${panelReport.length}, all covered by ${PANEL_SUITE.split("/").slice(-3).join("/")}`);
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
