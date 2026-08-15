import assert from "node:assert/strict";
import { test } from "node:test";

import { createForm, field, group, record } from "../dist/index.js";

test("a secret inside a collection can be kept out of a draft", async () => {
  // The guide's own instruction is "always exclude passwords, card numbers, tokens" — and a card
  // number lives in a list, whose row keys are data. Only the spelling nobody can write in advance
  // worked, so a consumer following the instruction correctly still persisted the secret.
  const PAN = "4111111111111111";
  const written = new Map();
  const storage = {
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };

  const storedWith = async (exclude) => {
    written.clear();
    const form = createForm(
      { holder: field(""), cards: record(group({ pan: field(""), label: field("") })) },
      { draft: { key: "k", storage, exclude, debounceMs: 5 }, devWarnings: false },
    );
    form.f.holder.set("Ada");
    form.f.cards.upsert("a", { pan: PAN, label: "personal" });
    await new Promise((resolve) => setTimeout(resolve, 80));
    form.destroy();
    return written.get("k") ?? "";
  };

  // Every way a consumer writes the same intent.
  for (const exclude of [["cards"], ["cards.*.pan"], ["pan"], ["cards.a.pan"]]) {
    const raw = await storedWith(exclude);
    assert.ok(!raw.includes(PAN), `excluding ${JSON.stringify(exclude)} left the card number in storage`);
  }

  // The control, twice over: without an exclusion the number *is* written — so the assertions above
  // are the exclusion and not a draft that never saved anything — and what the exclusion does not
  // name is still saved, so a repair that persisted nothing would fail here.
  const bare = await storedWith([]);
  assert.ok(bare.includes(PAN), "nothing was persisted at all, so nothing above was measured");
  const narrow = await storedWith(["pan"]);
  assert.ok(narrow.includes("personal"), "excluding the secret took the rest of the row with it");
  assert.ok(narrow.includes("Ada"), "excluding a cell name emptied the whole draft");
});

test("the storage a browser already has is taken as it is", async () => {
  // The guide names `localStorage` as the default, so a consumer wanting a different key prefix or a
  // session instead of a local reaches for the platform's own object. It speaks
  // getItem/setItem/removeItem; this package speaks read/write/remove, and the mismatch used to
  // surface as `this._storage.read is not a function` — a private field, from inside the engine,
  // about an argument the caller passed.
  const held = new Map();
  const web = {
    getItem: (key) => (held.has(key) ? held.get(key) : null),
    setItem: (key, value) => held.set(key, String(value)),
    removeItem: (key) => held.delete(key),
  };

  const form = createForm({ who: field("") }, { draft: { key: "k", storage: web, debounceMs: 5 }, devWarnings: false });
  form.f.who.set("typed");
  await new Promise((resolve) => setTimeout(resolve, 80));
  form.destroy();
  assert.ok(String(held.get("k")).includes("typed"), "a Web Storage did not receive the draft");

  // And it is read back through the same door.
  const restored = createForm({ who: field("") }, { draft: { key: "k", storage: web, debounceMs: 5 }, devWarnings: false });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(restored.f.who.value(), "typed");
  restored.destroy();

  // A shape neither this package nor the platform uses is refused where it arrives, naming what was
  // expected — rather than throwing later about a member the caller never wrote.
  assert.throws(
    () => createForm({ who: field("") }, { draft: { key: "k", storage: { save() {} } }, devWarnings: false }),
    /draft\.storage must be \{ read, write, remove \}/,
  );
});
