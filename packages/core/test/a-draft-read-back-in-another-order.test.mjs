/**
 * A stored choice is recognised by what it holds, not by how its text was spelled.
 *
 * A field that declares its options accepts from storage only a value one of them holds: the list is
 * what tells a legitimate object from a hostile one. JSON text follows key order, and a draft can come
 * back with its keys in another order — written by another runtime, edited by hand, passed through a
 * service. Read back that way it is still the same value, and it is restored rather than dropped. The
 * comparison is the validator's own, so a value restored here is one `oneOf` accepts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../dist/index.js";

function memoryStorage() {
  const data = new Map();
  return {
    data,
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

const draft = (value) => JSON.stringify({ __mdyDraft: 1, savedAt: Date.now(), value });

const CITIES = [{ id: 1, name: "Roma" }, { id: 2, name: "Milano" }];

function restored(storedCity) {
  const storage = memoryStorage();
  storage.data.set("d", draft({ city: storedCity }));
  const violations = [];
  const form = createForm(
    { city: field(null, [], { shape: "option", options: CITIES }) },
    { draft: { key: "d", storage }, security: { onViolation: (v) => violations.push(v) } },
  );
  return { value: form.f.city.value(), violations: violations.map((v) => v.kind) };
}

test("an offered option stored with its keys in another order is restored", () => {
  assert.deepEqual(restored({ name: "Milano", id: 2 }), { value: { name: "Milano", id: 2 }, violations: [] });
});

test("a value no option holds is still dropped", () => {
  // The control: a comparison that accepted any object would pass the case above as well.
  const outcome = restored({ id: 3, name: "Napoli" });
  assert.equal(outcome.value, null);
  assert.deepEqual(outcome.violations, ["draft-shape"]);
});
