import { test } from "node:test";
import assert from "node:assert/strict";
import { get } from "svelte/store";
import { createSvelteForm, field, required, toStore } from "../dist/index.js";

test("toStore() produces a real Svelte store: get() reads the current value", () => {
  const form = createSvelteForm({ email: field("", [required()]) });
  const emailStore = toStore(form.f.email.value);

  assert.equal(get(emailStore), "");
  form.f.email.set("a@b.co");
  assert.equal(get(emailStore), "a@b.co");
});

test("toStore() subscribers are called synchronously on subscribe, then on every change (microtask-batched)", async () => {
  const form = createSvelteForm({ email: field("", [required()]) });
  const validStore = toStore(form.f.email.valid);

  const seen = [];
  const unsubscribe = validStore.subscribe((v) => seen.push(v));
  assert.deepEqual(seen, [false]); // synchronous initial call, per the store contract

  form.f.email.set("a@b.co");
  // toStore() wraps a vanilla-graph effect, and effects are microtask-
  // batched (same as async validators/drafts/history elsewhere in the
  // engine) — unlike Svelte's own writable(), which notifies
  // synchronously. A tick is required before the change is observed.
  await Promise.resolve();
  assert.deepEqual(seen, [false, true]);

  unsubscribe();
  form.f.email.set("");
  await Promise.resolve();
  assert.deepEqual(seen, [false, true]); // no more notifications after unsubscribe
});

test("form-level signals (canUndo/canSubmit) also bridge to stores", () => {
  const form = createSvelteForm(
    { name: field("", [required()]) },
    { history: { debounceMs: 0 } },
  );
  const canUndoStore = toStore(form.canUndo);
  const canSubmitStore = toStore(form.state.canSubmit);

  assert.equal(get(canUndoStore), false);
  assert.equal(get(canSubmitStore), false);

  form.f.name.set("Ada");
  assert.equal(get(canSubmitStore), true);
});
