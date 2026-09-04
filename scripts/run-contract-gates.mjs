/**
 * The UI contract gates, all of them, in one run.
 *
 * These twenty-six checks used to be a single `&&` chain. A chain reports the first thing that
 * breaks and says nothing about the twenty-five behind it, so a pipeline that is red in four places
 * looks exactly like one that is red in one, and each repair reveals the next wall instead of the
 * remaining distance. Measured on this repository: two hundred consecutive runs, never green, and
 * the failing step moved twice — which nobody could read as progress, because progress and stasis
 * produce the same output.
 *
 * **The commands and their order are the chain's, unchanged.** The only difference is that a failure
 * does not stop the run. Several gates begin by building; the chain repeated those builds too, so
 * nothing here is slower than what it replaces.
 *
 * Exit code is the chain's as well: zero when every gate passes, one when any did not.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

/**
 * The gates, in the order the chain ran them.
 *
 * Written out rather than parsed back out of `package.json`: this list *is* the declaration now, and
 * a runner that read its own work list from the script that invokes it would answer questions about
 * itself.
 */
const GATES = [
  "node scripts/audit-package-independence.mjs",
  "npm run test:import-cycles",
  "npm run test:cross-adapter-similarity",
  "npm run test:type-mirroring",
  "npm run test:widget-contract",
  "npm run test:plain-contract",
  "npm run test:lit-contract",
  "npm run test:contract-adoption",
  "npm run test:coverage-and-demo",
  "npm run test:demo-parity",
  "npm run test:declaration-peers",
  "npm run test:angular-renderer-ownership",
  "npm run test:angular-renderer-budget",
  "npm run test:plain",
  "npm run test:layout-contract",
  "npm run test:contract-coverage",
  "npm run test:conformance-manifest",
  "npm run test:contract-snapshot",
  "npm run audit:unrun-checks",
  "npm run test:type-surface",
  "npm run test:public-doors",
  "npm run test:commit-affordance",
  "npm run test:harness-exceptions",
  "npm run test:deprecations",
  "npm run test:contract-schema",
  "npm run test:platform-floor",
  "npm run test:eslint-plugin",
  "npm run test:docs",
  "npm run test:css-variables",
  "npm run test:conformance",
  "node scripts/audit-patch3-readiness.mjs --require-ready",
];

/** How much of a failed gate's output to show. Enough to name the defect, not enough to bury it. */
const TAIL_LINES = 25;

const failures = [];
const fail = (gate, why, output) => failures.push({ gate, why, output });

/**
 * The last lines that carry anything, so a build's progress chatter does not push the finding out.
 */
function tail(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.slice(-TAIL_LINES).join("\n");
}

const started = Date.now();
console.log(`Contract gates: ${GATES.length}\n`);

for (const [index, gate] of GATES.entries()) {
  const at = Date.now();
  const run = spawnSync(gate, {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
    // Captured rather than inherited: a gate's output is only worth reading when it failed, and
    // twenty-six passing gates printing in full is where a real finding goes to hide.
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const seconds = ((Date.now() - at) / 1000).toFixed(1);
  const label = `${String(index + 1).padStart(2)} ${gate}`;

  // A gate that could not be started at all — a script renamed out from under this list, a missing
  // binary — reports `status: null` and an `error`. Left to `status !== 0` alone that reads as a
  // failure with no output, and left to a truthy check it would read as a pass: the shape of defect
  // where a check answers a question it never asked.
  if (run.error) {
    console.log(`✗ ${label}  (${seconds}s)`);
    fail(gate, `could not be started: ${run.error.message}`, "");
    continue;
  }
  if (run.status !== 0) {
    console.log(`✗ ${label}  (${seconds}s)`);
    fail(gate, `exited ${run.status ?? "on a signal"}`, tail(`${run.stdout}\n${run.stderr}`));
    continue;
  }
  console.log(`✓ ${label}  (${seconds}s)`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(0);

if (failures.length === 0) {
  console.log(`\nCONTRACT GATES CLEAN — ${GATES.length} gate(s) in ${elapsed}s.`);
  process.exit(0);
}

console.log(`\n${failures.length} of ${GATES.length} gate(s) failed, in ${elapsed}s:\n`);
for (const failure of failures) {
  console.log(`── ${failure.gate} — ${failure.why}`);
  if (failure.output) console.log(`${failure.output}\n`);
}
console.log(failures.map((failure) => `  ${failure.gate}`).join("\n"));
process.exit(1);
