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
import { isACheck, reachableFrom, scriptGraph, workflowRoots } from "./lib/script-graph.mjs";

const CHECK = process.argv.includes("--check");

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
  ["audit:unwatched-changes", "asks which checks a change can break before it is pushed, which is a question about a working tree; in CI the change is already pushed and every check it names is running anyway"],
  ["battle", "the whole battle population under node's own reporter, in the form a person runs while working; CI drives the identical suite through the baseline harness as `battle:ci`, which is the form that has a verdict"],
  ["lint", "run by no workflow and currently failing: 92 errors and 15 warnings across 73 files, none of them introduced by a recent change - it has simply never gated anything. Wiring it in before it is green would put main red on the first push, so it stays outside until the files are clean. This exemption is temporary and its condition is written down: when `npm run lint` exits zero, delete this line and give it a workflow"],
  ["test:perf", "asserts absolute wall-clock thresholds, the tightest at 20ms - a number calibrated on a developer machine, which on a shared runner measures the runner's load rather than this code"],
]);

const { scripts, edges } = scriptGraph();

/** Workflow steps are the roots: what CI actually asks for. */
const rootsByFile = workflowRoots();
const roots = new Set([...rootsByFile.values()].flatMap((named) => [...named]));
const reached = reachableFrom(edges, roots);

const checks = Object.keys(scripts).filter((name) => isACheck(name, scripts[name]));
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
  reached.has(name) || !(name in scripts) || !isACheck(name, scripts[name]));
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
