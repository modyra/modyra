import { test } from "node:test";
import assert from "node:assert/strict";
import { createFieldStore, createForm, field, required } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("field store notifies subscribers and bumps its snapshot", async () => {
  const form = createForm({ email: field("", [required()]) });
  const store = createFieldStore(form.f.email);
  const before = store.getSnapshot();
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);

  form.f.email.set("a@b.co");
  await tick(); // vanilla effects are microtask-batched
  assert.ok(notified >= 1);
  assert.ok(store.getSnapshot() > before);

  unsubscribe();
  const after = notified;
  form.f.email.set("c@d.ef");
  await tick();
  assert.equal(notified, after); // unsubscribed
  store.destroy();
});
