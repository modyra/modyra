import { readFileSync, readdirSync, statSync } from "node:fs";
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
if (violations.length) process.exit(1);
