/**
 * A module cycle inside a package.
 *
 * Two modules that import each other cannot be read, tested or extracted on their own, and a type-
 * only cycle is not a lesser one: it survives compilation, so nothing objects until someone tries
 * to move one of the two. Every cycle this repository has closed was found by hand and could come
 * back the same way — which is why the count is a ratchet rather than a note.
 *
 * The graph is per package. A cycle between packages is a different defect with its own gate
 * (`audit-package-independence`), and mixing them would let one hide behind the other.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "scripts/baselines/import-cycles.json");
const write = process.argv.includes("--write");

const sources = (dir) => {
  const out = [];
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|mts)$/.test(entry) && !entry.endsWith(".d.ts")) out.push(path);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
};

/** Relative specifiers only: a bare package name is another package's problem. */
const edgesOf = (file) => {
  const source = readFileSync(file, "utf8");
  const specifiers = [...source.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)].map((m) => m[1]);
  const out = new Set();
  for (const specifier of specifiers) {
    const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
    if (existsSync(target)) out.add(target);
    else if (existsSync(`${target.replace(/\.ts$/, "")}/index.ts`)) out.add(`${target.replace(/\.ts$/, "")}/index.ts`);
  }
  return out;
};

/** Every elementary cycle, reported once by its smallest rotation so a re-run names it the same way. */
const cyclesIn = (graph) => {
  const found = new Map();
  const seen = new Set();
  const stack = [];
  const onStack = new Set();
  const walk = (node) => {
    stack.push(node); onStack.add(node); seen.add(node);
    for (const next of graph.get(node) ?? []) {
      if (onStack.has(next)) {
        const ring = stack.slice(stack.indexOf(next));
        const pivot = ring.indexOf([...ring].sort()[0]);
        const key = [...ring.slice(pivot), ...ring.slice(0, pivot)].join(" -> ");
        found.set(key, key);
      } else if (!seen.has(next)) walk(next);
    }
    stack.pop(); onStack.delete(node);
  };
  for (const node of graph.keys()) if (!seen.has(node)) walk(node);
  return [...found.keys()];
};

const packages = readdirSync(join(ROOT, "packages")).filter((name) =>
  existsSync(join(ROOT, "packages", name, "src")));

const cycles = [];
for (const name of packages) {
  const dir = join(ROOT, "packages", name, "src");
  const graph = new Map();
  for (const file of sources(dir)) graph.set(file, edgesOf(file));
  for (const cycle of cyclesIn(graph)) {
    cycles.push(cycle.split(" -> ").map((f) => relative(ROOT, f)).join(" -> "));
  }
}
cycles.sort();

if (write) {
  const previous = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")).cycles ?? {} : {};
  const next = Object.fromEntries(cycles.map((c) => [c, previous[c] ?? ""]));
  writeFileSync(BASELINE, `${JSON.stringify({ cycles: next }, null, 2)}\n`);
  console.log(`recorded ${cycles.length} import cycle(s)`);
  process.exit(0);
}

// A recorded cycle carries the reason it is still there. An entry without one is an absolution
// rather than a work item, which is how a ratchet stops meaning anything.
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : { cycles: {} };
const recorded = Object.keys(baseline.cycles ?? {});
const unexplained = recorded.filter((c) => !baseline.cycles[c]);
const added = cycles.filter((c) => !recorded.includes(c));
const closed = recorded.filter((c) => !cycles.includes(c));

console.log(`Import cycles: ${cycles.length} (recorded ${recorded.length})`);
for (const cycle of added) console.log(`  new: ${cycle}`);
// Asserted in both directions: a stale entry is a claim about the code that stopped being true.
for (const cycle of closed) console.log(`  closed, still recorded: ${cycle}`);

for (const cycle of unexplained) console.log(`  recorded without a reason: ${cycle}`);

if (added.length > 0 || closed.length > 0 || unexplained.length > 0) {
  console.log("\nA cycle is a module you cannot move. Break it, or re-record: node scripts/audit-import-cycles.mjs --write");
  process.exit(1);
}
console.log("IMPORT CYCLES UNCHANGED");
