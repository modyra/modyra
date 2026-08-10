// Runs the snippets in docs/guides/typed-forms.md against the built engine.
//
// The guide is the longest page a reader works through with an editor open, so a method that was
// renamed costs more here than anywhere else. Two of its snippets called `mdyRequired()`, which is
// an adapter's alias and not something `@modyra/core` exports — this is what would have said so.
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  createForm, field, group, array, record,
  required, email, min, max, minLength, integer, compose,
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

test("the conditional field and section the guide shows", () => {
  const form = createForm({
    kind: field("simple"),
    reason: field("", [required()], { when: (_value, form) => form["kind"] === "detailed" }),
  });

  assert.equal(form.state.valid(), true);
  form.f.kind.set("detailed");
  assert.equal(form.state.valid(), false);
  form.f.reason.set("because");
  assert.equal(form.state.valid(), true);

  // The table under "What inactive means", line by line.
  form.f.kind.set("simple");
  assert.equal(form.f.reason.interactivity(), "disabled");
  assert.equal(form.f.reason.disabled(), true);
  assert.equal(form.getValue().reason, "because", "the value is kept");
  assert.equal("reason" in form.submitValue(), false, "and not submitted");
  assert.equal(form.state.valid(), true);
});

test("a whole section, and the composition the guide promises", () => {
  const form = createForm({
    kind: field("private"),
    wantsInvoice: field(false),
    company: group(
      {
        name: field("", [required()]),
        invoiceEmail: field("", [required()], {
          when: (_value, form) => form["wantsInvoice"] === true,
        }),
      },
      { when: (_section, form) => form["kind"] === "company" },
    ),
  });

  assert.equal(form.state.valid(), true, "a closed section asks for nothing");
  assert.equal("company" in form.submitValue(), false);

  form.f.kind.set("company");
  assert.equal(form.getField("company.name")().disabled(), false);
  assert.equal(
    form.getField("company.invoiceEmail")().disabled(),
    true,
    "the section is open and the field's own condition is not met — both are consulted",
  );

  form.f.wantsInvoice.set(true);
  assert.equal(form.getField("company.invoiceEmail")().disabled(), false);
});

test("a predicate reads the form in the shape the schema declares", () => {
  const form = createForm({
    address: group({ country: field("IT") }),
    shipping: group({
      note: field("", [required()], { when: (_v, form) => form.address.country === "US" }),
    }),
  });

  assert.equal(form.state.valid(), true);
  form.f.address.country.set("US");
  assert.equal(form.state.valid(), false);
});

test("a bound is declared once, and the guide's traps are real", () => {
  const form = createForm({
    quantity: field(0, [integer(), min(0), max(255)]),
    tightest: field(0, [min(0), max(65535), min(1024), max(49151)]),
    composed: field(0, [compose(integer(), min(0), max(255))]),
    odd: field(0, [min(Number.NaN)]),
  });

  assert.deepEqual(form.getField("quantity")().bounds(), { min: 0, max: 255 });
  assert.deepEqual(
    form.getField("tightest")().bounds(),
    { min: 1024, max: 49151 },
    "where two rules bound the same field, the tightest wins",
  );
  assert.deepEqual(
    form.getField("composed")().bounds(),
    { min: null, max: null },
    "compose() returns one function and its bounds are not readable from outside",
  );
  assert.deepEqual(form.getField("odd")().bounds(), { min: null, max: null }, "not finite, not offered");

  form.f.quantity.set(1.5);
  assert.equal(form.getField("quantity")().valid(), false, "integer() still runs");
});
