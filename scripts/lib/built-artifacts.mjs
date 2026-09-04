/**
 * Whether what a check is about to read was built from the source that is there now.
 *
 * A check that reads `dist/` answers about the build, not about the tree. When the build is older
 * than its source the answer is about the past, and it arrives with a check's authority and no
 * warning: a surface audit reported one package unchanged for three weeks, a removed member
 * included, and a type check called three published names unreachable that the source exported —
 * both times the reader was fine and the artifact was old.
 *
 * Kept here because it is one question with more than one asker. Two checks working it out
 * separately is how they come to disagree about whether a package is current, which is worse than
 * either answer.
 *
 * **Refused, never rebuilt.** Building from inside a check would make something that reads a tree
 * also write one, and the command that repairs it belongs to whoever ran the check.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The newest modification time under a directory and whether it holds any declarations, in one walk.
 *
 * Both answers come from the same traversal because the second used to be asked with a separate
 * recursive scan, and a package's `dist/` is large enough that walking it twice per check is a cost
 * paid for nothing.
 */
export function builtUnder(dir) {
  if (!existsSync(dir)) return { newest: 0, declares: false };
  let newest = 0;
  let declares = false;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(at, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name.endsWith(".d.ts")) declares = true;
      newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  walk(dir);
  return { newest, declares };
}

/** The newest modification time under a directory, or 0 where there is nothing to read. */
export function newestUnder(dir) {
  return builtUnder(dir).newest;
}

/**
 * The packages whose built declarations are behind their source.
 *
 * **A package is a subject when its build holds declarations**, not when its build holds a manifest.
 * Keying on `dist/package.json` looked equivalent and was not: one package of fourteen writes one,
 * so thirteen emitted `.d.ts` that nothing ever checked for age, and the guard read as covering the
 * repository while covering a single package. The condition now names what is actually read — if a
 * check reads declarations, the question is whether *those* are current.
 *
 * A package that has not been built at all is not stale; there is nothing to be stale. Its absence
 * is the caller's to report, and every caller already does something with a missing directory.
 */
export function staleBuilds(packages, root) {
  const stale = [];
  for (const pkg of packages) {
    const { newest: built, declares } = builtUnder(resolve(root, `packages/${pkg}/dist`));
    if (!declares) continue;
    const source = newestUnder(resolve(root, `packages/${pkg}/src`));
    if (source > built) stale.push({ pkg, behindBy: source - built });
  }
  return stale;
}

/**
 * Refuse to answer on an artifact older than its source, naming what is behind and by how much.
 *
 * @param {readonly string[]} packages
 * @param {{root: string, reads: string}} where `reads` completes "this check reads …", so the report
 *   says what was about to be measured rather than making the reader infer it.
 */
export function refuseStaleBuilds(packages, { root, reads }) {
  const stale = staleBuilds(packages, root);
  if (stale.length === 0) return;
  console.error(`\nSTALE BUILD — this check reads ${reads}, and they are older than their source.\n`);
  for (const { pkg, behindBy } of stale) {
    const days = behindBy / 86_400_000;
    const how = days >= 1 ? `${Math.round(days)} day(s)` : "less than a day";
    console.error(`  packages/${pkg}/dist is ${how} behind packages/${pkg}/src`);
  }
  console.error("\nRebuild the package, then run this again. Answering from a stale build reports"
    + "\nabout the tree as it was, which is indistinguishable here from a check that passed.\n");
  process.exit(1);
}
