/**
 * Which checks a change can break that nothing here will run before it is pushed.
 *
 * `audit-unrun-checks` asks whether a workflow reaches a check. That question has a blind spot the
 * size of the local gate: a check can be perfectly reachable in CI and still be the one nobody runs
 * before pushing, and then main goes red for a file the author edited an hour earlier. That happened
 * with `battle:audit` — it lives in the Battle tier, outside `npm run test`, and it reads
 * `battle-tests/**`, which is exactly the tree a session editing battles is in. The gate was
 * reachable, explained, and useless at the moment it could have helped.
 *
 * So this asks the other question: **for a change to these files, which checks would have an
 * opinion, and which of those does the local gate never run?** The answer is a list of commands, not
 * a verdict — it is meant to be read at the moment the author can still act.
 *
 * The checks outside the local gate are derived from the script graph rather than listed: a check
 * that moves into `npm run test` tomorrow drops out of this by itself. What has to be declared is
 * the other half — which paths each of them reads — because no static reading of a script tells you
 * that `battle:audit` cares about `battle-tests/**` and not about `packages/**`.
 *
 *   node scripts/audit-unwatched-changes.mjs               # against origin/main plus the working tree
 *   node scripts/audit-unwatched-changes.mjs --staged      # what a commit is about to contain
 *   node scripts/audit-unwatched-changes.mjs --check       # exit 1 when a check has no declared paths
 */
import { execFileSync } from "node:child_process";
import { ROOT, isACheck, reachableFrom, scriptGraph, workflowRoots } from "./lib/script-graph.mjs";

const STAGED = process.argv.includes("--staged");
/**
 * The reference the change is measured against, `origin/main` unless told otherwise.
 *
 * Configurable because a check like this has to be pointable at a known answer: the run that turned
 * main red is a range, and being able to ask "would this have said so" is the only way to know the
 * map is not decorative.
 */
const since = (() => {
  const at = process.argv.indexOf("--since");
  return at === -1 ? "origin/main" : process.argv[at + 1];
})();
/**
 * An explicit `a..b`, so this can be asked about a commit that is not the head.
 *
 * Without it the map can only ever be checked against the present, and the question worth asking is
 * the historical one: *would this have named the check that went red for that commit?* A map graded
 * only against today grades itself.
 */
const range = (() => {
  const at = process.argv.indexOf("--range");
  return at === -1 ? null : process.argv[at + 1];
})();
const CHECK = process.argv.includes("--check");

/**
 * The paths each check outside the local gate has an opinion about.
 *
 * Declared, with the same discipline as an exemption: a check in the gap with no entry fails, and an
 * entry naming a check no longer in the gap fails too. A map that may be silently incomplete would
 * answer "nothing to run" for the same reason the gate it describes answers "nothing wrong".
 *
 * These are perimeters, not exact triggers. A perimeter that is slightly too wide costs a command
 * somebody did not need to run; one that is too narrow costs a red on main — and the first version
 * of this map was too narrow in exactly the case it was written from. `test:e2e` listed the renderer
 * packages and not `packages/widgets/src`, so the manifest change that emptied a demo page would
 * have been pushed with this check saying nothing. A page is built on the contract as much as on the
 * renderer that draws it, so both are in.
 */
const WATCHES = new Map([
  ["battle:audit", ["battle-tests/"]],
  ["battle:generative", ["battle-tests/generative/", "packages/core/src/", "packages/widgets/src/"]],
  ["battle:angular", ["battle-tests/angular/", "packages/angular/src/"]],
  ["battle:browser:ci", ["packages/core/src/", "packages/widgets/src/", "battle-tests/browser/", "packages/plain/src/", "packages/lit/src/", "packages/styles/src/"]],
  ["battle:campaign", ["battle-tests/generative/"]],
  ["battle:ci", ["battle-tests/", "packages/"]],
  ["test:battle-types", ["battle-tests/types/", "packages/core/src/", "packages/widgets/src/"]],
  ["test:bundle", ["packages/core/src/", "packages/widgets/src/", "packages/angular/src/", "packages/angular/bundle-test/", "scripts/check-bundle.mjs"]],
  ["test:core-bundle", ["packages/core/src/", "docs/guides/comparison-form-libraries.md", "scripts/check-core-bundle.mjs"]],
  ["test:form-scale", ["packages/core/src/", "packages/plain/src/", "scripts/benchmark-forms.mjs"]],
  ["test:themes", ["packages/widgets/src/", "packages/styles/src/", "packages/angular/src/", "packages/lit/src/", "packages/plain/src/"]],
  ["test:styles-architecture", ["packages/styles/src/", "packages/styles/package.json"]],
  ["test:e2e", ["packages/core/src/", "packages/widgets/src/", "e2e/", "examples/", "apps/demo/", "packages/plain/src/", "packages/lit/src/", "packages/styles/src/"]],
  ["test:conformance-browser", ["examples/", "packages/plain/src/", "packages/widgets/src/"]],
  ["test:studio", ["packages/studio-", "apps/studio/", "apps/plain-preview/", "packages/plain/"]],
  ["test:typescript7", ["packages/", "scripts/test-typescript-7.mjs"]],
  ["test:tarballs", ["packages/"]],
  ["test:vscode", ["apps/vscode/"]],
]);

const { scripts, edges } = scriptGraph();
const local = reachableFrom(edges, ["test"]);
const inCI = reachableFrom(edges, [...workflowRoots().values()].flatMap((named) => [...named]));

/** A check CI runs and `npm run test` does not: the population this exists for. */
const gap = Object.keys(scripts)
  .filter((name) => isACheck(name, scripts[name]))
  .filter((name) => inCI.has(name) && !local.has(name))
  .sort();

const undeclared = gap.filter((name) => !WATCHES.has(name));
const stale = [...WATCHES.keys()].filter((name) => !gap.includes(name));

const changed = () => {
  const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  if (range) return git("diff", "--name-only", range).split("\n").filter(Boolean);
  if (STAGED) return git("diff", "--cached", "--name-only").split("\n").filter(Boolean);
  // Everything this head carries that origin/main does not, plus what is not committed yet: the
  // question is about a push, and a push takes both.
  const ahead = git("diff", "--name-only", `${since}...HEAD`).split("\n").filter(Boolean);
  const dirty = git("status", "--porcelain").split("\n").filter(Boolean).map((line) => line.slice(3));
  return [...new Set([...ahead, ...dirty])];
};

const files = changed();
const woken = new Map();
for (const [check, paths] of WATCHES) {
  if (!gap.includes(check)) continue;
  const hits = files.filter((file) => paths.some((path) => file.startsWith(path)));
  if (hits.length > 0) woken.set(check, hits);
}

console.log("# Checks this change can break that `npm run test` will not run\n");
console.log(`Checks CI runs: ${Object.keys(scripts).filter((n) => isACheck(n, scripts[n]) && inCI.has(n)).length}`
  + ` · of those, outside \`npm run test\`: ${gap.length}`);
console.log(`Files ${range ? `in ${range}` : STAGED ? "staged" : `ahead of ${since}, working tree included`}: ${files.length}\n`);
if (!range && !STAGED) {
  // Said here because the bare reading answers a different question than it appears to, and which
  // question depends on who else is working. "Everything ahead of origin/main plus the working tree"
  // is the right subject for one person on one tree; where a second session has a batch open in the
  // same checkout, their files are in that reading and this names the checks *their* work can break.
  // The answer looked authoritative either way — ten commands, no hint that most belonged elsewhere.
  console.log("Reading everything ahead of origin/main plus the working tree. On a shared checkout");
  console.log("that includes another session's open work, so some of what follows may be theirs: ask");
  console.log("`--range <base>..<your commit>` for the checks one push is answerable for.\n");
}

if (woken.size === 0) {
  console.log("Nothing in this change is read by a check the local gate skips.");
} else {
  console.log("Run these before pushing — each reads something this change touches:\n");
  for (const [check, hits] of woken) {
    console.log(`  npm run ${check}`);
    console.log(`      ${hits.slice(0, 3).join(", ")}${hits.length > 3 ? ` and ${hits.length - 3} more` : ""}`);
  }
}

if (undeclared.length > 0) {
  console.log(`\nDEFECT: ${undeclared.length} check(s) outside the local gate declare no paths, so a change`
    + " to what they read cannot be noticed here:");
  for (const name of undeclared) console.log(`  ${name}`);
}
if (stale.length > 0) {
  console.log(`\nDEFECT: ${stale.length} declaration(s) name a check that is no longer outside the local`
    + " gate, or no longer exists — prune them:");
  for (const name of stale) console.log(`  ${name}`);
}
if (CHECK && undeclared.length + stale.length > 0) process.exit(1);
