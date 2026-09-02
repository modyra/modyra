/**
 * Which checks exist and no workflow runs.
 *
 * A gate nobody executes is indistinguishable from a gate that passes, and it decays without anyone
 * seeing it decay: `test:conformance-browser` sat in `package.json` and in no workflow, and when it
 * was finally run it produced eleven findings that had been wrong for as long as nobody looked. The
 * cost was not the eleven. It was that a published kit had been reporting falsely and the repository
 * had no way to notice.
 *
 * So the question is asked mechanically: for every check-shaped script, is there a path from some
 * workflow step to it?
 *
 * **Reachability, not mention.** Most checks are not named by any workflow directly — they are run by
 * an aggregate (`test` runs a dozen; `test:contracts` runs its gate list). Grepping the workflows for
 * a script name reports almost everything as unrun and is worthless. The edges followed here are:
 *
 *   - a script body invoking `npm run X` / `pnpm run X` / `pnpm -w run X`;
 *   - the contract gate runner's own list, which names its gates as commands in a JS array rather
 *     than in `package.json`, so a parser that only reads `package.json` misses every one of them.
 *
 * **What "unrun" means here, and what it does not.** It means no *workflow* reaches it. A check may
 * still be run by a person, by a hook, or by another check's setup; and a check may be deliberately
 * out of CI because it is slow, needs a secret, or answers a question CI cannot ask. Those are
 * legitimate, which is why the exemption list below carries a reason per entry rather than a name —
 * an exemption that does not say why is a silence with a comment on it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** A script whose name says it verifies something. These are the ones a workflow ought to reach. */
const IS_A_CHECK = /^(test|battle|audit|contract):/;

/**
 * Checks knowingly outside every workflow, each with the reason it is outside.
 *
 * The reason is the point. "Not in CI" is a fact; "not in CI because it measures wall-clock on a
 * machine whose speed CI does not control" is a decision someone can disagree with.
 */
const DELIBERATELY_OUTSIDE = new Map([
  ["battle:replay", "replays one recorded seed on demand; it answers a question about a past run, not about this head"],
  ["battle:quick", "the same adversarial population the CI tier drives through its baseline harness, in the form a person runs while working"],
  ["battle:browser", "the browser battles under playwright's own reporter; CI runs the identical suite through the baseline harness, which is the form that has a verdict"],
  ["contract:snapshot", "writes the committed snapshot rather than checking it - running it in CI would make the gate agree with whatever it had just recorded"],
  ["audit:visual-debt", "answers about baselines that can only be recorded after a push, so a red in CI would be a red on a state that is allowed to be true"],
  ["contract:diff", "the same script as `test:contract-snapshot` without `--check`, plus a build: it classifies a change for the person deciding a release, while the detection that a change happened is the `--check` form, which is in the gate list CI runs"],
  ["test:perf", "asserts absolute wall-clock thresholds, the tightest at 20ms - a number calibrated on a developer machine, which on a shared runner measures the runner's load rather than this code"],
]);

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

/** Every `npm run X` / `pnpm run X` in a blob of shell, whatever flags sit between. */
function scriptsInvokedBy(text) {
  const found = new Set();
  for (const match of text.matchAll(/\b(?:npm|pnpm|yarn)\s+(?:(?:-w|--filter[= ][^\s]+|--silent|-s|run-script)\s+)*run\s+(?:-s\s+|--silent\s+)*([\w:.-]+)/g)) {
    found.add(match[1]);
  }
  return found;
}

/**
 * The contract gate runner names its gates as commands in its own source. They are real edges and
 * they are invisible to anything that reads only `package.json`.
 */
function gatesOfTheContractRunner() {
  const source = readFileSync(join(ROOT, "scripts/run-contract-gates.mjs"), "utf8");
  const start = source.indexOf("const GATES");
  if (start === -1) return new Set();
  const block = source.slice(start, source.indexOf("\n];", start));
  return scriptsInvokedBy(block);
}

const edges = new Map();
for (const [name, body] of Object.entries(scripts)) edges.set(name, scriptsInvokedBy(body));
edges.set("test:contracts", new Set([...(edges.get("test:contracts") ?? []), ...gatesOfTheContractRunner()]));

/** Workflow steps are the roots: what CI actually asks for. */
const workflowDir = join(ROOT, ".github/workflows");
const roots = new Set();
const rootsByFile = new Map();
for (const file of readdirSync(workflowDir).filter((n) => /\.ya?ml$/.test(n))) {
  const named = scriptsInvokedBy(readFileSync(join(workflowDir, file), "utf8"));
  rootsByFile.set(file, named);
  for (const name of named) roots.add(name);
}

const reached = new Set();
const walk = (name) => {
  if (reached.has(name)) return;
  reached.add(name);
  for (const next of edges.get(name) ?? []) walk(next);
};
for (const root of roots) walk(root);

const checks = Object.keys(scripts).filter((name) => IS_A_CHECK.test(name));
const unrun = checks.filter((name) => !reached.has(name));
const unexplained = unrun.filter((name) => !DELIBERATELY_OUTSIDE.has(name));

console.log("# Checks no workflow runs\n");
console.log(`Workflows read: ${[...rootsByFile.keys()].join(", ")}`);
console.log(`Scripts named directly by a workflow: ${roots.size}`);
console.log(`Check-shaped scripts: ${checks.length} · reached through those roots: ${checks.length - unrun.length}\n`);

if (unrun.length > 0) {
  console.log("Outside every workflow:\n");
  for (const name of unrun) {
    const reason = DELIBERATELY_OUTSIDE.get(name);
    console.log(`  ${reason ? "·" : "!"} ${name.padEnd(32)} ${reason ?? "NO STATED REASON"}`);
  }
  console.log("");
}

// A stale exemption is the same defect wearing the opposite sign: it says a check is knowingly
// outside CI when a workflow has since started running it, and it would keep saying so after the
// check was removed entirely.
const staleExemptions = [...DELIBERATELY_OUTSIDE.keys()].filter((name) =>
  // Reached: a workflow started running it and the exemption now argues against the facts.
  // Absent: the script is gone. Not check-shaped: the exemption can never be consulted, so it reads
  // as covering something while covering nothing — the quietest of the three.
  reached.has(name) || !(name in scripts) || !IS_A_CHECK.test(name));
if (staleExemptions.length > 0) {
  console.log(`Exemptions that no longer describe anything: ${staleExemptions.join(", ")}\n`);
}

if (unexplained.length === 0 && staleExemptions.length === 0) {
  console.log(`EVERY CHECK IS REACHED OR EXPLAINED — ${unrun.length} deliberately outside, each with a reason.`);
} else {
  console.log(`UNRUN CHECKS — ${unexplained.length} with no stated reason, ${staleExemptions.length} stale exemption(s)`);
  console.log("\n  A check no workflow runs cannot be distinguished from one that passes. Either put it in"
    + "\n  a workflow, or record here why it is outside — the reason is what makes the absence reviewable.");
  if (CHECK) process.exit(1);
}
