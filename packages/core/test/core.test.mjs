/**
 * The "decisive test" of the domain-model extraction: the whole form engine
 * runs in plain Node — no framework, no DI, no DOM.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createForm,
  crossField,
  field,
  group,
  min,
  required,
} from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("typed form: create, set, validate — no framework", () => {
  const form = createForm({
    email: field("", [required()]),
    age: field(null, [min(18)]),
    address: group({ city: field("Rome") }),
  });

  assert.equal(form.state.valid(), false);
  form.f.email.set("foo@bar.com");
  assert.deepEqual(form.f.email.errors(), []);
  assert.equal(form.state.valid(), true);
  assert.equal(form.getValue().address.city, "Rome");
});

test("cross-field validation reacts through the vanilla graph", () => {
  const form = createForm(
    { password: field(""), confirm: field("") },
    {
      validators: [
        crossField(["confirm"], (v) =>
          v.password === v.confirm ? null : "Passwords differ",
        ),
      ],
    },
  );
  form.f.password.set("secret");
  assert.equal(form.f.confirm.valid(), false);
  form.f.confirm.set("secret");
  assert.equal(form.f.confirm.valid(), true);
});

test("async validators: pending, last-wins, debounce", async () => {
  const form = createForm({
    user: field("", [], {
      asyncValidators: [async (v) => (v === "taken" ? ["Name taken"] : [])],
    }),
  });
  await tick(); // initial effect run
  form.f.user.set("taken");
  await tick(); // effect re-run schedules the validator
  await tick(); // promise settles
  assert.deepEqual(
    form.f.user.errors().map((e) => e.message),
    ["Name taken"],
  );
  form.f.user.set("free");
  await tick();
  await tick();
  assert.deepEqual(form.f.user.errors(), []);
});

test("undo/redo and getChanges", async () => {
  const form = createForm({ name: field("start") }, { history: true });
  await tick(); // seed snapshot
  form.f.name.set("edited");
  await tick(); // record
  assert.deepEqual(form.getChanges(), { name: "edited" });

  form.undo();
  assert.equal(form.f.name.value(), "start");
  form.redo();
  assert.equal(form.f.name.value(), "edited");
});

test("draft persistence with exclude and versioned envelope", async () => {
  const data = new Map();
  const storage = {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
  const make = () =>
    createForm(
      { email: field(""), password: field("") },
      { draft: { key: "d", storage, debounceMs: 1, exclude: ["password"] } },
    );

  const first = make();
  await tick();
  first.f.email.set("a@b.co");
  first.f.password.set("hunter2");
  await tick();
  await new Promise((r) => setTimeout(r, 10)); // debounce flush

  const stored = data.get("d");
  assert.ok(stored.includes("a@b.co"));
  assert.ok(!stored.includes("hunter2"));
  assert.ok(JSON.parse(stored).__mdyDraft === 1);

  const second = make();
  assert.equal(second.f.email.value(), "a@b.co");
  assert.equal(second.f.password.value(), "");
  assert.equal(second.hasDraft(), true);
});

test("submit gates on validity and snapshots server errors", async () => {
  const form = createForm({ name: field("", [required()]) });
  let ran = false;
  await form.submit(() => void (ran = true));
  assert.equal(ran, false); // invalid: blocked, fields marked touched
  assert.equal(form.f.name.touched(), true);

  form.f.name.set("ok");
  await form.submit(() => [{ path: "name", kind: "server", message: "no" }]);
  assert.deepEqual(
    form.f.name.errors().map((e) => `${e.kind}:${e.message}`),
    ["server:no"],
  );
  form.f.name.set("edited"); // editing clears the server error
  assert.deepEqual(form.f.name.errors(), []);
});
