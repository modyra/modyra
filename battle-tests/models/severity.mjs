/**
 * How much a falsified claim costs, and what the project owes it.
 *
 * Severity is a property of the claim that broke, not of the test that found it: the same attack
 * lands at S0 when it corrupts a submitted payload and at S3 when it only produces a misleading
 * warning. A break carries its severity into the report so triage never re-derives it.
 */

/** Ordered from most to least severe; index is the ranking. */
export const MDY_BATTLE_SEVERITIES = Object.freeze(["S0", "S1", "S2", "S3"]);

export const MDY_SEVERITY_MEANING = Object.freeze({
  S0: Object.freeze({
    title: "integrity or security",
    action: "release blocker",
    examples: Object.freeze([
      "submitted payload differs from declared data semantics",
      "silent data loss",
      "prototype pollution",
      "a stale async result corrupts a different row",
      "a renderer creates undeclared submitted data",
    ]),
  }),
  S1: Object.freeze({
    title: "semantic correctness",
    action: "merge blocker for the affected package",
    examples: Object.freeze([
      "validity depends on which cells are mounted",
      "record identity follows sorting or rendering",
      "remove leaves active validators or registered fields",
      "a draft restores the wrong structure",
    ]),
  }),
  S2: Object.freeze({
    title: "cross-surface divergence",
    action: "merge blocker unless quarantined with an owner and an expiry",
    examples: Object.freeze([
      "two renderers produce different form semantics",
      "typed and dynamic paths disagree",
      "a packed package differs from the workspace behaviour",
    ]),
  }),
  S3: Object.freeze({
    title: "ergonomics and diagnostics",
    action: "tracked defect; may merge with explicit justification",
    examples: Object.freeze([
      "a misleading warning",
      "a late failure where an early diagnostic was possible",
      "a valid operation that requires undocumented ordering",
    ]),
  }),
});

export function isSeverity(value) {
  return MDY_BATTLE_SEVERITIES.includes(value);
}

/** Negative when `a` is worse than `b`, so a sort puts the release blockers first. */
export function bySeverity(a, b) {
  return MDY_BATTLE_SEVERITIES.indexOf(a) - MDY_BATTLE_SEVERITIES.indexOf(b);
}

export function assertSeverity(value) {
  if (!isSeverity(value)) {
    throw new Error(
      `unknown severity ${JSON.stringify(value)}; expected one of ${MDY_BATTLE_SEVERITIES.join(", ")}`,
    );
  }
  return value;
}
