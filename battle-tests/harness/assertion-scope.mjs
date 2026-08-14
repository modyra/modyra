/**
 * Which battle an assertion belongs to.
 *
 * The assertions carry a claim, not a log, so they cannot count themselves into the battle that made
 * them by argument alone — and threading a log through every call site would put the bookkeeping in
 * the attack, where it would be read as part of the claim. The running battle is held here instead
 * and the assertions find it, so an assertion made inside a helper, a callback or an awaited
 * continuation still counts for the battle that is running.
 *
 * The scope is asynchronous rather than a module-level counter because battles interleave: a delta
 * measured around one battle would collect whatever another battle asserted while it was suspended.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const scope = new AsyncLocalStorage();

/** Run a battle's attack with its log in scope, so assertions made inside it are counted. */
export function withAssertionScope(log, run) {
  return scope.run(log, run);
}

/**
 * Count one assertion against the running battle.
 *
 * Silent outside a battle: the assertions are also usable from the harness's own self-checks, which
 * have no log and no claim to exercise.
 */
export function countAssertion() {
  scope.getStore()?.asserted();
}
