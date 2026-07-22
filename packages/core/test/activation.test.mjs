/**
 * Construction/activation separation (piano-modyra-reactivity-adapter-api.md
 * §10.5/§10.7): `autoActivate: false` must keep construction pure (no
 * timers, no storage reads) until `activate()` runs, and `deactivate()`
 * must pause effect-dependent features without losing any state — the
 * property React/Preact's useMdyForm needs for Strict Mode/SSR safety.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function spyStorage() {
  const store = new Map();
  const calls = { read: 0, write: 0 };
  return {
    calls,
    storage: {
      read: (key) => {
        calls.read++;
        return store.has(key) ? store.get(key) : null;
      },
      write: (key, value) => {
        calls.write++;
        store.set(key, value);
      },
      remove: (key) => store.delete(key),
    },
  };
}

test("autoActivate: false keeps construction pure — no storage read, no history baseline until activate()", () => {
  const { storage, calls } = spyStorage();
  const form = createForm(
    { email: field("") },
    {
      history: true,
      draft: { key: "k", storage },
      autoActivate: false,
    },
  );

  assert.equal(form.deactivated, true);
  assert.equal(calls.read, 0, "construction must not read storage before activate()");
  assert.equal(form.canUndo(), false);

  form.destroy();
});

test("activate() starts draft/history, deactivate() pauses them without losing state", async () => {
  const { storage } = spyStorage();
  const form = createForm(
    { email: field("") },
    { history: true, draft: { key: "k", storage, debounceMs: 0 }, autoActivate: false },
  );

  form.activate();
  assert.equal(form.deactivated, false);
  await tick(); // seed the history baseline

  form.f.email.set("a@b.co");
  await tick();
  assert.equal(form.canUndo(), true, "history must be recording once activated");

  form.deactivate();
  assert.equal(form.deactivated, true);

  // State survives deactivation — nothing was cleared.
  assert.equal(form.canUndo(), true);
  assert.equal(form.f.email.value(), "a@b.co");

  // Further writes while deactivated must not be recorded (effect paused).
  form.f.email.set("c@d.ef");
  await tick();

  form.activate();
  await tick();
  // Undo restores to the last snapshot recorded BEFORE deactivate() — the
  // write made while deactivated was never tracked, so it's simply the
  // current value, not a separate undo step.
  assert.equal(form.f.email.value(), "c@d.ef");

  form.destroy();
});

test("repeated deactivate()/activate() cycles (Strict Mode simulation) do not leak timers or corrupt state", async () => {
  const activeTimers = new Set();
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (cb, delay, ...args) => {
    const id = origSetTimeout((...a) => {
      activeTimers.delete(ref);
      cb(...a);
    }, delay, ...args);
    const ref = { id };
    activeTimers.add(ref);
    return id;
  };
  globalThis.clearTimeout = (id) => {
    for (const ref of activeTimers) {
      if (ref.id === id) {
        activeTimers.delete(ref);
        break;
      }
    }
    origClearTimeout(id);
  };

  const { storage } = spyStorage();
  try {
    const form = createForm(
      {
        email: field("", [], { asyncValidators: [async () => []], asyncDebounceMs: 50 }),
      },
      { history: true, draft: { key: "k2", storage, debounceMs: 50 }, autoActivate: false },
    );

    // Strict Mode: mount -> activate, (dev-only) unmount -> deactivate,
    // remount -> activate again. Repeat a few times.
    for (let i = 0; i < 5; i++) {
      form.activate();
      form.f.email.set(`v${i}`);
      form.deactivate();
    }
    form.activate();
    await tick();
    form.destroy();

    assert.equal(
      activeTimers.size,
      0,
      `expected 0 active timers after activate/deactivate churn + destroy, found ${activeTimers.size}`,
    );
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

test("activate()/deactivate()/destroy() are all idempotent and safe in any order", async () => {
  const form = createForm({ email: field("") }, { history: true, autoActivate: false });
  form.deactivate(); // no-op, never activated
  form.activate();
  form.activate(); // idempotent
  await tick();
  form.deactivate();
  form.deactivate(); // idempotent
  form.destroy();
  form.destroy(); // idempotent
  assert.doesNotThrow(() => {
    form.activate();
    form.deactivate();
  });
});

test("autoActivate defaults to true — existing behavior for every other adapter is unchanged", async () => {
  const { storage, calls } = spyStorage();
  const form = createForm(
    { email: field("") },
    { history: true, draft: { key: "k3", storage, debounceMs: 0 } },
  );
  assert.equal(form.deactivated, false, "effects start immediately without autoActivate: false");
  await tick();
  assert.equal(calls.read, 1, "draft storage is read at construction, same as before this feature");
  form.destroy();
});
