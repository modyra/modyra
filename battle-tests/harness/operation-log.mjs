/**
 * What the attack actually did.
 *
 * Two jobs. The log is the replayable half of a failure report — the operations, in order, exactly
 * as the interpreter received them. It is also the evidence that a battle attacked anything at all:
 * a test whose selector matched nothing, whose generator produced an empty sequence or whose adapter
 * silently refused every mount would otherwise pass while exercising nothing.
 */

import { assertOperation, describeOperation, isStructural } from "../models/operations.mjs";

export function createOperationLog() {
  const operations = [];
  const notes = [];
  const observations = [];
  let structural = 0;
  let mountedPhases = 0;
  let unmountedPhases = 0;
  let asyncStarted = 0;

  const counts = () => ({
    actions: operations.length + notes.length,
    operations: operations.length,
    structural,
    mountedPhases,
    unmountedPhases,
    observations: observations.length,
    asyncStarted,
  });

  return {
    /** An operation the interpreter is about to execute. */
    record(operation) {
      assertOperation(operation);
      operations.push(operation);
      if (isStructural(operation)) structural += 1;
      if (operation.type === "mount") mountedPhases += 1;
      if (operation.type === "unmount") unmountedPhases += 1;
      return operation;
    },
    /** Something the harness did that is not an operation: a start, a settle, a teardown. */
    note(what, detail = null) {
      notes.push({ at: operations.length, what, detail });
    },
    /** A canonical snapshot the battle compared. Counted, so "compared nothing" cannot pass. */
    observed(label) {
      observations.push({ at: operations.length, label });
    },
    asyncRunStarted() {
      asyncStarted += 1;
    },
    operations: () => [...operations],
    notes: () => [...notes],
    lines: () => operations.map((operation, index) => `${index}. ${describeOperation(operation)}`),
    /**
     * The counters a battle can assert on. `actions` is the coarse one the wrapper enforces; the
     * rest let a suite state the specific thing it must have exercised.
     */
    counts,
    toJSON: () => ({ operations: [...operations], notes: [...notes], counts: counts() }),
  };
}

/**
 * The failure a battle gets when it exercised nothing.
 *
 * Stated as its own error rather than a plain assertion so the wrapper can tell "the attack found a
 * break" from "the attack never happened" — the second is a defect in the test, not in Modyra.
 */
export class EmptyBattleError extends Error {
  constructor(counts, expectations) {
    const missing = expectations.map(({ what, need, got }) => `${what}: needed ${need}, got ${got}`);
    super(
      `battle recorded no meaningful action — ${missing.join("; ")}. ` +
        `A battle that can pass without attacking is not evidence.`,
    );
    this.name = "EmptyBattleError";
    this.counts = counts;
  }
}

/**
 * Enforce what a battle claims to have exercised.
 *
 * `requires` names counters that must be positive; `actions` is always required, so the default
 * already refuses an empty test.
 */
export function assertExercised(log, requires = []) {
  const counts = log.counts();
  const failures = [];
  for (const what of ["actions", ...requires]) {
    const got = counts[what];
    if (got === undefined) throw new Error(`unknown battle counter ${JSON.stringify(what)}`);
    if (got <= 0) failures.push({ what, need: "> 0", got });
  }
  if (failures.length > 0) throw new EmptyBattleError(counts, failures);
  return counts;
}
