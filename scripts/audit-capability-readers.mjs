/**
 * A capability the contract declares, and how many files in each renderer read it.
 *
 * The widget contract declares capabilities per kind — whether a kind has an overlay, whether it
 * dismisses on an outside pointer, whether focus settling elsewhere closes it. Each is a promise a
 * consumer can read, and each is a promise a renderer must keep.
 *
 * **A capability whose readers are lopsided across renderers is a door that is missing.** When the
 * rule lives written inside every renderer that honours it, the ones that do not honour it are
 * silent in exactly the same way as the ones that have nothing to honour — and three implementations
 * written by the same hands agreeing is indistinguishable from conformance until somebody outside
 * the room implements the contract from the catalogue alone.
 *
 * That is not a hypothesis. `dismissOnFocusOutside` read seven files in one renderer, seven in
 * another, two in a third and none in the last two; the repair was to move the rule into a door the
 * contract owns, and this count found it before any red did. A red says a claim was cited; this says
 * a capability was consumed.
 *
 * **What it reads, said plainly.** Renderer source with comments stripped, counting *files that name
 * the capability*, never call sites and never behaviour. A renderer reaching the same promise under
 * another name is invisible here, and so is one that names it and does nothing. It is a detector for
 * where to look, not a verdict — the browser tier and the conformance kit are what decide whether a
 * promise is kept.
 *
 * **The signal inverts once a door exists, and that is the trap.** While a rule lives inside every
 * renderer, many readers mean adoption and none means a gap. After the contract takes the rule into a
 * door, a renderer that delegates correctly may name the capability nowhere at all — silence becomes
 * the success condition. `dismissOnFocusOutside` shows exactly this: it is read in three renderers and
 * named nowhere in Vue, which was the defect yesterday and is the repair today, because the door now
 * owns it.
 *
 * So a lopsided row is a **question**, never a verdict, and the first thing to ask of one is whether a
 * door already owns the rule. Where it does, the row is finished and the silence is right.
 *
 *   node scripts/audit-capability-readers.mjs
 *   node scripts/audit-capability-readers.mjs --check   # exit 1 when a row is lopsided
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MDY_WIDGET_CONTRACTS } from "../packages/widgets/dist/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** The capabilities, from the contracts that declare them rather than from a list kept here. */
function declaredCapabilities() {
  const found = new Set();
  for (const contract of Object.values(MDY_WIDGET_CONTRACTS)) {
    for (const name of Object.keys(contract.capabilities ?? {})) found.add(name);
  }
  return [...found].sort();
}

/**
 * The renderers, from the declaration that already exists: depending on the widget contract is what
 * makes a package one. Publication is not the question — Angular ships by its own route.
 */
function renderers() {
  return readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifest = join(ROOT, "packages", name, "package.json");
      if (!existsSync(manifest)) return false;
      const parsed = JSON.parse(readFileSync(manifest, "utf8"));
      const declared = { ...parsed.dependencies, ...parsed.peerDependencies };
      return "@modyra/widgets" in declared && existsSync(join(ROOT, "packages", name, "src"));
    })
    .sort();
}

const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

/** How many files under a renderer's source name a capability, comments removed. */
function readersOf(pkg, capability) {
  const root = join(ROOT, "packages", pkg, "src");
  let count = 0;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!/\.(ts|tsx|mjs|js|svelte|vue)$/.test(entry.name)) continue;
      if (new RegExp(`\\b${capability}\\b`).test(withoutComments(readFileSync(path, "utf8")))) count += 1;
    }
  };
  if (existsSync(root)) walk(root);
  return count;
}

const caps = declaredCapabilities();
const rs = renderers();
const rows = caps.map((capability) => ({
  capability,
  counts: rs.map((pkg) => readersOf(pkg, capability)),
}));

console.log("# Capabilities the contract declares, and who reads them\n");
console.log("Renderer source with comments stripped: files that NAME the capability, never call sites");
console.log("and never behaviour. A detector for where to look, not a verdict.\n");
console.log(`  ${"capability".padEnd(26)}${rs.map((r) => r.padStart(9)).join("")}`);
for (const { capability, counts } of rows) {
  console.log(`  ${capability.padEnd(26)}${counts.map((n) => String(n).padStart(9)).join("")}`);
}

/**
 * Lopsided: some renderers read it and at least one reads it not at all.
 *
 * Nobody reading it is not lopsided — that is a capability no renderer has adopted, which is a
 * different finding and a quieter one. The asymmetry is what says a rule lives inside the renderers
 * that happen to honour it.
 */
/**
 * Only renderers that have taken up the vocabulary are compared.
 *
 * A renderer that has not been written yet names no capability for the same reason it names nothing
 * else, and counting that as an asymmetry buries the finding under the roster. The set is derived
 * from the data rather than guessed at: a renderer joins the comparison when it names **at least one**
 * declared capability. Silence about one capability then means something, because the package has
 * shown it speaks the vocabulary.
 *
 * An earlier version guessed by directory name and put Angular — which draws all seventeen kinds —
 * among the renderers that draw nothing, because its source lives under `src/lib`. A layout is not a
 * signal.
 */
const namesAny = (pkg) => rows.some(({ counts }) => counts[rs.indexOf(pkg)] > 0);
const speaking = rs.filter(namesAny);
const silentAltogether = rs.filter((pkg) => !namesAny(pkg));

const at = (counts, pkg) => counts[rs.indexOf(pkg)];
const lopsided = rows.filter(({ counts }) =>
  speaking.some((pkg) => at(counts, pkg) > 0) && speaking.some((pkg) => at(counts, pkg) === 0));
const unread = rows.filter(({ counts }) => counts.every((n) => n === 0));

if (silentAltogether.length > 0) {
  console.log(`\nNot compared, they name no declared capability at all: ${silentAltogether.join(", ")}`);
}

if (unread.length > 0) {
  console.log(`\nDeclared and read by no renderer: ${unread.map((r) => r.capability).join(", ")}`);
}

if (lopsided.length === 0) {
  console.log("\nNO LOPSIDED CAPABILITY — every declared capability is read by every renderer that reads it at all.");
} else {
  console.log(`\nLOPSIDED — ${lopsided.length}\n`);
  for (const { capability, counts } of lopsided) {
    const silent = speaking.filter((pkg) => at(counts, pkg) === 0);
    console.log(`  ${capability}: read in ${speaking.filter((pkg) => at(counts, pkg) > 0).join(", ")}`
      + ` — and named nowhere in ${silent.join(", ")}`);
  }
  console.log("\n  A rule that lives inside each renderer that honours it makes the ones that do not"
    + "\n  look exactly like the ones with nothing to honour. Where the counts are lopsided, the"
    + "\n  question is whether the contract should own the rule instead."
    + "\n"
    + "\n  **Ask first whether a door already owns it.** Once the contract takes a rule, a renderer"
    + "\n  that delegates correctly names the capability nowhere — silence is then the repair, not"
    + "\n  the defect, and the row is finished.");
  if (CHECK) process.exit(1);
}
