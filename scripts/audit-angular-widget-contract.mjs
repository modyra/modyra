import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = join(root, "packages/angular/src/lib");
const baselinePath = join(root, "packages/widgets/contract-baseline/angular-ui.json");
const check = process.argv.includes("--check");
const rendererRoots = [join(sourceRoot, "renderers"), join(sourceRoot, "control")];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) files.push(full);
  }
}
rendererRoots.forEach(walk);
const classes = new Set();
const aria = new Set();
const selectors = new Set();
const rendererModifiers = new Set();
const perFile = {};
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  const fileClasses = [...source.matchAll(/\bmdy-[a-z0-9_-]+/g)].map((m) => m[0]).sort();
  const fileAria = [...source.matchAll(/\baria-[a-z-]+/g)].map((m) => m[0]).sort();
  const fileSelectors = [...source.matchAll(/selector:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort();
  fileClasses.forEach((value) => classes.add(value));
  fileAria.forEach((value) => aria.add(value));
  fileSelectors.forEach((value) => selectors.add(value));
  fileClasses.filter((value) => value.startsWith("mdy-renderer--")).forEach((value) => rendererModifiers.add(value));
  if (fileClasses.length || fileAria.length || fileSelectors.length) {
    perFile[relative(root, file).split("\\").join("/")] = {
      classes: [...new Set(fileClasses)], aria: [...new Set(fileAria)], selectors: [...new Set(fileSelectors)],
    };
  }
}
const manifest = {
  schemaVersion: 1,
  source: "packages/angular/src/lib/{control,renderers}",
  note: "Golden semantic surface before Angular is migrated to the complete @modyra/widgets contract.",
  selectors: [...selectors].sort(),
  rendererModifiers: [...rendererModifiers].sort(),
  classes: [...classes].sort(),
  aria: [...aria].sort(),
  files: perFile,
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  const expected = readFileSync(baselinePath, "utf8");
  if (expected !== serialized) {
    console.error("Angular UI contract differs from packages/widgets/contract-baseline/angular-ui.json");
    console.error("Run: node scripts/audit-angular-widget-contract.mjs --write and review the semantic UI change.");
    process.exit(1);
  }
  console.log(`Angular UI golden contract verified: ${manifest.classes.length} classes, ${manifest.aria.length} ARIA attributes, ${manifest.selectors.length} selectors.`);
} else {
  writeFileSync(baselinePath, serialized);
  console.log(`Wrote ${relative(root, baselinePath)}`);
}
