/**
 * Every public name is asserted somewhere, and shown somewhere.
 *
 * Two questions that look like housekeeping and are the same question: *has anyone ever exercised
 * this*. The rule this repository just spent a batch closing had reached fourteen call sites and no
 * test drove a field that was invalid **and** disabled, and no page could be put into that state by
 * hand — so it was wrong in one kind for as long as it took someone to notice by eye.
 *
 * - **Asserted**: the name appears in the *body* of a test — not in a comment, and not in an import
 *   line. Both used to count, and fifty names stood on one of them alone: prose about a name is not
 *   an exercise of it, and importing something is what you do before you use it, not the use. This
 *   is still weaker than "there is a check that fails when the behaviour changes" —
 *   `mutation-suite.spec.mjs` is where that is proved, for eight names. This is the floor: a public
 *   name no test *runs* has never run outside the build.
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
  // `packages/angular/src/lib` is here for the main package's specs, which sit beside their sources
  // rather than under a `test` directory. Its secondary entry points do the same and were missed:
  // `mdyFormFromSchema` has `mdy-form-from-schema.spec.ts` next to it and read here as a name no
  // test had ever mentioned.
  "packages/angular/src/lib", "packages/angular/zod/src", "packages/angular/testing/src",
  "docs/examples", "e2e",
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

/**
 * A test file with the parts that are not the test removed.
 *
 * Comments and import lines were counted for as long as this audit existed, and fifty names were
 * *asserted* on one of them alone — a name written in prose above a test that never touches it, or
 * listed in an import beside the ones the test does use. Both read as exercise and are not: the
 * question here is whether anything ever ran this name, and a sentence about it never runs.
 *
 * **A block comment is recognised only where one is written: at the start of a line.** Stripping
 * `/*` … `*​/` anywhere with a regex is the obvious way and it is wrong — `accept: "image/*,.pdf"`
 * opens one inside a string, and everything up to the next `*​/` disappears with it. Measured on
 * `packages/widgets/test/behavior.spec.mjs`, that swallowed a whole `test(...)` block, and the count
 * it produced was lower for a reason that had nothing to do with prose.
 *
 * Then whole-line imports and re-exports, including the members of a multi-line `import { … } from`
 * list; then trailing `//`. A string containing `//` — a URL — loses its tail, which costs nothing
 * here: a public name is not a URL.
 */
const withoutProse = (source) => {
  const kept = [];
  let inComment = false;
  let inImport = false;
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (inComment) {
      if (trimmed.includes("*/")) inComment = false;
      continue;
    }
    if (/^\/\*/.test(trimmed)) {
      inComment = !trimmed.includes("*/");
      continue;
    }
    if (inImport) {
      if (/\bfrom\b|["'];?\s*$/.test(trimmed)) inImport = false;
      continue;
    }
    // Only the forms that *move* names, never `export const` or `export function`: a test's own
    // helper is written that way, and dropping the line takes the body with it. Caught by planting
    // a name into `export const helper = () => …` and watching the count not move.
    if (/^import\b/.test(trimmed) || /^export\s+(type\s+)?[{*]/.test(trimmed)) {
      inImport = !/\bfrom\b.*["']|["'];\s*$/.test(trimmed) && trimmed.includes("{") && !trimmed.includes("}");
      continue;
    }
    if (/^(\/\/|\*)/.test(trimmed)) continue;
    kept.push(line.replace(/\/\/.*$/, ""));
  }
  return kept.join("\n");
};

const corpus = (roots) =>
  roots.flatMap((r) => collect(join(root, r))).map((f) => withoutProse(readFileSync(f, "utf8"))).join("\n");

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
const runtimeNames = new Set();
for (const pkg of ["core", "widgets", "plain"]) {
  const mod = await import(new URL(`../packages/${pkg}/dist/index.js`, import.meta.url).href);
  for (const name of Object.keys(mod)) { names.add(name); runtimeNames.add(name); }
}

const mentions = (text, name) => new RegExp(`\\b${name}\\b`).test(text);

/**
 * A name that exists when the code runs, as opposed to one that exists only while it compiles.
 *
 * **The two are asked different questions.** *Asserted* is owed by every published name: a type is
 * exercised by a check that compiles against it as surely as a function is by one that calls it.
 * *Shown* is not. A panel is a page a person drives, and a type cannot be driven — asking a demo to
 * exhibit `MdyAnchorRect` has no meaning, so counting it as unshown made five hundred and five names
 * permanently uncovered and the total permanently unreachable. It read as a debt nobody could pay,
 * which is the same as no measurement at all.
 *
 * So the shown question is asked of the names that can answer it, and the rest are recorded as
 * outside it rather than as failing it.
 */
const atRuntime = new Set(runtimeNames);

const uncovered = [];
for (const name of [...names].sort()) {
  const asserted = mentions(tests, name);
  const showable = atRuntime.has(name);
  const shown = !showable || shownNames.has(name) || TESTING_ONLY.has(name);
  if (!asserted || !shown) uncovered.push({ name, asserted, shown, showable });
}

/** A declared name that is not published is a typo inflating the number. */
const phantom = [...shownNames].filter((name) => !names.has(name)).sort();

/**
 * A declared name that exists only while the code compiles.
 *
 * A panel is a page somebody drives, so what it claims to exercise has to be there when it runs. A
 * type is not: the declaration cannot be true, and counting it made the shown number larger without
 * anything on the page changing. Refused for the same reason a name nobody publishes is refused —
 * both are a list growing where the demonstration did not.
 */
const notAtRuntime = [...shownNames].filter((name) => names.has(name) && !atRuntime.has(name)).sort();

const score = {
  published: names.size,
  asserted: names.size - uncovered.filter((u) => !u.asserted).length,
  // Out of the names a page could show, not out of every published name: the denominator is what
  // makes the number mean something a person can act on.
  showable: atRuntime.size,
  shown: atRuntime.size - uncovered.filter((u) => u.showable === true && !u.shown).length,
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
if (notAtRuntime.length > 0) {
  console.error(
    "\nDECLARED AND NOT THERE WHEN IT RUNS — a panel claims to exercise a name that exists only "
    + "while the code compiles, so the claim cannot be true on a page:",
  );
  for (const name of notAtRuntime) console.error(`- ${name}`);
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
console.log(`  shown in a demo:    ${score.shown} of ${score.showable} that a page could show (was ${baseline.score.shown})`);

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
