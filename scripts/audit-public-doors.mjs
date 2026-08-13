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
 *
 * The same pass answers a second question the other surface gates cannot: **does every import in
 * this repository still resolve?** A subpath that leaves the `exports` map takes no type with it, so
 * the type-surface snapshot reports nothing; the widget catalogue is untouched, so the contract
 * differ reports `patch`. The place that breaks first is a demo, and demos are built by the e2e
 * chain rather than by `npm run test`. Reading the imports is cheaper than building them and finds
 * the same thing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
// Every package a demo, an app or a test can import, not only the two that publish a contract:
// the check exists because a removal reached a demo unnoticed, and a demo does not care which
// package the name came from.
const PACKAGES = ["core", "widgets", "plain", "styles"];

let failures = 0;
/** Per package: name → the subpaths that publish it. */
const published = new Map();
for (const pkg of PACKAGES) {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, `packages/${pkg}/package.json`), "utf8"));
  const entries = [];
  // A stylesheet entry is a door with nothing to name: it must resolve, and there is no symbol to
  // publish twice. Recorded so an import of one is checked rather than skipped.
  const assets = [];
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const js = typeof target === "string" ? target : (target.import ?? target.default ?? "");
    if (!String(js).endsWith(".js")) {
      if (String(js)) assets.push(subpath);
      continue;
    }
    const declaration = resolve(ROOT, `packages/${pkg}`, String(js).replace(/\.js$/, ".d.ts"));
    if (existsSync(declaration)) entries.push([subpath, declaration]);
  }
  if (entries.length === 0 && assets.length === 0) continue;

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

  for (const subpath of assets) {
    if (!doors.has(subpath)) doors.set(subpath, []);
    doors.get(subpath).push(subpath);
  }
  published.set(pkg, doors);

  const multi = [...doors].filter(([, subpaths]) => subpaths.length > 1);
  console.log(
    `@modyra/${pkg}: ${entries.length + assets.length} subpaths, ${doors.size} public names, ${multi.length} reachable from more than one`,
  );
  for (const [name, subpaths] of multi) {
    console.log(`  ${name}  ←  ${subpaths.join(", ")}`);
    failures += 1;
  }
}

/**
 * Every import of a package published from this workspace, checked against what the
 * package publishes — the subpath and the names alike.
 *
 * Sources only. A compiled `dist` mirrors its source and a changelog describes a surface that has
 * since moved on; both would report a break that does not exist.
 */
const ROOTS = ["packages", "examples", "apps", "e2e", "scripts", "site/src", "docs"];
const SKIP = new Set(["node_modules", "dist", ".astro", "test-results", "contract-baseline"]);
const SOURCE = /\.(ts|tsx|mts|mjs|js|jsx|svelte|vue)$/;
const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+\w+|\w+)?\s*(?:from\s*)?["']@modyra\/(core|widgets|plain|styles)(\/[^"']+)?["']/g;

const unresolved = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!SOURCE.test(entry)) continue;
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const [, names, pkg, tail] = match;
      const doors = published.get(pkg);
      if (!doors) continue;
      const subpath = tail ? `.${tail}` : ".";
      const declared = new Set([...doors.values()].flat());
      if (!declared.has(subpath)) {
        unresolved.push([relative(ROOT, path), `@modyra/${pkg}${tail ?? ""} is not a declared subpath`]);
        continue;
      }
      for (const raw of (names ?? "").split(",")) {
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        if (!doors.get(name)?.includes(subpath)) {
          unresolved.push([relative(ROOT, path), `${name} is not published by @modyra/${pkg}${tail ?? ""}`]);
        }
      }
    }
  }
};
for (const root of ROOTS) if (existsSync(resolve(ROOT, root))) walk(resolve(ROOT, root));

if (unresolved.length > 0) {
  console.log(`\n${unresolved.length} import(s) name something the package does not publish:`);
  for (const [file, what] of unresolved) console.log(`  ${file}: ${what}`);
  failures += unresolved.length;
} else {
  console.log(`Every ${PACKAGES.map((p) => `@modyra/${p}`).join(", ")} import in the repository resolves.`);
}

if (failures > 0) {
  console.log(
    "\nPUBLIC DOORS AMBIGUOUS — publish each name from one subpath. An aggregate that re-exports a\n" +
      "granular subpath means one of the two is redundant; keep whichever names a domain.",
  );
  process.exit(1);
}
console.log("PUBLIC DOORS UNAMBIGUOUS");
