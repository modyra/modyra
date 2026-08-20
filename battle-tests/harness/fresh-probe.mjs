/**
 * What an ad-hoc measurement owes before it is allowed to mean anything.
 *
 * A battle runs behind a gate that refuses a stale build. A probe written to answer one question in
 * one sitting does not, and the difference cost two findings in a night: both were filed against code
 * that had already been repaired, because the `dist` under them predated the repair. The failure is
 * silent in the worst direction — the probe reports the *old* behaviour with total confidence, and
 * the report crosses to whoever wrote the fix.
 *
 * So: import this first, call it first, and the process stops rather than measures.
 *
 *     import { onlyIfFresh } from "../battle-tests/harness/fresh-probe.mjs";
 *     onlyIfFresh();
 *
 * It never builds. Building from inside a probe would hide the thing worth noticing — that the
 * question was about to be asked of the wrong version — and a probe that quietly recompiles a
 * package another session is editing is worse than one that stops.
 */

import { buildFreshness } from "./build-freshness.mjs";

/** The packages a probe is most likely to be measuring, and the ones most likely to be mid-repair. */
const WATCHED = Object.freeze(["core", "widgets", "plain"]);

/**
 * Stops the process unless every named package was built after it was last written.
 *
 * @param packages Names under `packages/`. Defaults to the three a probe usually reaches through.
 * @param exit     How to stop. Overridable so this file's own behaviour can be exercised.
 */
export function onlyIfFresh(packages = WATCHED, { exit = process.exit, log = console.error } = {}) {
  const stale = [];
  for (const name of packages) {
    const freshness = buildFreshness(name);
    if (freshness.known && !freshness.fresh) {
      stale.push(`@modyra/${name}: dist ${freshness.builtAt}, src ${freshness.sourceAt}, ${freshness.behindBySeconds}s behind`);
    }
  }
  if (stale.length === 0) return;
  log(
    `[probe] refusing to measure a stale build.\n  ${stale.join("\n  ")}\n` +
      "  Anything read here is the older version, and a finding from it names a defect the code may\n" +
      "  no longer have. Rebuild first: npm run build:core, build:packages, or build:plain.",
  );
  exit(2);
}
