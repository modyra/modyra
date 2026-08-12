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
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", "coverage", ".angular", "contract-baseline"]);

/**
 * For each package, the packages it may not mention.
 *
 * The reactivity adapters belong here for the same reason the renderers do. `packages/plain`'s
 * schema module names `packages/react`'s as the source it reimplements — a peer cited as the
 * reference, which is the inversion this file exists to catch, and it passed for as long as the
 * five were absent from this table.
 */
const ADAPTERS = ["angular", "lit", "plain", "react", "preact", "vue", "svelte", "solid"];
const FORBIDDEN = {
  core: ADAPTERS,
  widgets: ADAPTERS,
  ...Object.fromEntries(ADAPTERS.map((a) => [a, ADAPTERS.filter((other) => other !== a)])),
};

/**
 * How each package is recognised when named.
 *
 * Two spellings matter for every one of them: the package specifier, and the workspace path. A
 * comment citing `packages/lit/src/...` names the package as surely as `@modyra/lit` does, and the
 * path spelling is lowercase — which is how one such citation sat here unnoticed under a pattern
 * that required a capital L.
 *
 * The bare capitalised word is added only where it is unambiguous. `Vue`, `React` and `Solid` name
 * the frameworks these adapters bind, which every one of them must be free to say about itself and
 * about the primitive it wraps; the package reference is what this rule is about.
 */
const pkgPattern = (name, bareWord) =>
  new RegExp(`@modyra/${name}\\b|packages/${name}/${bareWord ? `|\\b${bareWord}\\b` : ""}`);
const PATTERN = {
  // `Angular` capitalised is the framework; lowercase inside a word (e.g. "triangular") is not.
  angular: pkgPattern("angular", "Angular"),
  lit: pkgPattern("lit", "Lit"),
  // Only the package spelling: "plain" is an ordinary adjective in this codebase.
  plain: pkgPattern("plain"),
  react: pkgPattern("react"),
  preact: pkgPattern("preact"),
  vue: pkgPattern("vue"),
  svelte: pkgPattern("svelte"),
  solid: pkgPattern("solid"),
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

    /**
     * A file *named after* another package, which is a whole word in the name and not a substring
     * of one. `reactivity.ts` is not named after `@modyra/react`, and a check that says it is
     * teaches the reader to skim past this list.
     */
    const nameTokens = new Set(shown.toLowerCase().split(/[-._/]+/));
    for (const other of forbidden) {
      if (nameTokens.has(other) && !shown.includes(`packages/${other}/`)) {
        failures.push(`${shown}: a file named after @modyra/${other}`);
      }
    }
    if (!/\.(ts|mjs|js)$/.test(file)) continue;

    /**
     * Code as well as comments.
     *
     * A comment naming a peer is the documented half of the rule and was the only half checked. An
     * import, a string, a path in a build step names it just as concretely — and unlike a comment,
     * it is what runs.
     */
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const other of forbidden) {
        if (PATTERN[other].test(line)) {
          failures.push(`${shown}:${index + 1}: names @modyra/${other} — ${line.trim().slice(0, 72)}`);
        }
      }
    });
  }
}

/**
 * The references that exist today, so the widened rule can run from today.
 *
 * The rule was previously enforced over five packages and comment lines only. Widening it to all
 * eight and to code found references the narrow version could not see; recording them is what lets
 * the check guard against the next one instead of waiting for the last one to be cleared. The list
 * is asserted both ways: a new reference fails, and so does a recorded one that has been removed.
 */
const BASELINE = join(root, "packages/widgets/contract-baseline/package-independence-baseline.json");
const key = (failure) => failure.split(" — ")[0];

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({
    note: "Each entry names a package it must not. Rewrite the sentence to describe the behaviour; the list may only get shorter.",
    references: failures.sort(),
  }, null, 2)}\n`);
  console.log(`Package independence baseline written: ${failures.length} reference(s).`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); }
catch { baseline = { references: [] }; }

const recorded = new Set(baseline.references.map(key));
const present = new Set(failures.map(key));
const appeared = failures.filter((f) => !recorded.has(key(f)));
const cleared = baseline.references.filter((f) => !present.has(key(f)));

console.log(`Package independence: ${failures.length} recorded reference(s) to a package that must not be named.`);

if (appeared.length > 0) {
  console.error(`\n${appeared.length} new reference(s):\n`);
  for (const failure of appeared) console.error("  " + failure);
  console.error("\nDescribe the behaviour, not who consumes it. Move an adapter's own material into that adapter.");
}
if (cleared.length > 0) {
  console.log(`\n${cleared.length} reference(s) cleared — re-record so the list stops claiming them:`);
  for (const failure of cleared) console.log("  " + failure);
  console.error("\n  node scripts/audit-package-independence.mjs --write");
}
if (appeared.length > 0 || cleared.length > 0) process.exit(1);

console.log("No package names one it must not know about, beyond what is recorded.");
