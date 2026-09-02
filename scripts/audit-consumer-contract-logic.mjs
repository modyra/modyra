/**
 * How much contract logic each consumer writes for itself.
 *
 * The framework's claim is that a renderer derives from the contract: the catalogues say which parts
 * a kind has, which ARIA a part carries, which keys open it, how an id is built. A consumer that
 * *asks* is a derivation. A consumer that *writes the same answer as a literal* is a second copy of
 * something the contract owns, and a second copy diverges the moment the first one moves — this is
 * the shape behind 28 of lit's 45 reds, every one of them a parallel copy of state the contract
 * already held.
 *
 * So the measure is not "how much code". It is **literal versus derived**, per category, per package.
 *
 * Every count here is a *candidate*, not a verdict. A literal can be legitimate — a framework
 * genuinely needs `role` in a template it writes, and a wrapper may name a class it owns. What the
 * numbers support is comparison: between consumers, and between one consumer and its own past. A
 * package whose derived count is high and literal count low has learned the contract; the reverse
 * has reimplemented it. Reading the sites is what turns a candidate into a finding, and the report
 * prints file and line for exactly that.
 *
 * **Two things are named rather than subtracted, and one is genuinely removed.**
 *
 * *Named:* a custom element's tag reads exactly like a class — `"mdy-text-field"` is both shapes at
 * once — and those tags are the elements a package publishes, so they are API and will never fall.
 * They are reported as a **floor** instead of being filtered out, because a pattern that excludes
 * tags will one day exclude a class shaped like a tag, and a printed floor is a fact every reader
 * sees while a narrowed regex is a decision buried where nobody looks. The ratchet aims at the floor,
 * not at zero.
 *
 * *Removed:* a literal inside a comment. That is not a policy call — prose is not code, and a
 * comment quoting `aria-expanded` to explain it is the opposite of duplicating it. The count it used
 * to add is printed too, so the correction is visible rather than a silent drop between two runs.
 *
 * Excluded: tests, stories, and type declaration files. A test naming `aria-expanded` is asserting
 * the contract, which is the opposite of duplicating it, and counting it inverts the measurement.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CONSUMERS = ["plain", "lit", "angular", "react", "preact", "solid", "svelte", "vue"];
const SOURCE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".vue", ".svelte"]);
// Matched against the path *inside the package*, never the absolute one. The absolute path carries
// the checkout's own directory names, and a machine whose working directory happens to sit under a
// folder called "test" would classify every file in the repository as a test — measuring the layout
// of the disk instead of the subject, and reporting a confident, entirely empty zero.
const SKIP = /(\.spec\.|\.test\.|\.d\.ts$|(?:^|\/)tests?\/|__tests__|\.stories\.)/;

/**
 * What the contract owns, and the literal that means someone re-answered it here.
 *
 * Each pattern is written to match a *written answer*, not a mention: `aria-expanded` as a string
 * being set, a key being compared, an id being built. The `derived` counter opposite them counts
 * references to the catalogues that hold the same answers.
 */
const CATEGORIES = [
  {
    key: "aria",
    what: "ARIA attribute names written as literals",
    owns: "MDY_WIDGET_CONTRACTS / the part catalogue",
    pattern: /["'`]aria-[a-z]+["'`]|\baria-[a-z]+=/g,
  },
  {
    key: "role",
    what: "role values written as literals",
    owns: "the part catalogue's role per part",
    pattern: /\brole\s*[=:]\s*["'`][a-z]+["'`]|["'`]role["'`]\s*,\s*["'`][a-z]+["'`]/g,
  },
  {
    key: "keys",
    what: "keyboard key names compared as literals",
    owns: "MDY_WIDGET_KEYBOARD",
    pattern: /["'`](?:ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Enter|Escape|Home|End|PageUp|PageDown|Tab)["'`]/g,
  },
  {
    key: "ids",
    what: "element ids assembled from parts",
    owns: "the projection, which already emits them",
    pattern: /`[^`]*\$\{[^`]*\}__[a-z]+/g,
  },
  {
    key: "classes",
    what: "mdy- class names written as literals",
    owns: "@modyra/styles and the class helpers",
    pattern: /["'`]mdy-[a-z0-9_-]+/g,
  },
  {
    key: "validators",
    what: "validator names branched on by hand",
    owns: "MDY_VALUE_CONTRACTS and the validator API",
    pattern: /["'`](?:required|minLength|maxLength|pattern|email|min|max)["'`]\s*(?:===|==|:|\))/g,
  },
];

/**
 * The kinds the contract defines, read from the built contract rather than listed here.
 *
 * This column is what stops the literal counts from being read backwards. A consumer that renders
 * nothing has nothing to duplicate, so it scores a perfect zero — the same zero a flawless derivation
 * would score. Without coverage beside it, "0 literal" reads as praise for the packages that have not
 * been written yet.
 */
const KINDS = fromContractOrEnv("MDY_AUDIT_KINDS",
  'import {MDY_WIDGET_CONTRACTS} from "./packages/widgets/dist/index.js";'
  + ' process.stdout.write(JSON.stringify(Object.keys(MDY_WIDGET_CONTRACTS)))');

/**
 * The public answer to each category, read from the built package rather than listed here.
 *
 * This is what separates three repairs whose costs differ by an order of magnitude. A literal in a
 * consumer means one of:
 *
 *   1. **the answer exists and is public** — the repair is a README line, not an extraction. A piece
 *      of contract nobody knows how to call is indistinguishable from one that is missing, and it
 *      fails the same way: react's README taught `aria-invalid={!valid}`, wrong in two states out of
 *      three, while the correct door was exported all along;
 *   2. **the answer exists and is not reachable** — a surface decision;
 *   3. **the answer does not exist** — a real descent into widgets.
 *
 * Only the third is construction. Reading 1 as 3 builds an extraction where a sentence would do.
 */
const ANSWERS = {
  aria: /A11y$|Aria$|^MDY_WIDGET_CONTRACTS$/,
  role: /A11y$|^MDY_WIDGET_CONTRACTS$|^partClasses$/,
  keys: /^MDY_WIDGET_KEYBOARD$|Key(?:board)?(?:Intent|Guide|Order|Action|Target)?$|^keyBindingFor$|^keyMeans$|^matchesKeyGesture$/,
  ids: /PartIds$|^idSafeKey$|^isValidWidgetId$/,
  classes: /Classes$|^MDY_[A-Z_]*CLASS(?:ES)?$|^stateClass$|^partClasses$/,
  validators: /^errorsVisible$|Errors(?:Of)?$|^showsAsInvalid$|^fieldCanBeInvalid$/,
};

const PUBLIC = fromContractOrEnv("MDY_AUDIT_PUBLIC",
  'import * as W from "./packages/widgets/dist/index.js";'
  + ' process.stdout.write(JSON.stringify(Object.keys(W)))');

/** A reference to a catalogue or a contract export: the derived half of the ratio. */
const DERIVED = /\bMDY_[A-Z_]+|\bmdy[A-Z][A-Za-z]*\(|@modyra\/(?:widgets|core)/g;

const base_of = (pkg) => join(ROOT, "packages", pkg, "src");

function sourceFilesOf(pkg) {
  const base = base_of(pkg);
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE.has(extname(entry.name)) && !SKIP.test(relative(base, full))) out.push(full);
    }
  };
  walk(base);
  return out;
}

/**
 * The contract's vocabulary — read from the built package, or supplied.
 *
 * Supplying it is what makes a *trend* measurable. Reading a past source tree with that tree's own
 * vocabulary compares two things at once: the code moved and so did the list it is measured against,
 * and a category that gained a public door would look like consumers that stopped duplicating. One
 * vocabulary, held fixed, is the only way the direction means anything — and the direction is the
 * threshold, not the number.
 *
 * It also lets the instrument run where the package is not installed, which is every past checkout.
 */
function fromContractOrEnv(variable, program) {
  const supplied = process.env[variable];
  if (supplied) return JSON.parse(supplied);
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", program],
    { cwd: ROOT, encoding: "utf8" }));
}

const report = [];
for (const pkg of CONSUMERS) {
  const files = sourceFilesOf(pkg);
  if (files.length === 0) { report.push({ pkg, missing: true }); continue; }

  /** Custom element tags: the same spelling as a class, and permanent — they are the published API. */
  const ELEMENT_TAG = /["'`]mdy-(?:[a-z]+-field|form-errors|dynamic-form)["'`]/g;

  /**
   * The developer-tools panel, which is not a widget and answers to no contract.
   *
   * Declared here and printed in the report rather than filtered upstream, for the reason the
   * daterange calendar taught: an exclusion that lives outside the report is a decision the next
   * reader relitigates or never sees. Its classes are counted, named, and subtracted in the open.
   */
  const OUTSIDE_PERIMETER = /["'`]mdy-(?:devtools-overlay|forms-devtools)[a-z0-9_-]*/g;

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
  let inComments = 0;
  let elementNames = 0;
  let outsidePerimeter = 0;
  const sites = Object.fromEntries(CATEGORIES.map((c) => [c.key, []]));
  let derived = 0;
  let lines = 0;

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const bare = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    lines += text.split("\n").length;
    derived += (bare.match(DERIVED) ?? []).length;
    elementNames += (bare.match(ELEMENT_TAG) ?? []).length;
    outsidePerimeter += (bare.match(OUTSIDE_PERIMETER) ?? []).length;
    for (const category of CATEGORIES) {
      const found = bare.match(category.pattern) ?? [];
      inComments += (text.match(category.pattern) ?? []).length - found.length;
      counts[category.key] += found.length;
      if (found.length > 0) {
        const line = bare.slice(0, bare.search(category.pattern)).split("\n").length;
        sites[category.key].push(`${relative(ROOT, file)}:${line}`);
      }
    }
  }
  // How many of the public doors that answer this category the package actually calls. A category
  // with public answers and zero calls is bucket 1 — the door exists and nobody knocked.
  const doorsUsed = {};
  for (const category of CATEGORIES) {
    const doors = PUBLIC.filter((name) => ANSWERS[category.key].test(name));
    doorsUsed[category.key] = {
      available: doors.length,
      called: doors.filter((name) => new RegExp(`\\b${name}\\b`).test(
        files.map((f) => readFileSync(f, "utf8")).join("\n"))).length,
    };
  }

  const literal = Object.values(counts).reduce((a, b) => a + b, 0);
  // A kind counts as rendered where the package dispatches on it: the kind as a quoted literal in
  // code, or a source file named for it. Comments are stripped first, and that is not a detail — the
  // first form of this check matched `email` inside a doc comment reading `form.f.email.value()` and
  // reported two kinds rendered for a package that renders none. A prose mention is the cheapest
  // possible false positive and it lands on the side that flatters the subject.
  const code = files
    .map((f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " "))
    .join("\n");
  const named = files.map((f) => relative(base_of(pkg), f)).join("\n");
  const rendered = KINDS.filter((kind) =>
    new RegExp(`["'\`]${kind}["'\`]`).test(code)
    // An unquoted object key is the other way a dispatch table is written, and the commonest:
    // `email: "mdy-text-field"` maps the kind without ever quoting it. Missing this form reported a
    // renderer that handles every kind as handling fifteen.
    || new RegExp(`(?:^|[{,\\s])${kind}\\s*:`, "m").test(code)
    || new RegExp(`(?:^|[/-])${kind}[-./]`, "m").test(named));
  report.push({ pkg, files: files.length, lines, counts, sites, literal, derived, rendered, doorsUsed, inComments, elementNames, outsidePerimeter });
}

console.log("# Contract logic written inside consumers\n");
console.log("Literal = an answer the contract owns, re-answered here. Derived = a reference to the");
console.log("catalogues that hold those answers. Both are candidates: the sites are printed to be read.\n");

const head = ["package", "kinds", "lines", ...CATEGORIES.map((c) => c.key), "literal", "derived", "lit/kind", "floor"];
console.log(head.map((h, i) => h.padEnd(i === 0 ? 9 : 9)).join(""));
for (const row of report) {
  if (row.missing) { console.log(`${row.pkg.padEnd(9)}(no src)`); continue; }
  const perKind = row.rendered.length === 0 ? "n/a" : (row.literal / row.rendered.length).toFixed(1);
  const cells = [
    row.pkg.padEnd(9),
    `${row.rendered.length}/${KINDS.length}`.padEnd(9),
    String(row.lines).padEnd(9),
    ...CATEGORIES.map((c) => String(row.counts[c.key]).padEnd(9)),
    String(row.literal).padEnd(9),
    String(row.derived).padEnd(9),
    perKind.padEnd(9),
    String(row.elementNames).padEnd(9),
  ];
  console.log(cells.join(""));
}

console.log("\n`kinds` is coverage and it is the column that decides how the rest is read: a package");
console.log("rendering 0 of 17 scores 0 literals for the same reason it scores nothing else. `lit/kind`");
console.log("is the load per kind actually rendered, which is the number that compares unlike packages.\n");

for (const row of report) {
  if (row.missing || row.rendered.length === KINDS.length || row.rendered.length === 0) continue;
  const absent = KINDS.filter((k) => !row.rendered.includes(k));
  console.log(`  ${row.pkg.padEnd(9)} does not render: ${absent.join(", ")}`);
}

console.log("\nThe absent list undercounts wherever one file serves several kinds without naming them:");
console.log("`boolean-field` renders checkbox and toggle, `option-field` renders radio and segmented,");
console.log("and neither kind appears anywhere in the source. Read a small package's absences as an");
console.log("upper bound on what is missing, and its coverage as a lower bound on what is there.");

const floor = report.reduce((a, r) => a + (r.elementNames ?? 0), 0);
const comments = report.reduce((a, r) => a + (r.inComments ?? 0), 0);
const outside = report.reduce((a, r) => a + (r.outsidePerimeter ?? 0), 0);
console.log(`\n\`floor\` counts custom element tags — published API, spelled exactly like a class. They`);
console.log(`will never fall: the ratchet aims at ${floor} across the consumers, not at 0. A further`);
console.log(`${comments} literal(s) sit inside comments and are not counted at all; prose is not code.`);
console.log(`${outside} literal(s) name the developer-tools panel, which is not a widget and answers to`);
console.log(`no contract. They are inside the counts above and named here rather than filtered away,`);
console.log(`because an exclusion that lives outside the report is one the next reader cannot see.\n`);

console.log("\n## Which bucket the duplication falls in\n");
console.log("For each category: how many public doors answer it, and how many this package calls.");
console.log("Literals beside called doors are partial adoption; literals beside zero called doors are");
console.log("a door nobody knocked on. A category with no public door at all would be a real descent.\n");
console.log(`  ${"package".padEnd(9)}${CATEGORIES.map((c) => c.key.padEnd(11)).join("")}`);
for (const row of report) {
  if (row.missing) continue;
  const cells = CATEGORIES.map((c) => {
    const d = row.doorsUsed[c.key];
    return `${d.called}/${d.available}`.padEnd(11);
  });
  console.log(`  ${row.pkg.padEnd(9)}${cells.join("")}`);
}
const noDoor = CATEGORIES.filter((c) => PUBLIC.filter((n) => ANSWERS[c.key].test(n)).length === 0);
console.log(`\n  Categories with NO public answer (a real descent): ${noDoor.length === 0 ? "none" : noDoor.map((c) => c.key).join(", ")}`);

console.log("\n## The void — what the thin adapters do not cover at all\n");
const full = report.filter((r) => !r.missing && r.rendered.length === KINDS.length);
const thin = report.filter((r) => !r.missing && r.rendered.length < KINDS.length);
for (const row of thin) {
  const silent = CATEGORIES.filter((c) => row.counts[c.key] === 0 && row.doorsUsed[c.key].called === 0);
  console.log(`  ${row.pkg.padEnd(9)} says nothing about: ${silent.map((c) => c.key).join(", ") || "(nothing)"}`);
}
console.log("\n  A thin adapter showing neither the right way nor the wrong one is worse than one showing");
console.log("  the wrong one: whoever writes the next consumer starts here and guesses. The three full");
console.log(`  renderers cover all ${CATEGORIES.length} categories; that gap is the teaching debt.`);

console.log("\n## What each column is, and who owns the answer\n");
for (const category of CATEGORIES) {
  console.log(`  ${category.key.padEnd(11)} ${category.what}`);
  console.log(`  ${" ".repeat(11)} owned by: ${category.owns}`);
}

console.log("\n## Where to read first — the densest site per category per package\n");
for (const row of report) {
  if (row.missing || row.literal === 0) continue;
  const worst = CATEGORIES
    .filter((c) => row.counts[c.key] > 0)
    .sort((a, b) => row.counts[b.key] - row.counts[a.key])[0];
  console.log(`  ${row.pkg.padEnd(9)} ${worst.key.padEnd(11)} ${row.counts[worst.key]} occurrence(s), first at ${row.sites[worst.key][0]}`);
}
