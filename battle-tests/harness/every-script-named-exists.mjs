/**
 * Every `npm run <name>` this repository names is a script this repository has.
 *
 * `npm run does-not-exist` exits 1. So does `npm run build:angular` when the build fails. Under
 * `>/dev/null 2>&1` the two are the same event, and a phantom script is a build that did not happen
 * reported as a measurement — a stale `dist` answers whatever is asked next and every reading after it
 * is about code that is not in the tree.
 *
 * Four were run in one evening across two sessions: `build:widgets` and `build:lit` do not exist —
 * widgets and lit are built inside `build:packages` and `build:plain` through `tsc7` — and
 * `build:packages` does not build studio, which cost twenty minutes to a measurement that had not
 * moved. The two guards that already exist catch a *stale* artefact; none of them catches a command
 * that was never a command.
 *
 * This reads text and runs nothing. It is deliberately not a lint rule about how commands are written:
 * it asks one question — does the name exist — because that is the question whose wrong answer is
 * invisible.
 *
 *   node battle-tests/harness/every-script-named-exists.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The scripts a command written in this file could mean.
 *
 * `npm run build` inside `packages/plain` runs that package's own `build`, not the workspace's — so a
 * name is resolved against the nearest `package.json` and then the root, the way npm resolves it. The
 * first version of this checked the root alone and reported twelve packages' own `build` as phantom,
 * which is the guard making the mistake it exists to catch: a wrong answer that reads as a finding.
 */
const scriptsOf = (file) => {
  const names = new Set();
  let dir = file;
  for (let up = 0; up < 8; up += 1) {
    dir = join(dir, "..");
    try {
      const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      for (const name of Object.keys(manifest.scripts ?? {})) names.add(name);
    } catch { /* no manifest at this level */ }
    if (dir === ROOT || dir.length <= ROOT.length) break;
  }
  return names;
};
const ROOT_SCRIPTS = new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts ?? {}));

/** Where a command gets written down. Not `node_modules`, not build output, nothing untracked. */
const LOOK_IN = ["battle-tests", "docs", "scripts", "packages"];
const READABLE = [".md", ".mjs", ".ts", ".js", ".json", ".yml", ".yaml"];
const SKIP = new Set(["node_modules", "dist", ".tmp-browser", "test-results", ".git"]);

function* filesUnder(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { yield* filesUnder(path); continue; }
    if (READABLE.some((kind) => entry.name.endsWith(kind))) yield path;
  }
}

// `npm run x`, `npm run x -- --flag`, `pnpm run x`, and the same inside backticks or a code fence.
const NAMED = /\b(?:npm|pnpm)\s+run\s+([a-zA-Z0-9:_-]+)((?:\s+--?[a-zA-Z0-9:_-]+(?:[= ][^\s`"']+)?)*)/g;

/** This file's own examples name commands that must not exist; it would report itself otherwise. */
const SELF = "battle-tests/harness/every-script-named-exists.mjs";

const phantom = new Map();
for (const where of LOOK_IN) {
  const base = join(ROOT, where);
  try { statSync(base); } catch { continue; }
  for (const file of filesUnder(base)) {
    const here = relative(ROOT, file);
    if (here === SELF) continue;
    const text = readFileSync(file, "utf8");
    const known = new Set([...ROOT_SCRIPTS, ...scriptsOf(file)]);
    for (const [, name, tail] of text.matchAll(NAMED)) {
      // `npm run --silent x` puts a flag where a name goes; the flag is not a script.
      if (name.startsWith("-")) continue;
      // `npm run build --prefix packages/studio` runs *that* package's script, and this file has no
      // way to know which without resolving the prefix — so it is out of scope rather than reported.
      if (/--prefix|--workspace|-w\b|-C\b/.test(tail ?? "")) continue;
      if (known.has(name)) continue;
      const at = phantom.get(name) ?? new Set();
      at.add(relative(ROOT, file));
      phantom.set(name, at);
    }
  }
}

if (phantom.size === 0) {
  console.log(`every named script exists: ${ROOT_SCRIPTS.size} declared at the root, none missing`);
  process.exit(0);
}

// Sorted by how many places name it: a phantom in one file is a typo, in six it is a belief.
const worst = [...phantom].sort((left, right) => right[1].size - left[1].size);
process.stderr.write(
  `\n${phantom.size} script name(s) are written down and do not exist. \`npm run\` exits 1 for a\n` +
    `missing script exactly as it does for a failing one, so under a redirect the two are the same\n` +
    `event and the next measurement reads a stale artefact.\n\n` +
    worst.map(([name, at]) =>
      `  npm run ${name}`.padEnd(34) + `${at.size} place(s): ${[...at].sort().slice(0, 3).join(", ")}\n`).join("") +
    `\nEither the script is missing from package.json, or the text should name the one that does the work.\n\n`,
);
process.exit(1);
