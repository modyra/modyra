/**
 * `record()` — a collection whose keys are data.
 *
 * The rule under test is that a row exists because it was declared, never because a control mounted.
 * Everything below is a way that rule can break: a key that reads as an index, a control that mounts
 * before its row, a row removed while its controls are still on screen, and validity that would
 * quietly follow the rendering instead of the data.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, group, record } from "../dist/index.js";

const required = (message = "required") => {
  const fn = (value) => (value === null || value === "" ? [message] : []);
  return fn;
};

const rowSchema = () => group({ nome: field(""), qta: field(0) });

test("a record keyed by entity ids reads back as an object, not an array", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("12", { nome: "a", qta: 1 });
  form.f.rows.upsert("34", { nome: "b", qta: 2 });

  const value = form.value().rows;
  assert.equal(Array.isArray(value), false, "an id-keyed record must not become an array");
  assert.deepEqual(Object.keys(value).sort(), ["12", "34"]);
  assert.equal(value["12"].nome, "a");
  assert.equal(value["34"].qta, 2);
});

test("a value written through a cell is read back from the record", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("tmp:1", { nome: "", qta: 0 });

  form.f.rows.cell("tmp:1", "nome").set("Espresso");

  assert.equal(form.value().rows["tmp:1"].nome, "Espresso");
});

test("unmounting a control keeps the value: the row does not depend on what is mounted", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("a", { nome: "kept", qta: 3 });

  // What a renderer does when the cell appears and then goes away.
  form.claimField("rows.a.nome");
  form.removeField("rows.a.nome");

  assert.equal(form.value().rows.a.nome, "kept");
});

test("a control that mounts before its row claims nothing and creates nothing", () => {
  const form = createForm({ rows: record(rowSchema()) });

  const cell = form.f.rows.cell("late", "nome");
  form.claimField("rows.late.nome");

  assert.equal(form.f.rows.has("late"), false);
  assert.deepEqual(form.value().rows, {}, "a mounted control must not declare a row");
  assert.equal(cell.value(), null, "the control renders empty while it waits");
  cell.set("ignored");
  assert.deepEqual(form.value().rows, {}, "writing through a waiting control declares nothing");

  form.f.rows.upsert("late", { nome: "arrived", qta: 1 });

  assert.equal(cell.value(), "arrived", "the waiting control binds when the row is declared");
  assert.equal(form.value().rows.late.nome, "arrived");
});

test("remove() takes the value even while controls are mounted, and they go back to waiting", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("a", { nome: "doomed", qta: 1 });
  const cell = form.f.rows.cell("a", "nome");
  form.claimField("rows.a.nome");

  form.f.rows.remove("a");

  assert.equal(form.f.rows.has("a"), false);
  assert.deepEqual(form.value().rows, {});
  assert.equal(cell.value(), null, "the control empties with the row");
  assert.equal(
    form.fieldNames().some((n) => n.startsWith("rows.a.")),
    false,
    "no field of the removed row survives in the engine",
  );

  form.f.rows.upsert("a", { nome: "fresh", qta: 0 });
  assert.equal(cell.value(), "fresh", "the mounted control binds to the new row");
});

test("re-declaring a key does not leave the previous row's validators attached", () => {
  const form = createForm({
    rows: record(group({ nome: field("", [required()]) })),
  });
  form.f.rows.upsert("a", { nome: "" });
  assert.equal(form.state.valid(), false);

  form.f.rows.remove("a");
  assert.equal(form.state.valid(), true, "a removed row stops being a reason to be invalid");

  form.f.rows.upsert("a", { nome: "filled" });
  assert.equal(form.state.valid(), true);
});

test("patch writes several rows in one call and leaves the others alone", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.setAll({
    a: { nome: "a", qta: 1 },
    b: { nome: "b", qta: 2 },
    c: { nome: "c", qta: 3 },
  });

  form.f.rows.patch({ a: { qta: 10 }, b: { nome: "bee" } });

  assert.equal(form.value().rows.a.qta, 10);
  assert.equal(form.value().rows.a.nome, "a", "an untouched field of a patched row is kept");
  assert.equal(form.value().rows.b.nome, "bee");
  assert.deepEqual(form.value().rows.c, { nome: "c", qta: 3 }, "an unnamed row is untouched");
});

test("a required cell makes the form invalid, however few controls are mounted", () => {
  const form = createForm({
    rows: record(group({ nome: field("", [required()]) })),
  });

  form.f.rows.upsert("a", { nome: "" });

  assert.equal(form.state.valid(), false, "a declared row with an empty required cell is invalid");
  assert.equal(form.f.rows.validOf("a"), false);

  // Nothing is mounted here at all — validity is the row's, not the rendering's.
  form.f.rows.cell("a", "nome").set("filled");
  assert.equal(form.state.valid(), true);
  assert.equal(form.f.rows.validOf("a"), true);
});

test("mounting and unmounting controls never changes the form's validity", () => {
  const form = createForm({
    rows: record(group({ nome: field("", [required()]) })),
  });
  form.f.rows.upsert("a", { nome: "" });
  assert.equal(form.state.valid(), false);

  // A sort, a filter, a row leaving edit mode: controls come and go for reasons of their own.
  form.claimField("rows.a.nome");
  assert.equal(form.state.valid(), false);
  form.removeField("rows.a.nome");
  assert.equal(form.state.valid(), false, "a row nobody renders is still invalid");
});

test("cell() answers with the same handle across upsert, remove and upsert", () => {
  const form = createForm({ rows: record(rowSchema()) });

  const first = form.f.rows.cell("a", "nome");
  assert.equal(form.f.rows.cell("a", "nome"), first, "two asks, one handle");

  form.f.rows.upsert("a", { nome: "x", qta: 0 });
  assert.equal(form.f.rows.cell("a", "nome"), first);
  form.f.rows.remove("a");
  assert.equal(form.f.rows.cell("a", "nome"), first);
  form.f.rows.upsert("a", { nome: "y", qta: 0 });
  assert.equal(form.f.rows.cell("a", "nome"), first);
  assert.equal(first.value(), "y", "the same handle now reads the rebuilt row");
});

test("rename carries the value and the state the user produced", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("tmp:1", { nome: "Espresso", qta: 2 });
  form.f.rows.cell("tmp:1", "nome").markAsTouched();

  form.f.rows.rename("tmp:1", "77");

  assert.equal(form.f.rows.has("tmp:1"), false);
  assert.deepEqual(form.value().rows["77"], { nome: "Espresso", qta: 2 });
  assert.equal(form.f.rows.cell("77", "nome").touched(), true, "a visited field stays visited");
});

test("keys arrive in declaration order and follow removal", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("a");
  form.f.rows.upsert("b");
  form.f.rows.upsert("c");
  assert.deepEqual([...form.f.rows.keys()], ["a", "b", "c"]);

  form.f.rows.remove("b");
  assert.deepEqual([...form.f.rows.keys()], ["a", "c"]);
});

test("setValue replaces the collection, reset returns it to what the schema declared", () => {
  const form = createForm({
    rows: record(rowSchema(), { initial: { seed: { nome: "s", qta: 1 } } }),
  });
  assert.deepEqual([...form.f.rows.keys()], ["seed"]);

  form.setValue({ rows: { x: { nome: "x", qta: 9 } } });
  assert.deepEqual([...form.f.rows.keys()], ["x"]);

  form.reset();
  assert.deepEqual([...form.f.rows.keys()], ["seed"]);
  assert.equal(form.value().rows.seed.nome, "s");
});

test("a key that cannot be a path segment is refused, and the form stays up", () => {
  const form = createForm({ rows: record(rowSchema()) });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    form.f.rows.upsert("a.b", { nome: "dotted", qta: 0 });
    form.f.rows.upsert("__proto__", { nome: "polluting", qta: 0 });
    form.f.rows.upsert("", { nome: "empty", qta: 0 });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual([...form.f.rows.keys()], [], "none of the three was declared");
  assert.equal(warnings.length, 3, "each refusal is reported");
  assert.equal(({}).polluting, undefined);
});

test("a record of leaves needs no path to address a cell", () => {
  const form = createForm({ note: record(field("")) });
  form.f.note.upsert("a", "hello");

  assert.equal(form.f.note.cell("a").value(), "hello");
  assert.deepEqual(form.value().note, { a: "hello" });
});

test("a collection inside a row is refused with a message, not a broken path", () => {
  assert.throws(
    () => createForm({ rows: record(group({ inner: record(field("")) })) }),
    /one collection per node/,
  );
});

test("a draft restores the rows it was holding", async () => {
  const store = new Map();
  const storage = {
    read: (key) => (store.has(key) ? store.get(key) : null),
    write: (key, value) => store.set(key, value),
    clear: (key) => store.delete(key),
  };
  const schema = () => ({ rows: record(group({ nome: field(""), qta: field(0) })) });

  const first = createForm(schema(), { draft: { key: "rows-draft", storage, debounceMs: 0 } });
  first.f.rows.upsert("a3f9", { nome: "Espresso", qta: 2 });
  await new Promise((r) => setTimeout(r, 10));

  const restored = createForm(schema(), { draft: { key: "rows-draft", storage, debounceMs: 0 } });
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual([...restored.f.rows.keys()], ["a3f9"], "the row came back with the draft");
  assert.equal(restored.value().rows.a3f9.nome, "Espresso");
});

test("undo steps a row's value back without losing the row", async () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const form = createForm(
    { rows: record(group({ nome: field(""), qta: field(0) })) },
    { history: true },
  );
  form.f.rows.upsert("a", { nome: "first", qta: 1 });
  await tick(); // the snapshot history steps back to
  form.f.rows.cell("a", "nome").set("second");
  await tick(); // recorded

  form.undo();

  assert.equal(form.f.rows.has("a"), true, "the row is not lost by stepping back");
  assert.equal(form.value().rows.a.nome, "first");
});
