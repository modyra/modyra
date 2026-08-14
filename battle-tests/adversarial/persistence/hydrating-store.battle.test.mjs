/**
 * A draft store that is still reading when the consumer already decided.
 *
 * `createHydratedDraftStorage` exists for a backend that cannot answer synchronously — React
 * Native's async storage, an IndexedDB wrapper, a keychain. The form is built and usable before the
 * store has finished reading, so every operation a consumer makes in that window races the read
 * that is still in flight, and the store has to decide which of the two is newer.
 *
 * It decides correctly for a write: hydration only fills a key the cache does not already hold, so a
 * value the user typed during startup survives the older one arriving from the backend. That guard
 * is the positive control here, because it proves the mechanism exists and is deliberate.
 *
 * It does not decide at all for a removal. `remove` empties the cache entry, which is exactly the
 * state hydration reads as "nothing here yet" — so a draft the consumer discarded while the store
 * was reading comes back. A user who opens an app, presses discard before it has finished starting,
 * and finds the draft again is the whole of this.
 */

import { createHydratedDraftStorage } from "@modyra/core/async-draft-storage";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/**
 * A backend that answers later, so the window this attacks is open long enough to act in.
 *
 * The value a read resolves with is captured when the read is *issued*, not when it settles. That is
 * what an out-of-process backend does — the request left before the removal was made — and modelling
 * it the other way hides the race entirely: a store whose later write reaches the same map the
 * pending read will consult answers consistently by accident.
 */
function slowBackend(stored, { onWrite = () => {}, delayMs = 20 } = {}) {
  const state = new Map(Object.entries(stored));
  return {
    getItem: (key) => {
      const answer = state.get(key) ?? null;
      return new Promise((resolve) => setTimeout(() => resolve(answer), delayMs));
    },
    setItem: async (key, value) => {
      onWrite(key, value);
      state.set(key, value);
    },
    removeItem: async (key) => {
      state.delete(key);
    },
  };
}

battle(
  {
    claims: ["PER-001"],
    title: "a draft discarded while the store was still reading stays discarded",
    environments: ["node"],
  },
  async (ctx) => {
    // The control first: the store does resolve this race, and does it right for a write. Without
    // this the finding below reads as "an async store has no ordering", which is a different and
    // much weaker claim.
    const forWrite = createHydratedDraftStorage({
      backend: slowBackend({ draft: "older, from the backend" }),
      keys: ["draft"],
    });
    forWrite.write("draft", "newer, from the user");
    await forWrite.ready;
    ctx.log.note("a write made while the store was hydrating", {});

    expectEqual(forWrite.read("draft"), "newer, from the user", {
      claimIds: ["PER-001"],
      what: "hydration overwrote a value the consumer had already written",
    });

    // The same window, the other operation. A removal is the consumer saying something newer about
    // that key just as much as a write is.
    const forRemoval = createHydratedDraftStorage({
      backend: slowBackend({ draft: "older, from the backend" }),
      keys: ["draft"],
    });

    expectEqual(forRemoval.read("draft"), null, {
      claimIds: ["PER-001"],
      what: "a read before the store was ready answered with something",
    });

    forRemoval.remove("draft");
    ctx.log.note("a draft discarded while the store was hydrating", {});

    expectEqual(forRemoval.read("draft"), null, {
      claimIds: ["PER-001"],
      what: "the discarded draft was still readable immediately after the removal",
    });

    await forRemoval.ready;

    expectEqual(forRemoval.read("draft"), null, {
      claimIds: ["PER-001"],
      what: "hydration brought back a draft the consumer had discarded",
    });
  },
);

battle(
  {
    claims: ["PER-001", "LIF-001"],
    title: "a backend that refuses a write neither raises nor loses what was typed",
    environments: ["node"],
  },
  async (ctx) => {
    const reported = [];
    const store = createHydratedDraftStorage({
      backend: {
        getItem: async () => null,
        setItem: async () => {
          throw new Error("quota exceeded");
        },
        removeItem: async () => {},
      },
      keys: ["draft"],
      onError: (key, error) => reported.push(`${key}: ${error.message}`),
    });

    await store.ready;
    store.write("draft", "what the user typed");
    ctx.log.note("a write against a backend that refuses it", {});

    let raised = null;
    try {
      await store.flushed();
    } catch (error) {
      raised = error;
    }

    // A backend failing is the application's problem to report, never the form's to crash on: the
    // flush chain has to survive it, or every later write is lost behind a rejected promise.
    expectClaim(raised === null, {
      claimIds: ["LIF-001"],
      what: "a refused write was thrown into the caller's path",
      detail: raised?.message ?? "",
    });

    expectEqual(reported, ["draft: quota exceeded"], {
      claimIds: ["PER-001"],
      what: "a refused write was swallowed instead of reported",
    });

    // And what the user typed is still there to try again with.
    expectEqual(store.read("draft"), "what the user typed", {
      claimIds: ["PER-001"],
      what: "a refused write lost what the user had typed",
    });

    // The chain still works afterwards, which is what "never breaks the flush chain" has to mean.
    const later = [];
    const second = createHydratedDraftStorage({
      backend: slowBackend({}, { onWrite: (key, value) => later.push(`${key}=${value}`) }),
      keys: ["draft"],
    });
    await second.ready;
    second.write("draft", "first");
    second.write("draft", "second");
    await second.flushed();

    expectEqual(later, ["draft=first", "draft=second"], {
      claimIds: ["PER-001"],
      what: "queued writes did not reach the backend in the order they were made",
    });
  },
);
