// A consumer's own `computed` and `watchEffect`, imported from "vue", track form state. They only can
// when the adapter and the consumer share one reactivity runtime: a ref made by a second copy of
// @vue/reactivity is invisible to Vue's effects, and the page stops updating without an error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computed, watchEffect, nextTick } from "vue";
import { createVueForm, field } from "../dist/index.js";

test("a computed from vue recomputes when a field is written", () => {
  const form = createVueForm({ email: field("") });
  const shown = computed(() => form.f.email.value());
  assert.equal(shown.value, "");
  form.f.email.set("a@b.c");
  assert.equal(shown.value, "a@b.c");
});

test("a watchEffect from vue runs again when a field is written", async () => {
  const form = createVueForm({ email: field("") });
  const seen = [];
  const stop = watchEffect(() => { seen.push(form.f.email.value()); });
  form.f.email.set("a@b.c");
  await nextTick();
  stop();
  assert.deepEqual(seen, ["", "a@b.c"]);
});

test("an untracked read leaves nothing behind in the scope it ran in", async () => {
  const { effectScope } = await import("vue");
  const { vueReactivity } = await import("../dist/index.js");
  const reactivity = vueReactivity();
  const value = reactivity.signal(1);
  const scope = effectScope();
  scope.run(() => {
    for (let i = 0; i < 100; i++) reactivity.untracked(() => value());
  });
  assert.equal(scope.effects.length, 0, "every untracked read stays held by a long-lived scope");
  scope.stop();
});
