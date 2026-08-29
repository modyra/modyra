/**
 * Proves the form's root scope is a REAL ownership boundary, not just a
 * decoration — draft, history and async-validator effects must actually
 * die when the scope is destroyed directly, independent of MdyFormEngine's
 * own explicit destroy() calls in its manager classes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MdyFormEngine, vanillaReactivity } from "../dist/index.js";

const noopStorage = { read: () => null, write: () => {}, remove: () => {} };

/** Wraps vanillaReactivity(), recording every effect ref + the scope it was created with. */
function spyReactivity() {
  const real = vanillaReactivity();
  const effects = [];
  return {
    ...real,
    effect(fn, options) {
      const ref = real.effect(fn, options);
      effects.push({ ref, scope: options?.scope });
      return ref;
    },
    __effects: effects,
  };
}

test("destroying the form's scope tears down draft/history/async effects it owns", async () => {
  const rx = spyReactivity();
  const engine = new MdyFormEngine(rx);

  engine.claimField("email");
  engine.upsertAsyncValidators("email", "k", [async () => []]);
  engine.enableHistory();
  engine.enableDraft({ key: "reactivity-scope-test", storage: noopStorage });

  await Promise.resolve(); // let the initial effect runs settle

  const scoped = rx.__effects.filter((e) => e.scope);
  assert.equal(
    scoped.length,
    4,
    "draft, history and the async validator's pair should all register with the form's scope",
  );
  // Four rather than three because the async validator is a pair: the runner, and the watcher that
  // abandons its run when the field leaves play. Separate on purpose — the runner must not wake on
  // every interactivity change, because a field becoming read-only is still being asked about.
  const [scope] = scoped.map((e) => e.scope);
  assert.ok(
    scoped.every((e) => e.scope === scope),
    "all three effects must share the same root scope instance",
  );
  assert.ok(
    scoped.every((e) => e.ref.destroyed === false),
    "effects are alive before the scope is destroyed",
  );

  // Bypass engine.destroy() entirely — this proves ownership is independent of
  // just a byproduct of the managers' own explicit destroy() calls.
  scope.destroy();

  assert.ok(
    scoped.every((e) => e.ref.destroyed === true),
    "destroying the scope must tear down every effect registered with it",
  );
  assert.equal(scope.destroyed, true);

  // engine.destroy() must still be safe to call afterwards (idempotent paths).
  engine.destroy();
});

test("MdyReactiveScope is undefined when the adapter has no createScope (graceful degradation)", () => {
  const legacyRx = {
    signal: vanillaReactivity().signal,
    computed: vanillaReactivity().computed,
    effect: vanillaReactivity().effect,
    untracked: vanillaReactivity().untracked,
    // No capabilities and no createScope. Out of contract since `capabilities` became required —
    // every adapter in this repository declares them — but reachable from JavaScript, so the engine
    // degrades to "no effects" rather than throwing on a missing property.
  };
  const engine = new MdyFormEngine(legacyRx);
  engine.claimField("email");
  engine.enableHistory();
  // Must not throw despite the missing scope.
  engine.destroy();
});
