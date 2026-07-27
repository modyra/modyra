import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const rendererRoot = join(root, "packages/angular/src/lib/renderers");
const allowed = new Set(["select/select-renderer.component.ts"]); // non-user option reconciliation must remain non-dirty
const violations = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) {
      const relative = full.slice(rendererRoot.length + 1);
      if (allowed.has(relative)) continue;
      const source = readFileSync(full, "utf8");
      for (const match of source.matchAll(/this\.(setValue|markAsDirty|markAsTouched)\s*\(/g)) violations.push({ renderer: relative, mutation: match[1] });
    }
  }
}
walk(rendererRoot);
console.log(JSON.stringify({ status: violations.length ? "ANGULAR OWNERSHIP BLOCKED" : "ANGULAR OWNERSHIP CLEAN", violations }, null, 2));
if (violations.length) process.exit(1);
