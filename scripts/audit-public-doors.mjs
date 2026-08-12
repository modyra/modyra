#!/usr/bin/env node
/**
 * One door per public symbol.
 *
 * A package's `exports` map is its public surface, and a name reachable from two subpaths is a name
 * a reader has to check twice to learn whether the two are the same thing. They always were here —
 * every duplicate found was an aggregate published alongside the granular files it re-exported — but
 * the adapters had split themselves across the aliases, so three of them imported the same symbol by
 * three different paths and no reader could tell that was accidental.
 *
 * Types count. A type alias reachable from two subpaths misleads exactly as much as a function does,
 * and is what a `.d.ts`-only entry publishes, so the check runs through the checker rather than
 * through `import()`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PACKAGES = ["core", "widgets"];

let failures = 0;
for (const pkg of PACKAGES) {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, `packages/${pkg}/package.json`), "utf8"));
  const entries = [];
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const js = typeof target === "string" ? target : (target.import ?? target.default ?? "");
    if (!String(js).endsWith(".js")) continue;
    const declaration = resolve(ROOT, `packages/${pkg}`, String(js).replace(/\.js$/, ".d.ts"));
    if (existsSync(declaration)) entries.push([subpath, declaration]);
  }
  if (entries.length === 0) continue;

  const program = ts.createProgram(entries.map(([, file]) => file), { allowJs: false });
  const checker = program.getTypeChecker();
  const doors = new Map();
  for (const [subpath, file] of entries) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const symbol = checker.getSymbolAtLocation(source);
    if (!symbol) continue;
    for (const exported of checker.getExportsOfModule(symbol)) {
      const name = exported.getName();
      if (!doors.has(name)) doors.set(name, []);
      doors.get(name).push(subpath);
    }
  }

  const multi = [...doors].filter(([, subpaths]) => subpaths.length > 1);
  console.log(
    `@modyra/${pkg}: ${entries.length} subpaths, ${doors.size} public names, ${multi.length} reachable from more than one`,
  );
  for (const [name, subpaths] of multi) {
    console.log(`  ${name}  ←  ${subpaths.join(", ")}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.log(
    "\nPUBLIC DOORS AMBIGUOUS — publish each name from one subpath. An aggregate that re-exports a\n" +
      "granular subpath means one of the two is redundant; keep whichever names a domain.",
  );
  process.exit(1);
}
console.log("PUBLIC DOORS UNAMBIGUOUS");
