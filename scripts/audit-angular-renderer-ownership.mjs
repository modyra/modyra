/**
 * A renderer draws; the form owns the value.
 *
 * A renderer that calls `setValue`, `markAsDirty` or `markAsTouched` on itself has taken a decision
 * the controller exists to make, and the other renderers will not have taken it the same way.
 *
 * `renderer-ownership-baseline.json` records the calls that exist today so the check can run from
 * today rather than after the last one is cleared. Asserted both ways: a new call fails, and so does
 * a recorded one that has gone.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const rendererRoot = join(root, "packages/angular/src/lib/renderers");
const violations = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) {
      const relative = full.slice(rendererRoot.length + 1);
      const source = readFileSync(full, "utf8");
      for (const match of source.matchAll(/this\.(setValue|markAsDirty|markAsTouched)\s*\(/g)) violations.push({ renderer: relative, mutation: match[1] });
    }
  }
}
walk(rendererRoot);
const BASELINE = join(root, "packages/widgets/contract-baseline/renderer-ownership-baseline.json");
const id = (v) => `${v.renderer}:${v.mutation}`;

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({
    note: "Renderer-owned mutations that exist today. The list may only get shorter.",
    violations: violations.map(id).sort(),
  }, null, 2)}\n`);
  console.log(`Renderer ownership baseline written: ${violations.length} call(s).`);
  process.exit(0);
}

let recorded;
try { recorded = new Set(JSON.parse(readFileSync(BASELINE, "utf8")).violations); }
catch { recorded = new Set(); }

const present = new Set(violations.map(id));
const appeared = violations.filter((v) => !recorded.has(id(v)));
const cleared = [...recorded].filter((r) => !present.has(r));

console.log(JSON.stringify({
  status: appeared.length || cleared.length ? "ANGULAR OWNERSHIP MOVED" : "ANGULAR OWNERSHIP HELD",
  recorded: recorded.size,
  appeared: appeared.map(id),
  cleared,
}, null, 2));
if (appeared.length || cleared.length) {
  console.error("\nRe-record once accounted for: node scripts/audit-angular-renderer-ownership.mjs --write");
  process.exit(1);
}
