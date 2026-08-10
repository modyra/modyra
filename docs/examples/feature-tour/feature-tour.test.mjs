// Runs every snippet in docs/feature-tour.md against the built engine.
//
// The tour is the page most readers meet first, and its snippets are the ones most likely to be
// copied without being read closely — so an API that is renamed, or a method that never existed,
// costs a reader their first ten minutes. Two of these snippets were wrong when the page was
// written (`removeAt` for an array, `history` used without being enabled), and this is what said so.
//
// Each test names the section it proves, so a failure points at the paragraph to correct.
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  createForm, field, group, array, record,
  required, email, min, minLength, maxLength, pattern,
  crossField, serverValidator,
} = await import("@modyra/core");

test("Structure — fields", () => {
  const form = createForm({
    name: field("", [required()]),
    age: field(null, [min(18)]),
    contact: field("", [required(), email()]),
  });

  form.f.name.set("Ada");
  assert.deepEqual(form.f.name.errors(), []);

  for (const member of ["value", "errors", "valid", "touched", "dirty", "pending", "required", "disabled", "readonly"]) {
    assert.equal(typeof form.f.name[member], "function", `handle.${member} is documented as a signal`);
  }
  for (const method of ["set", "markAsTouched", "markAsDirty"]) {
    assert.equal(typeof form.f.name[method], "function", `handle.${method} is documented`);
  }
});

test("Structure — groups keep their types through nesting", () => {
  const form = createForm({
    shipping: group({
      city: field("Rome"),
      zip: field(""),
      coords: group({ lat: field(0), lng: field(0) }),
    }),
  });

  form.f.shipping.coords.lat.set(41.9);
  assert.equal(form.getValue().shipping.city, "Rome");
  assert.equal(form.getValue().shipping.coords.lat, 41.9);
});

test("Structure — arrays address rows by position", () => {
  const form = createForm({
    items: array(group({ sku: field("", [required()]), qty: field(1) })),
  });

  form.f.items.push({ sku: "A-1", qty: 2 });
  form.f.items.insert(0, { sku: "A-0", qty: 1 });
  form.f.items.move(0, 1);
  form.f.items.remove(1);

  assert.equal(form.f.items.length(), 1);
  assert.equal(typeof form.f.items.rows()[0].sku.value(), "string");
});

test("Structure — records address rows by key, and a key survives renaming", () => {
  const form = createForm({
    lines: record(group({ label: field("", [required()]), qty: field(0) })),
  });

  form.f.lines.upsert("espresso", { label: "Espresso", qty: 2 });
  form.f.lines.upsert("cornetto", { label: "Cornetto", qty: 0 });
  form.f.lines.rename("espresso", "double-espresso");
  form.f.lines.remove("cornetto");

  assert.deepEqual([...form.f.lines.keys()], ["double-espresso"]);
  // The claim the page makes about records: the value follows the key, not the position.
  assert.equal(form.f.lines.row("double-espresso").qty.value(), 2);
  assert.equal(form.f.lines.cell("double-espresso", "qty").value(), 2);
});

test("Validation — synchronous", () => {
  const form = createForm({
    username: field("", [required(), minLength(3), maxLength(20)]),
    code: field("", [pattern(/^[A-Z]{2}-\d{4}$/)]),
  });

  form.f.username.set("ab");
  assert.ok(form.f.username.errors().length > 0);
  form.f.code.set("IT-1234");
  assert.deepEqual(form.f.code.errors(), []);
});

test("Validation — across fields", () => {
  const form = createForm(
    { password: field(""), confirm: field("") },
    {
      validators: [
        crossField(["password", "confirm"], (v) =>
          v.password === v.confirm ? null : "Passwords do not match"),
      ],
    },
  );

  form.f.password.set("a");
  form.f.confirm.set("b");
  assert.ok(form.f.password.errors().length > 0);
});

test("Validation — an async validator declares its dependencies", () => {
  const form = createForm({
    country: field("IT"),
    coupon: field("", [], serverValidator(
      async (code) => (code === "OK" ? null : "no"),
      { dependsOn: ["country"], debounceMs: 1, timeoutMs: 500 },
    )),
  });

  assert.equal(typeof form.f.coupon.pending(), "boolean");
});

test("Beyond validation — undo and redo, once history is enabled", () => {
  const form = createForm(
    { a: field(0), b: field(0), c: field(0) },
    { history: true },
  );

  form.mutate(() => {
    form.f.a.set(1);
    form.f.b.set(2);
    form.f.c.set(3);
  });
  assert.equal(form.getValue().a, 1);

  // One entry for the whole mutate, which is what the page claims about it.
  form.undo();
  assert.equal(form.getValue().a, 0);
  assert.equal(form.getValue().c, 0);

  form.redo();
  assert.equal(form.getValue().a, 1);
  assert.equal(typeof form.canUndo(), "boolean");
});

test("Beyond validation — changes, submission and unmatched server errors", async () => {
  const form = createForm({ a: field(0), b: field(0) });
  form.f.a.set(1);
  assert.ok(Object.keys(form.getChanges()).length > 0);

  await form.submit(async () => []);
  assert.equal(typeof form.state.canSubmit(), "boolean");
  assert.ok(Array.isArray(form.errorsFor("")()));
});

test("Beyond validation — the draft and security options are accepted as documented", () => {
  createForm({ x: field("") }, {
    security: { sanitize: "text", maxValueLength: 5_000, onViolation: () => {} },
  });
  createForm({ x: field("") }, {
    draft: { key: "checkout", ttlMs: 86_400_000, exclude: ["card"], version: 2 },
  });
});
