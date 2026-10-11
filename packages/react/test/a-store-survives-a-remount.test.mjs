/**
 * A field store tracks while it is subscribed, and a later subscription finds it still answering.
 *
 * A component that is cleaned up and mounted again keeps its memoised store. If the cleanup ended
 * the store for good, the remounted component would render once and never again. The store's
 * lifetime is its subscriptions instead: the last unsubscribe stops tracking, the next subscribe
 * resumes it, and only the form's own end, or `destroy()`, silences it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFieldStore, createForm, field } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a store unsubscribed and subscribed again still notifies on a write", async () => {
  const form = createForm({ name: field("") });
  const store = createFieldStore(form.f.name);
  store.subscribe(() => undefined)();
  let notified = 0;
  store.subscribe(() => notified++);
  form.f.name.set("Ada");
  await tick();
  assert.ok(notified >= 1);
  form.destroy();
});

test("a value that moved while nobody was subscribed bumps the snapshot when tracking resumes", async () => {
  const form = createForm({ name: field("") });
  const store = createFieldStore(form.f.name);
  store.subscribe(() => undefined)();
  const before = store.getSnapshot();
  form.f.name.set("Ada");
  await tick();
  store.subscribe(() => undefined);
  await tick();
  assert.ok(store.getSnapshot() > before);
  form.destroy();
});

test("resuming with nothing moved does not bump the snapshot", async () => {
  // Control for the case above: a remount over unchanged state must not cost a second render.
  const form = createForm({ name: field("x") });
  const store = createFieldStore(form.f.name);
  store.subscribe(() => undefined)();
  const before = store.getSnapshot();
  store.subscribe(() => undefined);
  await tick();
  assert.equal(store.getSnapshot(), before);
  form.destroy();
});

test("the form's end still silences a subscribed store", async () => {
  const form = createForm({ name: field("") });
  const store = createFieldStore(form.f.name);
  let notified = 0;
  store.subscribe(() => notified++);
  const name = form.f.name;
  form.destroy();
  name.set("after");
  await tick();
  assert.equal(notified, 0);
});

test("the form holds a store's teardown only while the store is subscribed", () => {
  const registered = new Set();
  // Count registrations through the form's own affordance.
  const form = createForm({ name: field("") });
  const onDestroy = form.onDestroy.bind(form);
  form.onDestroy = (teardown) => {
    registered.add(teardown);
    const release = onDestroy(teardown);
    return () => {
      registered.delete(teardown);
      release();
    };
  };
  const store = createFieldStore(form.f.name);
  assert.equal(registered.size, 0, "nothing is held before anyone subscribes");
  const first = store.subscribe(() => undefined);
  const second = store.subscribe(() => undefined);
  assert.equal(registered.size, 1);
  first();
  first();
  assert.equal(registered.size, 1, "a repeated unsubscribe does not release the other subscriber's hold");
  second();
  assert.equal(registered.size, 0);
  form.destroy();
});
