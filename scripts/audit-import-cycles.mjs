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

/**
 * Relative specifiers only: a bare package name is another package's problem.
 *
 * Both spellings, and that matters: `import("./x.js")` closes a ring exactly as a static import
 * does, and a reader that only knew `from "./x"` would report a graph with the edge missing — which
 * is a clean run, not a smaller one. A dynamic import is the shape a cycle is most often broken
 * *with*, so it is the shape this most needs to see.
 *
 * A specifier that resolves to nothing is counted rather than dropped. Every unresolved one is an
 * edge the graph does not have, and a cycle through it cannot be found: silence there reads as
 * "no cycle" for the same reason an unbuilt package reads as "nothing wrong".
 */
const unresolved = [];
const edgesOf = (file) => {
  // Comments first. A doc block writes `{@link import("./x.js").f}` to point a reader at a sibling,
  // and that closes no ring — it was enough to fabricate a two-module cycle between a shell and the
  // field it documents. A specifier that is prose is not an edge.
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const specifiers = [
    ...source.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g),
    ...source.matchAll(/import\s*\(\s*["'](\.[^"']+)["']/g),
  ].map((m) => m[1]);
  const out = new Set();
  for (const specifier of specifiers) {
    const base = resolve(dirname(file), specifier).replace(/\.(js|mjs|ts|mts)$/, "");
    const found = [".ts", ".mts", "/index.ts", "/index.mts"]
      .map((suffix) => `${base}${suffix}`)
      .find((candidate) => existsSync(candidate));
    if (found) out.add(found);
    // A stylesheet or a data file is not a module and has no edge to be missing.
    else if (!/\.(css|json|svg|png|txt|md)$/.test(specifier)) {
      unresolved.push(`${relative(ROOT, file)} -> ${specifier}`);
    }
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
console.log(`Read from source: static and dynamic relative imports across ${packages.length} package(s)`
  + " — a cycle closed through a bare package specifier belongs to audit-package-independence.");
if (unresolved.length > 0) {
  // Named, not counted: an edge the graph does not have is a cycle this cannot find, and the reader
  // needs to know which module it stopped following.
  console.log(`  ${unresolved.length} relative specifier(s) resolved to no file, so their edges are absent`
    + " (a generator's output names paths this repository writes rather than imports):");
  for (const one of unresolved.slice(0, 10)) console.log(`    ${one}`);
  if (unresolved.length > 10) console.log(`    … and ${unresolved.length - 10} more`);
}
for (const cycle of added) console.log(`  new: ${cycle}`);
// Asserted in both directions: a stale entry is a claim about the code that stopped being true.
for (const cycle of closed) console.log(`  closed, still recorded: ${cycle}`);

for (const cycle of unexplained) console.log(`  recorded without a reason: ${cycle}`);

if (added.length > 0 || closed.length > 0 || unexplained.length > 0) {
  console.log("\nA cycle is a module you cannot move. Break it, or re-record: node scripts/audit-import-cycles.mjs --write");
  process.exit(1);
}
console.log("IMPORT CYCLES UNCHANGED");
