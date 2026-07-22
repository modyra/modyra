/**
 * Milestone 6 (piano-modyra-reactivity-adapter-api.md §12.1): form.mutate()
 * must coalesce a burst of field writes into exactly one history entry,
 * regardless of whether the reactivity adapter's effects run synchronously
 * (Vue/Solid) or are scheduler-deferred (vanilla/Angular).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("mutate() coalesces multiple sets into one history entry (vanilla)", async () => {
  const form = createForm(
    { first: field(""), last: field("") },
    { history: true },
  );
  await tick(); // seed the initial snapshot

  form.mutate(() => {
    form.f.first.set("Lorenzo");
    form.f.last.set("Muscherà");
  });

  assert.equal(form.f.first.value(), "Lorenzo");
  assert.equal(form.f.last.value(), "Muscherà");
  assert.equal(form.canUndo(), true);

  form.undo();
  // One undo restores BOTH fields to their pre-mutate values — proof the
  // two writes became a single history entry, not two.
  assert.equal(form.f.first.value(), "");
  assert.equal(form.f.last.value(), "");
  assert.equal(form.canUndo(), false);

  form.destroy();
});

test("mutate() is a no-op wrapper when history was never enabled", () => {
  const form = createForm({ first: field("") });
  assert.doesNotThrow(() => {
    form.mutate(() => form.f.first.set("x"));
  });
  assert.equal(form.f.first.value(), "x");
  form.destroy();
});

test("nested mutate() calls coalesce into the outer call's single entry", async () => {
  const form = createForm({ a: field(""), b: field(""), c: field("") }, { history: true });
  await tick();

  form.mutate(() => {
    form.f.a.set("1");
    form.mutate(() => {
      form.f.b.set("2");
    });
    form.f.c.set("3");
  });

  form.undo();
  assert.equal(form.f.a.value(), "");
  assert.equal(form.f.b.value(), "");
  assert.equal(form.f.c.value(), "");

  form.destroy();
});

/**
 * Independent synchronous reactive engine (deliberately not vanilla's
 * microtask-batched one) — this is the exact scheduling model Vue/Solid's
 * raw effects use. Without mutate()'s isMutating guard, each set() inside
 * the block below would synchronously re-run the history effect and push
 * a SEPARATE undo entry per field instead of one.
 */
function syncReactivity() {
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

test("undo()/redo() do not push spurious entries on a synchronous-effect reactivity", () => {
  // Regression: undo()/redo() restore a value via multiple sequential field
  // writes too (setValue() isn't atomic), which on a synchronous-effect
  // adapter used to fire the history effect mid-restore and push bogus
  // entries — found while building the mutate() fix above, same root cause.
  const rx = syncReactivity();
  const form = createForm(
    { first: field(""), last: field("") },
    { history: true, reactivity: rx },
  );

  form.mutate(() => {
    form.f.first.set("Lorenzo");
    form.f.last.set("Muscherà");
  });
  assert.equal(form.canUndo(), true);

  form.undo();
  assert.equal(form.f.first.value(), "");
  assert.equal(form.f.last.value(), "");
  assert.equal(form.canUndo(), false, "undo() itself must not push spurious entries");
  assert.equal(form.canRedo(), true);

  form.redo();
  assert.equal(form.f.first.value(), "Lorenzo");
  assert.equal(form.f.last.value(), "Muscherà");
  assert.equal(form.canRedo(), false, "redo() itself must not push spurious entries");
  assert.equal(form.canUndo(), true);

  form.destroy();
});

test("mutate() coalesces into one entry even on a synchronous-effect reactivity", () => {
  const rx = syncReactivity();
  const form = createForm(
    { first: field(""), last: field("") },
    { history: true, reactivity: rx },
  );
  // syncReactivity's history effect ran once already, synchronously, seeding
  // the initial snapshot — no tick needed.

  form.mutate(() => {
    form.f.first.set("Lorenzo");
    form.f.last.set("Muscherà");
  });

  assert.equal(form.canUndo(), true);
  form.undo();
  assert.equal(form.f.first.value(), "", "one undo must restore both fields");
  assert.equal(form.f.last.value(), "");
  assert.equal(form.canUndo(), false, "the burst must have produced exactly one entry");

  form.destroy();
});
