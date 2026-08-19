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
 *
 * Two things a specifier check cannot see, and both were found by running deliberately broken files
 * past this audit rather than by reading it:
 *
 * - **reading a package's source instead of importing it.** `readFileSync` over a path built with
 *   `resolve()` carries no specifier, so it passed. A battle may legitimately assert a fact *about*
 *   the sources — that no name is shadowed, that some module reads a capability — where no public
 *   door exposes it, but it must say so: {@link SOURCE_INSPECTION_MARK} in the file, with the reason
 *   beside it. Silence would make the rule "anyone may, as long as they build the path".
 * - **reaching for a private member.** `form._adapter` is not an import at all. It is the one
 *   constraint this suite carries that nothing verified.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const BATTLE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PROBES = join(BATTLE_ROOT, "harness", "internal-probes");
// Generated trees, not the suite's own code: a browser host is a bundle of the packages themselves,
// so every private member the product uses would read as the suite reaching for one.
const SKIP = new Set(["node_modules", "reports", ".tmp-consumer", ".tmp-browser"]);

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

/** A file inspecting package sources declares it with this, and says why on the same line. */
export const SOURCE_INSPECTION_MARK = "@source-inspection";

/**
 * A filesystem read aimed at a package's own source tree rather than at what it ships.
 *
 * Both halves are needed and neither is enough. `packages` alone catches every battle that reads a
 * shipped stylesheet or a tarball, which is a door a consumer has; `src` alone catches the suite's
 * own paths. The two together, in a file that reads the filesystem at all, is the shape of walking a
 * package's sources — however the path was spelled, since `resolve()` and `join()` leave no
 * specifier for the import check to see.
 */
const NAMES_PACKAGES = /["'`]packages["'`]|packages\//;
const NAMES_SOURCE_DIR = /["'`]src["'`]|\/src\b/;
const READS_FILES = /\breadFileSync\b|\breaddirSync\b/;

/**
 * A member whose name marks it private, read off something.
 *
 * Deliberately narrow: a leading underscore after a dot. It catches `form._adapter` and does not
 * catch a local `const _x`, an object literal key, or a private field of the suite's own making,
 * which is why the pattern requires the dot.
 */
const PRIVATE_MEMBER = /[A-Za-z0-9_$)\]]\._[A-Za-z][A-Za-z0-9_$]*/g;

/** Lines that are only a comment cannot reach for anything. */
function codeOnly(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\*|\/\/)/.test(line))
    .join("\n");
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

    const code = codeOnly(source);
    if (
      READS_FILES.test(code) &&
      NAMES_PACKAGES.test(code) &&
      NAMES_SOURCE_DIR.test(code) &&
      !source.includes(SOURCE_INSPECTION_MARK)
    ) {
      violations.push({
        file: relative(root, file),
        specifier: "a filesystem read",
        problem: `reads a package's own source without declaring ${SOURCE_INSPECTION_MARK}`,
      });
    }

    for (const match of code.matchAll(PRIVATE_MEMBER)) {
      violations.push({
        file: relative(root, file),
        specifier: match[0].slice(match[0].indexOf(".")),
        problem: "reaches for a private member, which no consumer can rely on",
      });
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
