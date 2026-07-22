/**
 * Milestone 2 (piano-modyra-reactivity-adapter-api.md §5): proves the form's
 * root scope is a REAL ownership boundary, not just a decoration — draft,
 * history and async-validator effects must actually die when the scope is
 * destroyed directly, independent of MdyFormEngine's own explicit destroy()
 * calls in its manager classes.
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
    3,
    "draft, history and the async validator should all register with the form's scope",
  );
  const [scope] = scoped.map((e) => e.scope);
  assert.ok(
    scoped.every((e) => e.scope === scope),
    "all three effects must share the same root scope instance",
  );
  assert.ok(
    scoped.every((e) => e.ref.destroyed === false),
    "effects are alive before the scope is destroyed",
  );

  // Bypass engine.destroy() entirely — this proves ownership is real, not
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
    canEffect: true,
    signal: vanillaReactivity().signal,
    computed: vanillaReactivity().computed,
    effect: vanillaReactivity().effect,
    untracked: vanillaReactivity().untracked,
    // no capabilities, no createScope — mirrors Vue/Solid/Angular today
  };
  const engine = new MdyFormEngine(legacyRx);
  engine.claimField("email");
  engine.enableHistory();
  // Must not throw despite the missing scope.
  engine.destroy();
});
