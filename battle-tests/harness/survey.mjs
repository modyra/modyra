/**
 * Seeing past the first failure a campaign finds.
 *
 * A property stops at its first divergence, which is right for a gate: the failure is reported with a
 * minimized sequence and the run is over. It is wrong for a hunt. A property with a known failure is
 * capped at that failure's run index — one that falls at run 1 explores a single run however many
 * were asked for — so everything behind it is invisible for as long as it stands.
 *
 * Survey mode keeps going. Each divergence is reduced to a signature (the path and the two values),
 * counted, and the run and sequence of the first one is kept; at the end the property fails once with
 * every distinct class it met. What comes back is not "this campaign failed" but "this campaign meets
 * these four kinds of disagreement, in these proportions".
 *
 * It is opt-in and off by default, because a gate wants one counterexample with a minimized sequence
 * and not a set to read through.
 *
 * What it does *not* do is continue a diverged run. Each run builds a fresh form and a fresh model
 * and stops at its own first disagreement, so every kind collected here is the first divergence of an
 * independent run — not a consequence of an earlier one. That is what makes a survey more than a
 * catalogue: a kind that appears only here was invisible because a different kind happened to be met
 * on an earlier run, not because it needed a broken state to appear.
 *
 * A kind is still a lead until it has been reduced. Survey mode does not shrink — it records the
 * sequence that produced each kind first, and reproducing that one is the next step.
 *
 *   MDY_BATTLE_SURVEY=1 MDY_BATTLE_RUNS=5000 npm run battle:generative
 */

export const SURVEY_ENV = "MDY_BATTLE_SURVEY";

/** Whether this process was asked to survey rather than to stop at the first failure. */
export function surveying(env = process.env) {
  const requested = env[SURVEY_ENV];
  return requested === "1" || requested === "true";
}

/** One divergence reduced to what makes it a kind rather than an instance. */
export function signatureOf(divergence) {
  if (divergence === null || divergence === undefined) return "none";
  return `${divergence.path} | ${divergence.expected} → ${divergence.actual}`;
}

/**
 * Collects the distinct kinds of divergence a campaign meets.
 *
 * The first occurrence keeps its run and its sequence, because that is the one worth reproducing;
 * later ones only add to the count.
 */
export function createSurvey() {
  const kinds = new Map();

  return {
    get size() {
      return kinds.size;
    },

    /** Record one divergence. Answers whether this kind had been seen before. */
    record({ divergence, run, seed, operations }) {
      const signature = signatureOf(divergence);
      const existing = kinds.get(signature);
      if (existing !== undefined) {
        existing.count += 1;
        return true;
      }
      kinds.set(signature, { signature, count: 1, firstRun: run, seed, operations: operations ?? [] });
      return false;
    },

    /** Every kind, most frequent first. */
    kinds() {
      return [...kinds.values()].sort((a, b) => b.count - a.count);
    },

    /** One line per kind, for a failure message a person reads before a report they open. */
    lines() {
      return this.kinds().map(
        (kind) =>
          `  ×${String(kind.count).padStart(5)}  first at run ${kind.firstRun} (seed ${kind.seed}), ` +
          `${kind.operations.length} operation(s)\n           ${kind.signature}`,
      );
    },
  };
}
