/**
 * A type a published package names is a type its consumer can resolve.
 *
 * The declarations we ship import from outside — `react`, `vue`, `lit`, `zod`. A consumer compiling
 * against them has to be able to follow every one of those imports, and two separate things have to
 * be true for that: the module must be declared, and its *types* must be reachable. They are not the
 * same thing, and the second is the one that gets missed, because in the workspace both are always
 * true — every framework is installed at the root, and nothing here compiles the way a consumer does.
 *
 * `@modyra/react` shipped a declaration importing `react` while `@types/react` was declared nowhere.
 * `react` is one of the few packages that ships no types of its own, so the consumer's compiler had
 * the module and no shape for it: `TS7016`, at the consumer, after a release. Everything in the
 * workspace was green, because `@types/react` is installed here for reasons that have nothing to do
 * with what we publish.
 *
 * The tarball audit finds this too — it installs and compiles for real, which is stronger evidence
 * than anything read from a file. What it cannot do is be quick: it packs every package and runs an
 * install, so it lives in CI and answers minutes after a push. This asks the same question of the
 * files, in under a second, before the push — and names the package, the specifier and which of the
 * two halves is missing.
 *
 * **It reads declarations, not a compile.** A specifier this cannot see — one built from a variable,
 * or reached through a triple-slash reference — is a specifier it does not check, and the tarball
 * audit remains the thing that compiles. Comments are stripped first: `from "no such rule"` inside a
 * doc block is prose, and counting it invents an undeclared dependency in the package with the best
 * documentation.
 *
 *   node scripts/audit-declaration-peers.mjs           # report
 *   node scripts/audit-declaration-peers.mjs --check   # and exit 1 on a finding
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { publishedPackageDirs } from "./lib/published-packages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

/** Every declaration file a package ships. */
function declarationsUnder(dir) {
  const found = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".d.ts")) found.push(path);
    }
  };
  if (existsSync(dir)) walk(dir);
  return found;
}

/** The package a specifier belongs to: `@scope/name/deep` is `@scope/name`, `name/deep` is `name`. */
const packageOf = (specifier) => specifier.startsWith("@")
  ? specifier.split("/").slice(0, 2).join("/")
  : specifier.split("/")[0];

/** What the `@types` package for a module is called: `@scope/name` becomes `@types/scope__name`. */
const typesPackageFor = (name) => name.startsWith("@")
  ? `@types/${name.slice(1).replace("/", "__")}`
  : `@types/${name}`;

/**
 * Where a module is installed, looked for beside the package first.
 *
 * A workspace hoists, and this deliberately does not care which copy answers: the question is what a
 * module ships, and every copy of a version ships the same thing.
 */
function installedManifest(pkg, name) {
  for (const base of [join(ROOT, "packages", pkg, "node_modules"), join(ROOT, "node_modules")]) {
    const manifest = join(base, name, "package.json");
    if (existsSync(manifest)) return { dir: join(base, name), manifest: JSON.parse(readFileSync(manifest, "utf8")) };
  }
  return null;
}

/**
 * Whether a module carries its own types.
 *
 * Three ways it can, and a module using none of them needs a `@types/` package: the `types` or
 * `typings` field, an `index.d.ts` beside its entry, or a `types` condition inside `exports`. Missing
 * all three is the `react` case, and it is rarer than it feels — most of the frameworks here ship
 * their own, which is exactly why the one that does not went unnoticed.
 */
function shipsTypes(found) {
  if (found === null) return null;
  const { dir, manifest } = found;
  if (typeof manifest.types === "string" || typeof manifest.typings === "string") return true;
  if (existsSync(join(dir, "index.d.ts"))) return true;
  return JSON.stringify(manifest.exports ?? {}).includes('"types"');
}

const findings = [];
const rows = [];

for (const pkg of publishedPackageDirs()) {
  const dir = join(ROOT, "packages", pkg);
  const files = declarationsUnder(join(dir, "dist"));
  if (files.length === 0) continue;

  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  const imported = new Set();
  for (const file of files) {
    const code = withoutComments(readFileSync(file, "utf8"));
    for (const match of code.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      const name = packageOf(specifier);
      // A package's own name inside its declarations is how a multi-entry build refers to itself.
      if (name === manifest.name) continue;
      imported.add(name);
    }
  }

  const notes = [];
  for (const name of [...imported].sort()) {
    if (!declared.has(name)) {
      findings.push(`${manifest.name}: its declarations import \`${name}\`, which is in neither`
        + " `dependencies` nor `peerDependencies` — a consumer installing this package does not get it");
      notes.push(`${name} UNDECLARED`);
      continue;
    }
    const own = shipsTypes(installedManifest(pkg, name));
    if (own === null) { notes.push(`${name} (not installed here, unchecked)`); continue; }
    if (own) { notes.push(name); continue; }
    const types = typesPackageFor(name);
    if (declared.has(types)) { notes.push(`${name} +${types}`); continue; }
    findings.push(`${manifest.name}: its declarations import \`${name}\`, which ships no types of its`
      + ` own, and \`${types}\` is declared nowhere — a consumer compiling against this package gets`
      + " TS7016 on every one of those imports");
    notes.push(`${name} NEEDS ${types}`);
  }

  rows.push(`  ${pkg.padEnd(17)} ${String(files.length).padStart(4)} .d.ts  `
    + (imported.size === 0 ? "imports nothing outside itself" : notes.join(", ")));
}

console.log("# Types a consumer must resolve\n");
console.log("Read from published declarations with comments stripped — not from a compile.\n");
console.log(rows.join("\n"));

if (findings.length === 0) {
  console.log("\nEVERY IMPORTED TYPE IS REACHABLE — each specifier is declared, and carries types or names an `@types` peer.");
} else {
  console.log(`\nUNREACHABLE TYPES — ${findings.length}\n`);
  for (const finding of findings) console.log(`  - ${finding}`);
  console.log("\n  The tarball audit proves this by compiling; this is the same question asked of the"
    + "\n  files, so it can be answered before a push rather than after one.");
  if (CHECK) process.exit(1);
}
