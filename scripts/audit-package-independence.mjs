/**
 * A package does not name the packages it must not know about.
 *
 * The import graph has been clean throughout, and that is not the whole rule. A file named after
 * another package, or a comment citing one as the reference this code follows, inverts the
 * responsibility just as surely — and nothing in a build objects, which is why it survives. It had:
 * an `angular-ui.json` recording one renderer's surface sat in `@modyra/widgets`' own baseline
 * directory, imported by nothing and therefore complained about by nothing.
 *
 * Who may name whom:
 *
 * - `@modyra/core` and `@modyra/widgets` are the contract. They name no adapter at all: every
 *   adapter is a derivation, and a contract explaining itself by one of its consumers is describing
 *   the wrong thing.
 * - An adapter may name itself and nothing else. Siblings are peers, not references — "the anatomy
 *   Angular established" in the framework-free renderer is the same inversion one layer down.
 *
 * Run by `test:contracts`. `plain` is only counted when spelled as the package, because it is also
 * an ordinary English word: a plain button, a plain array.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", "coverage", ".angular", "contract-baseline"]);

/** For each package, the packages it may not mention. */
const FORBIDDEN = {
  core: ["angular", "lit", "plain"],
  widgets: ["angular", "lit", "plain"],
  plain: ["angular", "lit"],
  lit: ["angular", "plain"],
  angular: ["lit", "plain"],
};

const PATTERN = {
  // `Angular` capitalised is the framework; lowercase inside a word (e.g. "triangular") is not.
  angular: /\bAngular\b|@modyra\/angular/,
  lit: /\bLit\b|@modyra\/lit/,
  // Only the package spelling: "plain" is an ordinary adjective in this codebase.
  plain: /@modyra\/plain/,
};

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const failures = [];

for (const [pkg, forbidden] of Object.entries(FORBIDDEN)) {
  const base = join(root, "packages", pkg);
  for (const file of walk(base)) {
    const shown = relative(root, file);
    if (shown.includes("audit-package-independence")) continue;

    for (const other of forbidden) {
      if (file.toLowerCase().includes(`/${other}`) && !shown.includes(`packages/${other}/`)) {
        failures.push(`${shown}: a file named after @modyra/${other}`);
      }
    }
    if (!/\.(ts|mjs|js)$/.test(file)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const other of forbidden) {
        if (PATTERN[other].test(line)) {
          failures.push(`${shown}:${index + 1}: names @modyra/${other} — ${line.trim().slice(0, 72)}`);
        }
      }
    });
  }
}

if (failures.length > 0) {
  console.error(`Package independence: ${failures.length} reference(s) to a package that must not be named.\n`);
  for (const failure of failures) console.error("  " + failure);
  console.error("\nDescribe the behaviour, not who consumes it. Move an adapter's own material into that adapter.");
  process.exit(1);
}

console.log("Package independence: no package names one it must not know about.");
