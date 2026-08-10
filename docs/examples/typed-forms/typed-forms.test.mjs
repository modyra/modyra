// Runs the snippets in docs/guides/typed-forms.md against the built engine.
//
// The guide is the longest page a reader works through with an editor open, so a method that was
// renamed costs more here than anywhere else. Two of its snippets called `mdyRequired()`, which is
// an adapter's alias and not something `@modyra/core` exports — this is what would have said so.
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  createForm, field, group, array, record,
  required, email, min, minLength,
  serverValidator,
} = await import("@modyra/core");

test("the opening example", async () => {
  const form = createForm({
    email: field("", [required(), email()]),
    age: field(null, [min(18)]),
    address: group({ city: field("Rome"), zip: field("") }),
  });

  form.f.email.set("ada@example.com");
  assert.equal(form.f.address.city.value(), "Rome");
  assert.equal(form.getValue().address.city, "Rome");
  // Both are documented: getValue() for the plain value, value() for a signal a template can track.
  assert.equal(typeof form.value, "function");
  assert.equal(form.value().address.city, "Rome");

  await form.submit(async () => []);
});

test("model operations behave as the table says", () => {
  const form = createForm({ a: field("x"), b: group({ c: field("y") }) });

  form.setValue({ a: "1", b: { c: "2" } });
  assert.equal(form.getValue().a, "1");

  form.patch({ b: { c: "3" } });
  assert.equal(form.getValue().a, "1", "patch merges, it does not replace");
  assert.equal(form.getValue().b.c, "3");

  form.reset();
  assert.equal(form.getValue().a, "x", "reset returns to the schema initials");
  assert.deepEqual(form.getChanges(), {}, "nothing differs from the initials after a reset");
});

test("a programmatic set does not flip dirty", () => {
  const form = createForm({ a: field("") });
  form.f.a.set("typed by code");
  assert.equal(form.f.a.dirty(), false);
  form.f.a.markAsDirty();
  assert.equal(form.f.a.dirty(), true);
});

test("field arrays expose the documented surface", () => {
  const form = createForm({
    items: array(
      group({ name: field("", [required()]), qty: field(1) }),
      { initial: [{ name: "First", qty: 2 }], validators: [minLength(1)] },
    ),
  });

  assert.equal(form.f.items.length(), 1);
  assert.equal(form.f.items.at(0)?.name.value(), "First");

  form.f.items.push({ name: "", qty: 1 });
  form.f.items.insert(1, { name: "b", qty: 3 });
  form.f.items.move(0, 2);
  form.f.items.remove(0);

  assert.ok(Array.isArray(form.f.items.rows()));
  assert.ok(Array.isArray(form.f.items.errors()));
  assert.ok(Array.isArray(form.getValue().items));
});

test("an array of leaves gives plain field handles", () => {
  const form = createForm({ tags: array(field("")) });
  form.f.tags.push("a");
  assert.equal(typeof form.f.tags.at(0)?.set, "function");
  assert.equal(form.f.tags.at(0)?.value(), "a");
});

test("a record row exists because it was declared, not because it is mounted", () => {
  const form = createForm({ rows: record(group({ name: field(""), qty: field(0, [min(1)]) })) });

  // A cell for a key that does not exist yet is handed out and stays inert.
  const waiting = form.f.rows.cell("a3f9", "name");
  assert.equal(form.f.rows.has("a3f9"), false);

  form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });
  assert.equal(form.f.rows.has("a3f9"), true);
  form.f.rows.cell("a3f9", "name").set("Ristretto");
  assert.deepEqual(form.getValue().rows, { a3f9: { name: "Ristretto", qty: 2 } });

  // The same handle across upsert/remove/upsert, which is what lets a renderer hold it.
  assert.equal(form.f.rows.cell("a3f9", "name"), waiting);

  assert.deepEqual([...form.f.rows.keys()], ["a3f9"]);
  assert.equal(typeof form.f.rows.validOf("a3f9"), "boolean");
});

test("upsert rewrites a row, patch merges into it", () => {
  const form = createForm({ rows: record(group({ name: field("n"), qty: field(7) })) });

  form.f.rows.upsert("k", { name: "A", qty: 1 });
  form.f.rows.upsert("k", { name: "B" });
  assert.equal(form.getValue().rows.k.qty, 7, "a field the value omits goes back to its initial");

  form.f.rows.upsert("k", { name: "C", qty: 5 });
  form.f.rows.patch({ k: { name: "D" } });
  assert.equal(form.getValue().rows.k.qty, 5, "patch leaves the other fields alone");
});

test("setAll declares exactly what it is given, and {} empties deliberately", () => {
  const form = createForm({ rows: record(field("")) });
  form.f.rows.setAll({ a: "1", b: "2" });
  assert.deepEqual([...form.f.rows.keys()].sort(), ["a", "b"]);
  form.f.rows.setAll({});
  assert.deepEqual([...form.f.rows.keys()], []);
});

test("rename carries the value to the new key", () => {
  const form = createForm({ rows: record(group({ name: field("") })) });
  form.f.rows.upsert("tmp:1", { name: "Espresso" });
  form.f.rows.rename("tmp:1", "4711");
  assert.equal(form.f.rows.has("tmp:1"), false);
  assert.equal(form.getValue().rows["4711"].name, "Espresso");
});

test("a numeric-looking key stays a key, and a record stays a record", () => {
  const form = createForm({ rows: record(field("")) });
  form.f.rows.upsert("12", "twelve");
  assert.equal(Array.isArray(form.getValue().rows), false);
  assert.equal(form.getValue().rows["12"], "twelve");
});

test("history options and mutate coalescing", () => {
  const form = createForm(
    { firstName: field(""), lastName: field("") },
    { history: { maxEntries: 100, debounceMs: 0 } },
  );

  form.mutate(() => {
    form.f.firstName.set("Lorenzo");
    form.f.lastName.set("Muscherà");
  });

  form.undo();
  assert.equal(form.getValue().firstName, "", "one entry for the whole mutate");
  assert.equal(form.getValue().lastName, "");
  assert.equal(typeof form.canUndo(), "boolean");
});

test("construction and activation are separable", () => {
  const form = createForm({ a: field("") }, { autoActivate: false });
  assert.equal(typeof form.activate, "function");
  assert.equal(typeof form.deactivate, "function");
  // Documented as idempotent and safe in any order.
  form.activate();
  form.activate();
  form.deactivate();
  form.deactivate();
  form.activate();
  assert.equal(form.getValue().a, "");
});

test("the draft surface exists and a pristine form writes nothing", () => {
  const form = createForm({ a: field("") }, {
    draft: { key: "signup", exclude: ["password"], ttlMs: 86_400_000, version: 1, debounceMs: 400 },
  });
  assert.equal(typeof form.hasDraft, "function");
  assert.equal(typeof form.clearDraft, "function");
  assert.equal(form.hasDraft(), false, "a pristine form restored no draft");
});

test("an async validator reads a sibling through its context", async () => {
  let seen = null;
  const form = createForm({
    country: field("IT"),
    phone: field("", [required()], serverValidator(
      async (phone, ctx) => {
        seen = ctx.form.fieldValue("country");
        return null;
      },
      { dependsOn: ["country"], debounceMs: 0, timeoutMs: 5_000, when: (v) => v.length > 2 },
    )),
  });

  form.f.phone.set("12345");
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(seen, "IT", "ctx.form.fieldValue reads the rest of the form");
});
