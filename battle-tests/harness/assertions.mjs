/**
 * Assertions that carry a claim.
 *
 * A battle failure has to say which promise broke and where two states first disagreed, because the
 * next reader is triaging a report rather than watching the test. Every assertion here throws a
 * {@link BattleBreak}, which the wrapper turns into a replayable artefact.
 */

import { countAssertion } from "./assertion-scope.mjs";
import { BattleHarnessError, diffCanonical } from "../models/observations.mjs";
import { claim } from "../models/claims.mjs";

export class BattleBreak extends Error {
  constructor({ claimIds, message, divergence = null, expected = null, actual = null, search = null }) {
    const worst = claimIds.map((id) => claim(id).severity).sort()[0];
    super(`[${worst}][${claimIds.join(",")}] ${message}`);
    this.name = "BattleBreak";
    this.claimIds = claimIds;
    this.severity = worst;
    this.divergence = divergence;
    this.expectedState = expected;
    this.actualState = actual;
    /**
     * How far the search got before it stopped, for a failure a campaign found.
     *
     * Which run failed is the number that says how much of the configured search actually happened:
     * a property stops at its first divergence, so one that fails at run 12 explores twelve runs
     * whatever `MDY_BATTLE_RUNS` says. Without it a report from a 400-run job and one from a
     * 200,000-run night are the same document.
     */
    this.search = search;
  }
}

/**
 * Two canonical observations must agree.
 *
 * `ignore` names top-level observation fields the claim explicitly permits to differ — a mount
 * strategy comparison ignores `mountedPaths` and nothing else. Passing a wide ignore list here is
 * how a differential test stops testing anything, so the list is stated per call and read in review.
 */
export function expectSameObservation(actual, expected, { claimIds, ignore = [], what }) {
  countAssertion();
  // One object compared with itself always agrees, and a differential that does it has measured one
  // path twice. It is an easy mistake — the two sides of a differential are built a dozen lines
  // apart — and it produces a green that means nothing, which is the failure this whole suite is
  // arranged against. A harness error rather than a claim break: nothing about the product is known.
  if (actual === expected && typeof actual === "object" && actual !== null) {
    throw new BattleHarnessError(
      `${what}: both sides of the comparison are the same object, so only one path was built`,
    );
  }
  const divergence = diffCanonical(expected, actual, { ignore });
  if (!divergence) return;
  throw new BattleBreak({
    claimIds,
    message: `${what}: first divergence at ${divergence.path} — expected ${divergence.expected}, got ${divergence.actual}`,
    divergence,
    expected,
    actual,
  });
}

/**
 * What a failure is allowed to say beyond naming the claim.
 *
 * A detail is read only when the claim has already broken, and a detail that cannot be produced must
 * not decide whether the break is reported. Passing a **function** is what makes that true: a value
 * is built at the call site, so `JSON.stringify` of anything holding a form — a form owns its
 * scheduler, and the structure is circular — throws before the assertion is entered, and an S0 gets
 * reported as broken on the strength of its own report line. That happened here.
 */
function detailOf(detail) {
  if (detail === null || detail === undefined) return null;
  if (typeof detail !== "function") return String(detail);
  try {
    const produced = detail();
    return produced === null || produced === undefined ? null : String(produced);
  } catch (error) {
    return `detail unavailable: ${error?.constructor?.name ?? typeof error}`;
  }
}

export function expectClaim(condition, { claimIds, what, detail = null }) {
  countAssertion();
  if (condition) return;
  const said = detailOf(detail);
  throw new BattleBreak({
    claimIds,
    message: said ? `${what} (${said})` : what,
  });
}

export function expectEqual(actual, expected, { claimIds, what }) {
  countAssertion();
  const divergence = diffCanonical(expected, actual);
  if (!divergence) return;
  throw new BattleBreak({
    claimIds,
    message: `${what}: expected ${divergence.expected}, got ${divergence.actual} at ${divergence.path}`,
    divergence,
    expected,
    actual,
  });
}

/** The set-shaped comparison: same members, order irrelevant. */
export function expectSamePaths(actual, expected, { claimIds, what }) {
  countAssertion();
  const missing = expected.filter((path) => !actual.includes(path));
  const extra = actual.filter((path) => !expected.includes(path));
  if (missing.length === 0 && extra.length === 0) return;
  throw new BattleBreak({
    claimIds,
    message: `${what}: missing [${missing.join(", ")}], unexpected [${extra.join(", ")}]`,
    expected,
    actual,
  });
}

/**
 * Compare two canonical observations and hand back where they first disagree, without throwing.
 *
 * A campaign cannot use {@link expectSameObservation}: it has to shrink a divergence to its minimal
 * sequence before it reports one, and a throw at the point of comparison would skip that. The
 * comparison is still the campaign's assertion, so it is counted here — a campaign that compared
 * nothing has concluded nothing, exactly like a battle that asserted nothing.
 */
export function compareCanonical(expected, actual, { ignore = [] } = {}) {
  countAssertion();
  return diffCanonical(expected, actual, { ignore });
}
