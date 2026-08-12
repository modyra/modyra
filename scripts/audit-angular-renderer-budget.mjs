/**
 * How much renderer there is, against how much there should be.
 *
 * The budget states the target. It is exceeded today, and raising it to meet the code is how a
 * measurement stops being one — so the target stays put and `overrun` records the distance.
 *
 * `overrun` may shrink and may not grow. A renderer that consumes a controller instead of
 * reimplementing it moves this number down; that is the check's whole purpose.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

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
      lines.set(relative(rendererRoot, full).replaceAll("\\", "/"), source.split("\n").length - 1);
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

if (process.argv.includes("--write")) {
  writeFileSync(OVERRUN, `${JSON.stringify({
    note: "How far past its budget each renderer is today. These numbers may shrink and may not grow.",
    overrun,
  }, null, 2)}\n`);
  console.log(`Renderer overrun baseline written: ${overrun.total} line(s) over budget.`);
  process.exit(0);
}

let recorded;
try { recorded = JSON.parse(readFileSync(OVERRUN, "utf8")).overrun; }
catch { recorded = { total: 0, files: {} }; }

const grown = [];
if (overrun.total > recorded.total) grown.push(`total: ${recorded.total} → ${overrun.total}`);
for (const [file, over] of Object.entries(overrun.files)) {
  const was = recorded.files[file] ?? 0;
  if (over > was) grown.push(`${file}: ${was} → ${over}`);
}
const shrunk = Object.entries(recorded.files).filter(([f, was]) => (overrun.files[f] ?? 0) < was);
if (recorded.total > overrun.total) shrunk.unshift(["total", recorded.total]);

console.log(`Over budget: ${overrun.total} line(s) (recorded: ${recorded.total})`);
if (grown.length) {
  console.error("\nRENDERER GREW AGAINST ITS BUDGET");
  for (const g of grown) console.error(`- ${g}`);
  console.error("\nConsume the contract rather than restating it. Re-record only when the number goes down:");
  console.error("  node scripts/audit-angular-renderer-budget.mjs --write");
  process.exit(1);
}
if (shrunk.length) {
  console.log(`\nShrunk in ${shrunk.length} place(s) — re-record so the ceiling follows:`);
  for (const [f] of shrunk) console.log(`  ${f}`);
  console.log("  node scripts/audit-angular-renderer-budget.mjs --write");
}
