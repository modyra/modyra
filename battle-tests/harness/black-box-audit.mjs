#!/usr/bin/env node
/**
 * The suite may only use the doors a consumer has.
 *
 * Battle tests consume published entry points — `@modyra/core`, `@modyra/widgets`,
 * `@modyra/widgets/testing`, `@modyra/plain`, `@modyra/lit` — which resolve to each package's built
 * output. Reaching into a package's own source tree would let an attack depend on a symbol no
 * consumer can import, and would quietly turn a suite about public promises into another
 * implementation-local test folder.
 *
 * `harness/internal-probes/` is the one exception, by design: a probe there is marked, and its
 * finding may support a public claim but never stand as the only evidence for one.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const BATTLE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PROBES = join(BATTLE_ROOT, "harness", "internal-probes");
const SKIP = new Set(["node_modules", "reports", ".tmp-consumer"]);

const IMPORT = /(?:^|\s)(?:import|export)[^;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Why this specifier is not one a consumer could write.
 *
 * A relative specifier is judged by where it lands, not by how many `..` segments it has: the suite
 * imports its own harness across directories all day, and only a path resolving outside the suite is
 * a reach into the workspace.
 */
function specifierProblem(specifier, fromDir, root) {
  if (specifier.includes("packages/")) return "reaches into the workspace packages";
  if (/(^|\/)src\//.test(specifier)) {
    return "imports implementation source rather than a package entry point";
  }
  if (specifier.startsWith(".")) {
    const target = resolve(fromDir, specifier);
    if (relative(root, target).startsWith("..")) return "escapes battle-tests/";
  }
  return null;
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(mjs|js|ts|mts)$/.test(entry.name)) yield path;
  }
}

export function auditBlackBox(root = BATTLE_ROOT) {
  const violations = [];
  for (const file of files(root)) {
    if (file.startsWith(PROBES)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      const problem = specifierProblem(specifier, dirname(file), root);
      if (problem) {
        violations.push({ file: relative(root, file), specifier, problem });
      }
    }
  }
  return violations;
}

/** The audit is only evidence if the corpus was non-empty. */
export function auditedFileCount(root = BATTLE_ROOT) {
  return [...files(root)].length;
}

if (process.argv[1] && statSync(process.argv[1]).isFile() && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const violations = auditBlackBox();
  const count = auditedFileCount();
  console.log(`black-box audit: ${count} file(s) checked, ${violations.length} violation(s)`);
  for (const violation of violations) {
    console.log(`  ${violation.file}: ${violation.specifier} — ${violation.problem}`);
  }
  process.exit(violations.length === 0 ? 0 : 1);
}
