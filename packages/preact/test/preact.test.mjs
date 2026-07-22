import { test } from "node:test";
import assert from "node:assert/strict";
import { createFieldStore, createForm, field, required } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("field store notifies subscribers and bumps its snapshot", async () => {
  const form = createForm({ email: field("", [required()]) });
  const store = createFieldStore(form.f.email);
  const before = store.getSnapshot();
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);

  form.f.email.set("a@b.co");
  await tick(); // vanilla effects are microtask-batched
  assert.ok(notified >= 1);
  assert.ok(store.getSnapshot() > before);

  unsubscribe();
  const after = notified;
  form.f.email.set("c@d.ef");
  await tick();
  assert.equal(notified, after); // unsubscribed
  store.destroy();
});

test("useMdyForm's activate/deactivate sequence tolerates a double-mount-style cycle", async () => {
  // Simulates exactly what useMdyForm's useEffect now does (construct with
  // autoActivate: false, activate() on mount, deactivate() on cleanup)
  // instead of rendering a component — hooks aren't invoked directly in
  // this suite (no renderer here).
  const form = createForm(
    { email: field("", [required()]) },
    { history: true, autoActivate: false },
  );
  assert.equal(form.deactivated, true, "construction must stay paused");

  form.activate();
  form.deactivate();
  form.activate();
  await tick();

  assert.equal(form.deactivated, false);
  form.f.email.set("a@b.co");
  await tick();
  assert.equal(form.canUndo(), true, "history must be recording after the double-mount settles");
  assert.equal(form.f.email.value(), "a@b.co");

  form.deactivate();
  assert.equal(form.f.email.value(), "a@b.co");
  assert.equal(form.canUndo(), true);

  form.destroy();
});

/**
 * Independent minimal reactive engine, deliberately NOT vanillaReactivity
 * and unaware of its module-global dependency graph. Before M5,
 * createFieldStore() always built a fresh `vanillaReactivity()` internally
 * to observe a handle's signals — harmless for THIS package's own
 * vanilla-backed useMdyForm(), but silently inert for a handle owned by any
 * other runtime (Vue/Solid/Angular, or — as here — a custom one).
 */
function customReactivity() {
  let activeEffect = null;
  function signal(initial) {
    const subs = new Set();
    let value = initial;
    const read = () => {
      if (activeEffect) subs.add(activeEffect);
      return value;
    };
    read.set = (v) => {
      if (Object.is(value, v)) return;
      value = v;
      for (const fn of [...subs]) fn();
    };
    read.update = (fn) => read.set(fn(value));
    read.asReadonly = () => () => read();
    return read;
  }
  return {
    canEffect: true,
    signal,
    computed: (fn) => () => fn(),
    effect: (fn) => {
      let destroyed = false;
      const run = () => {
        if (destroyed) return;
        activeEffect = run;
        try {
          fn(() => {});
        } finally {
          activeEffect = null;
        }
      };
      run();
      return { destroy: () => { destroyed = true; }, get destroyed() { return destroyed; } };
    },
    untracked: (fn) => {
      const prev = activeEffect;
      activeEffect = null;
      try {
        return fn();
      } finally {
        activeEffect = prev;
      }
    },
  };
}

test("createFieldStore observes through the handle's real owner, not a fresh vanilla instance", () => {
  const rx = customReactivity();
  const form = createForm({ email: field("", [required()]) }, { reactivity: rx });
  const store = createFieldStore(form.f.email);
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);

  form.f.email.set("a@b.co"); // customReactivity's effect runs synchronously — no microtask wait needed
  assert.ok(notified >= 1, "the store must react to a write on a non-vanilla, unrelated reactivity");

  unsubscribe();
  store.destroy();
});
