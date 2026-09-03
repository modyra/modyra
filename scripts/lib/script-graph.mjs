/**
 * The workspace's script graph: which npm script runs which, and what a workflow asks for.
 *
 * Two questions lean on the same graph and used to be able to disagree about it. "Which check does
 * no workflow run" and "which check does the local gate not run" are the same edges read from two
 * different roots, and a repository that learned those edges twice would answer them from two
 * models — which is the shape every gate here exists to prevent, applied to the gates themselves.
 *
 * The edges are: a script body invoking `npm run X` / `pnpm run X`, plus the contract gate runner's
 * own list, which names its gates as commands inside a JavaScript array. A parser that reads only
 * `package.json` misses every one of those, and they are twenty-eight real edges.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A script whose name says it verifies something. */
export const IS_A_CHECK = /^(test|battle|audit|contract):/;

/** Every `npm run X` / `pnpm run X` in a blob of shell, whatever flags sit between. */
export function scriptsInvokedBy(text) {
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

/** Every script, and the scripts each one runs. */
export function scriptGraph() {
  const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts ?? {};
  const edges = new Map();
  for (const [name, body] of Object.entries(scripts)) edges.set(name, scriptsInvokedBy(body));
  edges.set("test:contracts", new Set([
    ...(edges.get("test:contracts") ?? []),
    ...gatesOfTheContractRunner(),
  ]));
  return { scripts, edges };
}

/** Everything reachable from these roots, the roots included. */
export function reachableFrom(edges, roots) {
  const reached = new Set();
  const walk = (name) => {
    if (reached.has(name)) return;
    reached.add(name);
    for (const next of edges.get(name) ?? []) walk(next);
  };
  for (const root of roots) walk(root);
  return reached;
}

/** What each workflow file asks for by name. */
export function workflowRoots() {
  const dir = join(ROOT, ".github/workflows");
  const byFile = new Map();
  for (const file of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    byFile.set(file, scriptsInvokedBy(readFileSync(join(dir, file), "utf8")));
  }
  return byFile;
}
