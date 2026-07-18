/**
 * Lifecycle churn test: create and destroy many forms with all effect-driven
 * features enabled, then assert no timers (and therefore no effects) leak.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../dist/index.js";

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
