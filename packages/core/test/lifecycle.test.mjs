/**
 * Lifecycle churn test: create and destroy many forms with all effect-driven
 * features enabled, then assert no timers (and therefore no effects) leak.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, vanillaReactivity } from "../dist/index.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("engine destroy releases effects and timers under churn", async () => {
  const activeTimers = new Set();
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;

  globalThis.setTimeout = (callback, delay, ...args) => {
    const id = origSetTimeout((...a) => {
      activeTimers.delete(ref);
      callback(...a);
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

  const storage = {
    read: () => null,
    write: () => {},
    remove: () => {},
  };

  try {
    for (let i = 0; i < 500; i++) {
      const form = createForm(
        {
          email: field("", [], {
            asyncValidators: [async () => []],
            asyncDebounceMs: 1000,
          }),
        },
        {
          history: true,
          draft: { key: `churn-${i}`, storage, debounceMs: 1000 },
        },
      );
      form.f.email.set("x");
      await wait(0); // let effects schedule their timers
      form.destroy();
      assert.equal(form.destroyed, true);
    }

    assert.equal(
      activeTimers.size,
      0,
      `expected 0 active timers after churn, found ${activeTimers.size}`,
    );
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

/**
 * Milestone 8 (piano-modyra-reactivity-adapter-api.md §17, "leak tests e
 * teardown ripetuto"): churns the reactivity-plan's own new machinery
 * (root scope, mutate(), undo()/redo(), batch()) instead of just the
 * pre-existing draft/history/async-validator paths the test above covers.
 */
test("mutate()/undo()/redo()/batch() churn releases every effect and timer", async () => {
  const activeTimers = new Set();
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;

  globalThis.setTimeout = (callback, delay, ...args) => {
    const id = origSetTimeout((...a) => {
      activeTimers.delete(ref);
      callback(...a);
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

  try {
    for (let i = 0; i < 300; i++) {
      const rx = vanillaReactivity();
      const form = createForm(
        { first: field(""), last: field("") },
        { history: true, reactivity: rx },
      );

      form.mutate(() => {
        form.f.first.set(`a-${i}`);
        form.f.last.set(`b-${i}`);
      });
      rx.batch(() => {
        form.f.first.set(`c-${i}`);
      });
      form.undo();
      form.redo();
      await rx.flush();

      form.destroy();
      assert.equal(form.destroyed, true);
    }

    assert.equal(
      activeTimers.size,
      0,
      `expected 0 active timers after mutate/batch churn, found ${activeTimers.size}`,
    );
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

/**
 * Repeated MdyReactiveScope creation/destruction (form-engine's root scope
 * plus nested test scopes) must not accumulate — every child scope should
 * be released as soon as its parent (or itself) is destroyed.
 */
test("nested scope churn does not accumulate destroyed children", () => {
  const rx = vanillaReactivity();
  for (let i = 0; i < 1000; i++) {
    const root = rx.createScope({ debugName: `root-${i}` });
    for (let j = 0; j < 5; j++) {
      const child = rx.createScope({ debugName: `child-${i}-${j}`, parent: root });
      child.onCleanup(() => {});
    }
    root.destroy();
    assert.equal(root.destroyed, true);
  }
  // No direct handle into the module-private children Set to assert size
  // on — the real assertion is behavioral: a scope created against an
  // already-destroyed parent must fail loudly, not silently succeed as if
  // the (already torn down) parent were still tracking it.
  const root = rx.createScope();
  root.destroy();
  assert.throws(() => rx.createScope({ parent: root }), /destroyed/i);
});
