/**
 * Randomness that can be replayed.
 *
 * A generated attack is worth nothing if the failure it found cannot be produced again, so the only
 * source of randomness in this suite is a seeded generator whose seed is printed before it is used
 * and written into every report. `Math.random` is never called by a battle test.
 */

/** Environment overrides, so a maintainer can rerun exactly what CI ran. */
export const SEED_ENV = "MDY_BATTLE_SEED";
export const RUNS_ENV = "MDY_BATTLE_RUNS";

/** The seed for this process: the one that was asked for, or one drawn once and announced. */
let processSeed = null;

export function resolveSeed(env = process.env) {
  if (processSeed !== null) return processSeed;
  const requested = env[SEED_ENV];
  if (requested !== undefined && requested !== "") {
    const parsed = Number(requested);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${SEED_ENV} must be a non-negative integer, got ${JSON.stringify(requested)}`);
    }
    processSeed = parsed;
  } else {
    processSeed = Math.floor(Date.now() % 2 ** 31);
  }
  return processSeed;
}

export function runCount(fallback = 25, env = process.env) {
  const requested = env[RUNS_ENV];
  if (requested === undefined || requested === "") return fallback;
  const parsed = Number(requested);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${RUNS_ENV} must be a positive integer, got ${JSON.stringify(requested)}`);
  }
  return parsed;
}

/**
 * A campaign derives one seed per run from the campaign seed, so run 7 of seed 42 is the same
 * sequence on every machine and can be replayed alone.
 */
export function runSeed(campaignSeed, runIndex) {
  return (Math.imul(campaignSeed ^ (runIndex + 0x9e3779b9), 0x85ebca6b) >>> 0) % 2 ** 31;
}

/**
 * mulberry32: small, fast, and — the property that matters here — identical everywhere for the same
 * seed. Statistical quality beyond that is not what a replayable attack needs.
 */
export function createRng(seed) {
  let state = (seed >>> 0) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    float: next,
    /** Integer in [0, bound). */
    int(bound) {
      if (bound <= 0) throw new Error("rng.int needs a positive bound");
      return Math.floor(next() * bound);
    },
    bool(probability = 0.5) {
      return next() < probability;
    },
    pick(values) {
      if (values.length === 0) throw new Error("rng.pick needs a non-empty list");
      return values[Math.floor(next() * values.length)];
    },
    /** `entries` is a list of `[value, weight]`; weights need not sum to anything in particular. */
    weighted(entries) {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (total <= 0) throw new Error("rng.weighted needs a positive total weight");
      let target = next() * total;
      for (const [value, weight] of entries) {
        target -= weight;
        if (target <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    shuffle(values) {
      const copy = [...values];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }
      return copy;
    },
  };
}
