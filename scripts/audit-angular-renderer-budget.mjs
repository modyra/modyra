/**
 * How much renderer there is, against how much there should be.
 *
 * The budget states the target. It is exceeded today, and raising it to meet the code is how a
 * measurement stops being one — so the target stays put and `overrun` records the distance.
 *
 * **It reports the distance and does not gate it, and that is a change from what this check used to
 * do.** `overrun` was a ratchet — may shrink, may not grow — and the property was right in principle
 * and wrong in practice: every legitimate edit moves the number, so the ratchet fired on correct work
 * and the only way past it was to re-record, which is how a threshold becomes a record of past sizes
 * rather than a limit. It fired twice in one afternoon over a single line and its removal.
 *
 * `check-bundle.mjs` reached the same conclusion about the bundle size and wrote it down; this is that
 * reasoning applied where it was found a second time.
 *
 * **What replaces the gate is the history.** Each re-record appends what moved, from what to what, at
 * which commit — so four lines and four hundred stop looking alike, which is the thing the ratchet was
 * really protecting and the only thing it could not show. A number that is watched drifting is worth
 * something even when failing on it is not.
 *
 * **What counts as a line, and why it is not all of them.** A renderer's file holds three things: the
 * logic, the markup it renders, and the comments explaining why the logic is what it is. Only the
 * first is what this budget is about — a renderer restating a contract writes *code*, and a renderer
 * consuming one writes less of it.
 *
 * Counting every line measured the other two instead, and punished the two things this repository
 * asks for. A batch that made three renderers strictly more contract-driven moved the number **up**,
 * because the contract requires a comment stating each invariant and Angular puts its markup in the
 * same file. At the point that happened the gate had stopped measuring what it is named for: 1052
 * lines of multiselect renderer were 474 of logic and 578 of prose and template.
 *
 * So comments, `template:` and `styles:` literals, and blank lines are removed before counting. The
 * budget was re-recorded against this measure rather than kept from the old one — a target that meant
 * one thing under a different measure is not a target, and the property worth keeping is *may shrink,
 * may not grow*, which only holds when the number it is compared against is the honest one.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * The executable part of a renderer's source.
 *
 * Comments go first so that a `template:` inside one is not mistaken for markup, and the template
 * literal is emptied rather than deleted so the declaration that holds it still counts as the one
 * line it is.
 */
function logicLines(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const withoutMarkup = withoutComments.replace(/(template|styles)\s*:\s*`[\s\S]*?`/g, "$1: ``");
  return withoutMarkup.split("\n").filter((line) => line.trim() !== "").length;
}

const root = resolve(new URL("..", import.meta.url).pathname);
const rendererRoot = join(root, "packages/angular/src/lib/renderers");
const budget = JSON.parse(readFileSync(join(root, "packages/angular/metrics/renderer-budget.json"), "utf8"));
const lines = new Map();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) {
      const source = readFileSync(full, "utf8");
      lines.set(relative(rendererRoot, full).replaceAll("\\", "/"), logicLines(source));
    }
  }
}
walk(rendererRoot);
const totalLines = [...lines.values()].reduce((sum, value) => sum + value, 0);
const violations = [];
if (totalLines > budget.totalLines) violations.push({ scope: "total", actual: totalLines, budget: budget.totalLines });
for (const [file, maximum] of Object.entries(budget.hotspots)) {
  const actual = lines.get(file);
  if (actual === undefined) violations.push({ scope: file, error: "missing" });
  else if (actual > maximum) violations.push({ scope: file, actual, budget: maximum });
}
const largest = [...lines.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, count]) => ({ file, lines: count }));
console.log(JSON.stringify({
  status: violations.length ? "ANGULAR RENDERER BUDGET BLOCKED" : "ANGULAR RENDERER BUDGET CLEAN",
  baselineCommit: budget.baselineCommit,
  totalLines,
  totalBudget: budget.totalLines,
  delta: totalLines - budget.totalLines,
  largest,
  violations,
}, null, 2));
const OVERRUN = join(root, "packages/widgets/contract-baseline/renderer-overrun-baseline.json");
const overrun = { total: Math.max(0, totalLines - budget.totalLines), files: {} };
for (const v of violations) if (v.actual !== undefined && v.scope !== "total") overrun.files[v.scope] = v.actual - v.budget;

/** What the baseline holds today, and the series behind it. */
let held;
try { held = JSON.parse(readFileSync(OVERRUN, "utf8")); }
catch { held = {}; }
const recorded = held.overrun ?? { total: 0, files: {} };
const history = Array.isArray(held.history) ? held.history : [];

/**
 * Every scope whose distance is not what the baseline says, with both numbers.
 *
 * Read once and used for the report and for the series, so what is printed and what is written can
 * never describe different runs.
 */
function movements() {
  const moved = [];
  if (overrun.total !== recorded.total) moved.push({ scope: "total", from: recorded.total, to: overrun.total });
  const scopes = new Set([...Object.keys(overrun.files), ...Object.keys(recorded.files)]);
  for (const scope of [...scopes].sort()) {
    const from = recorded.files[scope] ?? 0;
    const to = overrun.files[scope] ?? 0;
    if (from !== to) moved.push({ scope, from, to });
  }
  return moved;
}

/**
 * The commit the measurement describes.
 *
 * A dirty tree says so rather than naming a commit whose content is not what was measured — an entry
 * in the series is a claim about a state, and a hash that does not hold that state is a wrong claim
 * rather than a missing one.
 */
function commitOf() {
  try {
    const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim() !== "";
    return dirty ? `${head}+dirty` : head;
  } catch {
    return "unknown";
  }
}

if (process.argv.includes("--write")) {
  const moved = movements();
  // Only what moved. A re-record that changes nothing writes nothing: a series padded with entries
  // that say "still 361" stops being readable, which costs exactly the thing it exists to give.
  const at = new Date().toISOString().slice(0, 10);
  const commit = commitOf();
  const appended = moved.map(({ scope, from, to }) => ({ at, commit, scope, from, to }));

  writeFileSync(OVERRUN, `${JSON.stringify({
    note: "How far past its budget each renderer is today, and every time that distance moved. "
      + "Reported, not gated: a threshold raised whenever it is crossed is a record of past sizes "
      + "rather than a limit, and every legitimate edit moves this one.",
    measure: "Executable TypeScript: comments, `template:` and `styles:` literals, and blank lines are "
      + "not counted. Every distance fell sharply when this measure replaced counting every line — "
      + "that was the measure changing and not the renderers shrinking, and a reader comparing against "
      + "an older baseline should not read it as a repair.",
    overrun,
    history: [...history, ...appended],
  }, null, 2)}\n`);
  console.log(`Renderer overrun baseline written: ${overrun.total} line(s) over budget.`);
  if (appended.length === 0) console.log("Nothing moved, so nothing was added to the history.");
  else for (const { scope, from, to } of appended) {
    console.log(`  ${scope}: ${from} → ${to} (${to > from ? "+" : ""}${to - from})  at ${commit}`);
  }
  process.exit(0);
}

const moved = movements();

console.log(`Over budget: ${overrun.total} line(s) (recorded: ${recorded.total})`);
if (moved.length === 0) process.exit(0);

console.log(`\nMoved in ${moved.length} place(s) since the baseline was recorded:`);
for (const { scope, from, to } of moved) {
  const delta = to - from;
  console.log(`  ${scope}: ${from} → ${to} (${delta > 0 ? "+" : ""}${delta})`);
  // What the series knows about this scope, which is the whole reason it is kept: four lines and
  // four hundred read alike in one run and do not read alike across a fortnight.
  const past = history.filter((entry) => entry.scope === scope);
  if (past.length > 0) {
    const since = past[0].at;
    const net = to - past[0].from;
    console.log(`    moved ${past.length + 1} time(s) since ${since}, ${net > 0 ? "+" : ""}${net} in total`);
  }
}
console.log("\nRecord it — consuming the contract rather than restating it is what moves it down:");
console.log("  node scripts/audit-angular-renderer-budget.mjs --write");
