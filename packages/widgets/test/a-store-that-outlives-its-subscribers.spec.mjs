/**
 * A signal store tracks only while someone listens, and losing every listener is not its end.
 *
 * A component can be cleaned up and mounted again over the same store. The second mount has to find a
 * store that still notifies, and has to read a value that moved while nobody listened. `destroy()` —
 * directly, or through the form that owns the field — is the only end.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, vanillaReactivity } from "@modyra/core";
import { createFieldSignalStore, createSignalStore } from "../dist/index.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a store left by every subscriber notifies again once subscribed anew", async () => {
  const rx = vanillaReactivity();
  const value = rx.signal(0);
  const store = createSignalStore([value], rx);
  let calls = 0;
  store.subscribe(() => calls++)();
  store.subscribe(() => calls++);
  value.set(1);
  await tick();
  assert.equal(calls, 1);
  store.destroy();
});

test("a value that moved while nobody listened bumps the snapshot when tracking resumes", async () => {
  const rx = vanillaReactivity();
  const value = rx.signal(0);
  const store = createSignalStore([value], rx);
  store.subscribe(() => undefined)();
  const before = store.getSnapshot();
  value.set(1);
  await tick();
  store.subscribe(() => undefined);
  await tick();
  assert.notEqual(store.getSnapshot(), before);
  store.destroy();
});

test("a destroyed store notifies no one, and a later subscription is inert", async () => {
  const rx = vanillaReactivity();
  const value = rx.signal(0);
  const store = createSignalStore([value], rx);
  let calls = 0;
  store.subscribe(() => calls++);
  store.destroy();
  store.subscribe(() => calls++);
  value.set(1);
  await tick();
  assert.equal(calls, 0);
});

test("a field store stops notifying when its form is destroyed", async () => {
  const form = createForm({ email: field("") });
  const store = createFieldSignalStore(form.f.email);
  let calls = 0;
  store.subscribe(() => calls++);
  form.f.email.set("a@b.c");
  await tick();
  assert.equal(calls, 1);
  form.destroy();
  form.f.email.set("d@e.f");
  await tick();
  assert.equal(calls, 1);
});
