/**
 * The draft storage a phone has, and the promises it makes about waiting.
 *
 * `MdyDraftStorage` is synchronous by design: a field writes a draft while the user types, and there
 * is nothing sensible for `read` to return to a caller that cannot wait. React Native's standard
 * storage is Promise-based, so the two do not meet without a cache in between, and
 * `createHydratedDraftStorage` is that cache.
 *
 * Its contract states two things the shape does not make obvious, both deliberate, and both about
 * what happens when the store is slower or worse than the form:
 *
 * - **a read before hydration finishes returns `null`** — "no draft", never a stale or partial one,
 *   because a form restoring a draft that is not the user's is worse than a form restoring nothing;
 * - **a failed flush is never thrown into the form and never loses the draft** — the value stays in
 *   the cache, so the user keeps typing and it survives even if the device's storage is full.
 *
 * Nothing in this suite had exercised any of it, and it is a production path: the one an application
 * on a phone takes. This battle is green and holds the six promises the record makes, because each is
 * a decision that reads as an implementation detail and is not one.
 */

import { createForm, field } from "@modyra/core";
import { createHydratedDraftStorage } from "@modyra/core/async-draft-storage";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
const saved = () => new Promise((resolve) => setTimeout(resolve, 760));

/** A Promise-based store that can be made slow, unreadable or unwritable. */
function store({ seed = {}, readDelay = 0, readRejects = false, writeRejects = false } = {}) {
  const held = new Map(Object.entries(seed));
  return {
    held,
    getItem: async (key) => {
      if (readRejects) throw new Error("read blew up");
      await settled(readDelay);
      return held.get(key) ?? null;
    },
    setItem: async (key, value) => {
      if (writeRejects) throw new Error("disk full");
      held.set(key, value);
    },
    removeItem: async (key) => {
      held.delete(key);
    },
  };
}

battle(
  {
    claims: ["PER-001", "LIF-001"],
    title: "a store that cannot answer at once says no draft, and never a partial one",
    environments: ["node"],
  },
  async (ctx) => {
    const backend = store({
      seed: { d: JSON.stringify({ __mdyDraft: 1, savedAt: 1, value: { a: "from storage" } }) },
      readDelay: 120,
    });
    const storage = createHydratedDraftStorage({ backend, keys: ["d"] });

    // Before hydration finishes. "No draft" is the only honest answer a synchronous read can give
    // while the store is still talking.
    expectEqual(storage.read("d"), null, {
      claimIds: ["PER-001"],
      what: "a read before hydration answered with something, which a form would restore as the user's",
    });

    await storage.ready;
    const hydrated = storage.read("d");
    ctx.log.note("after ready", { hydrated: String(hydrated).slice(0, 60) });

    // And afterwards it is there, which is what makes the null above a wait rather than a loss.
    expectClaim(typeof hydrated === "string" && hydrated.includes("from storage"), {
      claimIds: ["PER-001"],
      what: "the draft never arrived after hydration finished, so the null before it was a loss",
      detail: String(hydrated),
    });

    // A key nobody asked to hydrate is absent rather than fetched behind the caller's back: a
    // key/value store cannot be enumerated portably, so hydration reads what it is told to.
    expectEqual(storage.read("never-asked-for"), null, {
      claimIds: ["PER-001"],
      what: "a key outside the hydration list answered with something",
    });
  },
);

battle(
  {
    claims: ["PER-001", "LIF-001"],
    title: "a store that fails keeps the user's work and does not fail the form",
    environments: ["node"],
  },
  async (ctx) => {
    // A store that cannot be read at all. `ready` never rejects: a store that cannot be read leaves
    // the cache empty, which reads as "no draft" rather than as an error the form must handle.
    const unreadable = store({ readRejects: true });
    const readErrors = [];
    const cold = createHydratedDraftStorage({
      backend: unreadable,
      keys: ["d"],
      onError: (key, error) => readErrors.push([key, String(error.message)]),
    });

    let rejected = false;
    try {
      await cold.ready;
    } catch {
      rejected = true;
    }
    ctx.log.note("a store that cannot be read", { rejected, read: cold.read("d"), readErrors });

    expectEqual([rejected, cold.read("d")], [false, null], {
      claimIds: ["LIF-001"],
      what: "a store that could not be read rejected `ready`, or answered with something",
    });

    expectClaim(readErrors.length > 0, {
      claimIds: ["PER-001"],
      what: "a read that failed was not reported to the caller who asked to be told",
      detail: JSON.stringify(readErrors),
    });

    // A store that cannot be written. The user keeps typing and the draft survives in memory.
    const unwritable = store({ writeRejects: true });
    const writeErrors = [];
    const full = createHydratedDraftStorage({
      backend: unwritable,
      keys: ["d"],
      onError: (key, error) => writeErrors.push([key, String(error.message)]),
    });
    await full.ready;

    let threw = null;
    try {
      full.write("d", "the user's work");
    } catch (error) {
      threw = String(error.message);
    }
    await full.flushed();
    ctx.log.note("a store that cannot be written", {
      threw,
      readBack: full.read("d"),
      writeErrors,
      reachedTheBackend: [...unwritable.held.keys()],
    });

    expectEqual([threw, full.read("d")], [null, "the user's work"], {
      claimIds: ["PER-001", "LIF-001"],
      what: "a flush that failed was thrown into the form, or lost the draft it could not write",
    });

    expectClaim(writeErrors.length > 0 && unwritable.held.size === 0, {
      claimIds: ["PER-001"],
      what: "the failed write was not reported, or reached the backend after all",
      detail: JSON.stringify({ writeErrors, backend: [...unwritable.held.keys()] }),
    });

    // And without anyone to tell: silent, and the draft still survives. The record calls this the
    // same bargain the default storage makes with quota errors.
    const quiet = createHydratedDraftStorage({ backend: store({ writeRejects: true }), keys: ["d"] });
    await quiet.ready;
    quiet.write("d", "still here");
    await quiet.flushed();

    expectEqual(quiet.read("d"), "still here", {
      claimIds: ["PER-001"],
      what: "with no error handler the draft was lost as well as unreported",
    });
  },
);

battle(
  {
    claims: ["PER-001"],
    title: "a form restores through an asynchronous store once it has hydrated",
    environments: ["node"],
  },
  async (ctx) => {
    // The whole path, end to end: the two battles above are about the cache's promises, and this is
    // the control that a form on a phone actually gets its draft back through it.
    const backend = store();
    const first = createHydratedDraftStorage({ backend, keys: ["f"] });
    await first.ready;

    const writing = createForm({ v: field("") }, { draft: { key: "f", storage: first }, devWarnings: false });
    writing.f.v.set("typed on a phone");
    await saved();
    await first.flushed();
    writing.destroy();
    ctx.log.note("what reached the store", { keys: [...backend.held.keys()] });

    expectClaim(backend.held.has("f"), {
      claimIds: ["PER-001"],
      what: "nothing reached the asynchronous store, so the restore below would prove nothing",
    });

    const second = createHydratedDraftStorage({ backend, keys: ["f"] });
    await second.ready;
    const reopened = createForm({ v: field("") }, { draft: { key: "f", storage: second }, devWarnings: false });
    await settled(180);
    const restored = reopened.getValue();
    reopened.destroy();

    expectEqual(restored, { v: "typed on a phone" }, {
      claimIds: ["PER-001"],
      what: "a form did not get its draft back through an asynchronous store",
    });
  },
);
