/**
 * Drafts on an asynchronous store.
 *
 * The fake backend below resolves **late** and **fails on demand**. One that resolves immediately
 * would pass every assertion here while proving nothing about the case this adapter exists for:
 * the whole point is the window between "the form asked" and "the store answered".
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHydratedDraftStorage } from "../dist/async-draft-storage.js";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** A Promise-based store that answers after a delay and can be told to reject. */
function fakeBackend({ seed = {}, delay = 5, failWrites = false, failReads = false } = {}) {
  const store = new Map(Object.entries(seed));
  const calls = { get: 0, set: 0, remove: 0 };
  return {
    store, calls,
    setFailWrites(v) { failWrites = v; },
    async getItem(key) {
      calls.get++;
      // What the read will answer is decided when the read is *issued*: a request that has left for
      // an out-of-process store cannot see a removal made while it is in flight. Reading the map
      // after the delay instead makes every race here resolve consistently by accident, and a store
      // that resurrects a discarded draft passes.
      const answer = store.has(key) ? store.get(key) : null;
      await tick(delay);
      if (failReads) throw new Error("read failed: " + key);
      return answer;
    },
    async setItem(key, value) {
      calls.set++;
      await tick(delay);
      if (failWrites) throw new Error("write failed: " + key);
      store.set(key, value);
    },
    async removeItem(key) {
      calls.remove++;
      await tick(delay);
      if (failWrites) throw new Error("remove failed: " + key);
      store.delete(key);
    },
  };
}

test("a read before hydration finishes reports no draft, not a stale one", async () => {
  const backend = fakeBackend({ seed: { form: "saved" }, delay: 20 });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });

  // The window this adapter exists for: the store knows, the cache does not yet.
  assert.equal(storage.read("form"), null, "a read before hydration must not invent a value");

  await storage.ready;
  assert.equal(storage.read("form"), "saved", "after hydration the stored draft is visible");
});

test("hydration never rejects, even when the store cannot be read", async () => {
  const seen = [];
  const backend = fakeBackend({ seed: { form: "saved" }, failReads: true });
  const storage = createHydratedDraftStorage({
    backend, keys: ["form"], onError: (key, error) => seen.push([key, String(error)]),
  });

  await storage.ready;   // must resolve rather than throw into the caller
  assert.equal(storage.read("form"), null, "an unreadable store reads as no draft");
  assert.equal(seen.length, 1);
  assert.match(seen[0][1], /read failed: form/);
});

test("a write is readable immediately and reaches the store afterwards", async () => {
  const backend = fakeBackend();
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });
  await storage.ready;

  storage.write("form", "typed");
  assert.equal(storage.read("form"), "typed", "the cache answers before the store has been touched");
  assert.equal(backend.store.get("form"), undefined, "the flush has not landed yet");

  await storage.flushed();
  assert.equal(backend.store.get("form"), "typed");
});

test("a write during hydration wins in memory and does not replace the stored draft", async () => {
  const backend = fakeBackend({ seed: { form: "stale" }, delay: 20 });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });

  storage.write("form", "typed");     // the user is faster than the disk
  await storage.ready;

  assert.equal(storage.read("form"), "typed", "hydration must not overwrite a newer local write");

  // And the store keeps what it held. A write before the key hydrated comes from a form that read
  // `null` — the documented answer during hydration — so it is a form that was never shown the
  // draft. Flushed, it would take the person's earlier work out of the only place it was kept,
  // without anything saying so.
  await storage.flushed();
  assert.equal(backend.store.get("form"), "stale");

  // Once the value has arrived the key writes through as normal: what happens after the form could
  // have shown the draft is the form's business.
  storage.write("form", "second");
  await storage.flushed();
  assert.equal(backend.store.get("form"), "second");
});

test("a failed flush neither throws nor loses the draft", async () => {
  const seen = [];
  const backend = fakeBackend({ failWrites: true });
  const storage = createHydratedDraftStorage({
    backend, keys: ["form"], onError: (key, error) => seen.push([key, String(error)]),
  });
  await storage.ready;

  storage.write("form", "typed");
  await storage.flushed();

  assert.equal(storage.read("form"), "typed", "a quota-style failure must not drop what the user typed");
  assert.equal(backend.store.has("form"), false, "the store genuinely rejected it");
  assert.deepEqual(seen.map(([k]) => k), ["form"]);
  assert.match(seen[0][1], /write failed/);
});

test("a draft kept through a failure is flushed by the next successful write", async () => {
  const backend = fakeBackend({ failWrites: true });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });
  await storage.ready;

  storage.write("form", "first");
  await storage.flushed();
  assert.equal(backend.store.has("form"), false);

  backend.setFailWrites(false);
  storage.write("form", "second");
  await storage.flushed();
  assert.equal(backend.store.get("form"), "second", "the store catches up once it can");
});

test("repeated writes before a flush all settle, last value winning", async () => {
  const backend = fakeBackend({ delay: 5 });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });
  await storage.ready;

  for (const value of ["a", "ab", "abc"]) storage.write("form", value);
  assert.equal(storage.read("form"), "abc", "the cache is always current");

  await storage.flushed();
  assert.equal(backend.store.get("form"), "abc", "the store ends on the last value, not a race winner");
  assert.equal(backend.calls.set, 3, "every write was issued; none was dropped");
});

test("remove then read reports no draft, and reaches the store", async () => {
  const backend = fakeBackend({ seed: { form: "saved" } });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });
  await storage.ready;
  assert.equal(storage.read("form"), "saved");

  storage.remove("form");
  assert.equal(storage.read("form"), null, "the removal is visible before the store knows");

  await storage.flushed();
  assert.equal(backend.store.has("form"), false);
});

test("a write after a remove restores the draft rather than resurrecting the old one", async () => {
  const backend = fakeBackend({ seed: { form: "saved" } });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });
  await storage.ready;

  storage.remove("form");
  storage.write("form", "fresh");
  await storage.flushed();

  assert.equal(storage.read("form"), "fresh");
  assert.equal(backend.store.get("form"), "fresh", "the remove and the write settled in order");
});

test("one unreadable key does not hide the others", async () => {
  const backend = {
    async getItem(key) {
      await tick(5);
      if (key === "broken") throw new Error("nope");
      return "value:" + key;
    },
    async setItem() {}, async removeItem() {},
  };
  const storage = createHydratedDraftStorage({ backend, keys: ["broken", "fine"] });
  await storage.ready;

  assert.equal(storage.read("broken"), null);
  assert.equal(storage.read("fine"), "value:fine", "a sibling key still hydrated");
});

test("an onError that throws does not break the flush chain", async () => {
  const backend = fakeBackend({ failWrites: true });
  const storage = createHydratedDraftStorage({
    backend, keys: ["form"], onError: () => { throw new Error("reporter exploded"); },
  });
  await storage.ready;

  storage.write("form", "one");
  await storage.flushed();

  backend.setFailWrites(false);
  storage.write("form", "two");
  await storage.flushed();
  assert.equal(backend.store.get("form"), "two", "the queue survived a throwing reporter");
});

test("a draft discarded while the store was still reading stays discarded", async () => {
  // An absent cache entry means two things during hydration — never set, and thrown away by the
  // user — and the arriving value must be kept only in the first. A React Native app opens, the
  // user presses discard before startup finishes, and the draft came back.
  const backend = fakeBackend({ seed: { form: "older, from the backend" }, delay: 20 });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });

  storage.remove("form");
  assert.equal(storage.read("form"), null);

  await storage.ready;
  assert.equal(storage.read("form"), null, "hydration resurrected a draft the user discarded");

  await storage.flushed();
  assert.equal(backend.store.has("form"), false, "the removal never reached the store");
});

test("a write after a discard during hydration is the value that survives", async () => {
  // The removal is not sticky: a write is newer than the discard that preceded it, and hydration
  // must not treat the key as discarded once something has been written to it again.
  const backend = fakeBackend({ seed: { form: "older, from the backend" }, delay: 20 });
  const storage = createHydratedDraftStorage({ backend, keys: ["form"] });

  storage.remove("form");
  storage.write("form", "typed after the discard");

  await storage.ready;
  assert.equal(storage.read("form"), "typed after the discard");
  await storage.flushed();
  assert.equal(backend.store.get("form"), "typed after the discard");
});
