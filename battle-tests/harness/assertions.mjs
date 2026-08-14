/**
 * Assertions that carry a claim.
 *
 * A battle failure has to say which promise broke and where two states first disagreed, because the
 * next reader is triaging a report rather than watching the test. Every assertion here throws a
 * {@link BattleBreak}, which the wrapper turns into a replayable artefact.
 */

import { countAssertion } from "./assertion-scope.mjs";
import { diffCanonical } from "../models/observations.mjs";
import { claim } from "../models/claims.mjs";

export class BattleBreak extends Error {
  constructor({ claimIds, message, divergence = null, expected = null, actual = null }) {
    const worst = claimIds.map((id) => claim(id).severity).sort()[0];
    super(`[${worst}][${claimIds.join(",")}] ${message}`);
    this.name = "BattleBreak";
    this.claimIds = claimIds;
    this.severity = worst;
    this.divergence = divergence;
    this.expectedState = expected;
    this.actualState = actual;
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

export function expectClaim(condition, { claimIds, what, detail = null }) {
  countAssertion();
  if (condition) return;
  throw new BattleBreak({
    claimIds,
    message: detail ? `${what} (${detail})` : what,
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
