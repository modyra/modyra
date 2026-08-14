/**
 * Refusing to measure a package that was built before it was written.
 *
 * Every battle imports built artefacts through bare specifiers, which is what the black-box rule
 * requires — and it means a fix that exists in a package's source is not in the measurement until
 * something rebuilds it. A battle run against a stale `dist` reports the behaviour of an older
 * version of the code, and says nothing about the age of what it measured.
 *
 * The direction that failure takes is what makes it worth a guard rather than a habit. A battle
 * still passing against a stale build silently under-reports; a battle *failing* against one
 * produces a report that the fix is missing — and that report crosses to whoever wrote the fix, who
 * then goes looking at code that is already correct. It is red for the wrong reason aimed at
 * somebody else.
 *
 * `packages/angular/dist` is the case that prompted this: it is written only by `build:angular`,
 * which no other command runs, so it is the stalest artefact in the workspace by construction.
 */

import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..");

/** Directories that are never source and never output, so neither side is dated by them. */
const SKIPPED = new Set(["node_modules", ".turbo", ".cache", "coverage"]);

/** The newest modification time under `directory`, or null when there is nothing to date. */
function newestUnder(directory) {
  let newest = null;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (SKIPPED.has(entry.name)) continue;
    const path = join(directory, entry.name);
    const at = entry.isDirectory() ? newestUnder(path) : statSync(path).mtimeMs;
    if (at !== null && (newest === null || at > newest)) newest = at;
  }
  return newest;
}

/**
 * What a package's build and its source say about their ages.
 *
 * Returned rather than thrown so a caller can report it as part of a battle's own evidence — a
 * measurement of the wrong version is a fact about the run, not an error in it.
 *
 * `root` exists so the comparison can be exercised against a layout a test controls; a guard that
 * has never been seen to fire is a guard nobody knows the shape of.
 */
export function buildFreshness(packageName, { root = REPO } = {}) {
  const source = newestUnder(join(root, "packages", packageName, "src"));
  const built = newestUnder(join(root, "packages", packageName, "dist"));

  if (built === null) return { known: false, why: "the package has no dist to measure" };
  if (source === null) return { known: false, why: "the package has no src to compare against" };

  return {
    known: true,
    fresh: built >= source,
    builtAt: new Date(built).toISOString(),
    sourceAt: new Date(source).toISOString(),
    behindBySeconds: Math.max(0, Math.round((source - built) / 1000)),
  };
}

/**
 * Throw unless `packageName`'s build is at least as new as its source.
 *
 * Called at the top of a battle that measures a package under active repair, so the run stops with
 * a sentence naming the build rather than continuing and reporting on the wrong version.
 */
export function assertFreshBuild(packageName, options) {
  const freshness = buildFreshness(packageName, options);
  if (!freshness.known || freshness.fresh) return freshness;

  throw new Error(
    `[battle-tests] @modyra/${packageName} was built before it was last written — ` +
      `dist ${freshness.builtAt}, src ${freshness.sourceAt}, ` +
      `${freshness.behindBySeconds}s behind. Anything measured here is the older version. ` +
      `Rebuild the package before reading this battle's result.`,
  );
}
