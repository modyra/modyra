/**
 * Typed field arrays: structure follows value, rebuild-on-structure-change,
 * array-level validation, reset, history/draft integration (see A.3/A.6 in
 * the "Field arrays"
 * section of docs/guides/typed-forms.md for the documented v1 semantics).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  array,
  createForm,
  field,
  group,
  minLength,
  required,
  vanillaReactivity,
} from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function orderForm(extra) {
  return createForm(
    {
      items: array(
        group({
          name: field("", [required()]),
          qty: field(1),
        }),
        { initial: [{ name: "First", qty: 2 }] },
      ),
    },
    extra,
  );
}

test("array(group): initial value is a real Array, rows built from schema initial", () => {
  const form = orderForm();
  const value = form.getValue();
  assert.equal(Array.isArray(value.items), true);
  assert.deepEqual(value.items, [{ name: "First", qty: 2 }]);
  assert.equal(form.f.items.length(), 1);
  assert.equal(form.f.items.rows().length, 1);
  assert.equal(form.f.items.rows()[0].name.value(), "First");
});

test("push/insert register new rows with active validators", () => {
  const form = orderForm();
  form.f.items.push({ name: "", qty: 1 }); // empty name -> required() fails
  assert.equal(form.f.items.length(), 2);
  assert.equal(form.state.valid(), false);
  assert.equal(form.f.items.rows()[1].name.errors().length > 0, true);

  form.f.items.insert(0, { name: "Zeroth", qty: 5 });
  assert.equal(form.f.items.length(), 3);
  assert.equal(form.f.items.rows()[0].name.value(), "Zeroth");
  assert.equal(form.f.items.rows()[1].name.value(), "First");
});

test("remove deletes the row's value and its fields from the engine", () => {
  const form = orderForm();
  form.f.items.push({ name: "Second", qty: 3 });
  assert.equal(form.f.items.length(), 2);

  form.f.items.remove(0);
  assert.equal(form.f.items.length(), 1);
  assert.deepEqual(form.getValue().items, [{ name: "Second", qty: 3 }]);
  assert.equal(
    form.fieldNames().some((n) => n.startsWith("items.1.")),
    false,
  );
});

test("move swaps row order", () => {
  const form = orderForm();
  form.f.items.push({ name: "Second", qty: 3 });
  form.f.items.push({ name: "Third", qty: 4 });
  form.f.items.move(0, 2);
  assert.deepEqual(
    form.getValue().items.map((r) => r.name),
    ["Second", "Third", "First"],
  );
});

test("array-level validators gate state.valid and surface on errorsFor(path)", () => {
  const form = createForm({
    items: array(group({ name: field("") }), {
      initial: [],
      validators: [minLength(1)],
    }),
  });
  assert.equal(form.state.valid(), false);
  assert.equal(form.errorsFor("items")().length > 0, true);
  assert.equal(form.f.items.errors().length > 0, true);
  assert.equal(form.f.items.valid(), false);

  form.f.items.push({ name: "x" });
  assert.equal(form.f.items.valid(), true);
  assert.equal(form.state.valid(), true);
});

test("reset() restores array structure to the schema's initial rows", () => {
  const form = orderForm();
  form.f.items.push({ name: "Second", qty: 3 });
  form.f.items.push({ name: "Third", qty: 4 });
  assert.equal(form.f.items.length(), 3);

  form.reset();
  assert.equal(form.f.items.length(), 1);
  assert.deepEqual(form.getValue().items, [{ name: "First", qty: 2 }]);
});

test("setValue()/patch() replace array rows wholesale", () => {
  const form = orderForm();
  form.setValue({ items: [{ name: "A", qty: 1 }, { name: "B", qty: 2 }] });
  assert.equal(form.f.items.length(), 2);
  assert.deepEqual(form.getValue().items, [
    { name: "A", qty: 1 },
    { name: "B", qty: 2 },
  ]);

  form.patch({ items: [{ name: "C", qty: 9 }] });
  assert.equal(form.f.items.length(), 1);
  assert.deepEqual(form.getValue().items, [{ name: "C", qty: 9 }]);
});

test("history: undo/redo restores values written inside array rows", async () => {
  const form = orderForm({ history: true });
  await tick(); // seed initial snapshot
  form.f.items.push({ name: "Second", qty: 3 });
  await tick();
  form.f.items.rows()[0].name.set("First (edited)");
  await tick();

  assert.equal(form.canUndo(), true);
  form.undo();
  assert.equal(form.f.items.rows()[0].name.value(), "First");

  form.redo();
  assert.equal(form.f.items.rows()[0].name.value(), "First (edited)");
});

test("draft: rows introduced by a raw restored patch are reconciled with validators", async () => {
  const store = new Map();
  const storage = {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
  store.set(
    "order-draft",
    JSON.stringify({
      "items.0.name": "First",
      "items.0.qty": 2,
      "items.1.name": "",
      "items.1.qty": 5,
    }),
  );

  const form = orderForm({ draft: { key: "order-draft", storage } });
  await tick(); // reconciliation effect absorbs the restored row

  assert.equal(form.f.items.length(), 2);
  assert.deepEqual(form.getValue().items, [
    { name: "First", qty: 2 },
    { name: "", qty: 5 },
  ]);
  // The absorbed row's validators are live, not just its value.
  assert.equal(form.f.items.rows()[1].name.errors().length > 0, true);
  assert.equal(form.state.valid(), false);
});

test("async validators on array item fields keep dependsOn wiring", async () => {
  let calls = 0;
  const form = createForm({
    items: array(
      group({
        name: field("", [], {
          asyncValidators: [
            async (v, ctx) => {
              calls++;
              const first = ctx.form.fieldValue("items.0.name");
              return v !== "items.0.name" && first === "taken" ? ["Duplicate"] : [];
            },
          ],
          asyncDependsOn: ["items.0.name"],
        }),
      }),
      { initial: [{ name: "a" }, { name: "b" }] },
    ),
  });
  await tick();
  const callsAfterInitial = calls;

  form.f.items.rows()[0].name.set("taken");
  await tick();
  await tick();

  assert.equal(calls > callsAfterInitial, true);
});

/**
 * A row handle after a reorder.
 *
 * A structural change destroys every row's fields and registers them again. `rows()` is recomputed
 * from the row count, so an operation that keeps the count — `move` above all — used to hand back
 * the same handle objects, still pointing at records the engine had already destroyed.
 *
 * The consequence was not cosmetic. The arrangement the guide shows binds `rows()[i]` to a control,
 * so after a drag the control displayed the value the row held **before** the move, and what the
 * user typed into it went into a destroyed record — silently, with the model unchanged.
 */
test("a row handle follows the reorder rather than the record it was born with", () => {
  const form = createForm({ items: array(group({ name: field("") })) });
  form.f.items.push({ name: "a" });
  form.f.items.push({ name: "b" });

  // What a renderer holds: the handles from before the structural change.
  const held = form.f.items.rows();
  held[0].name.markAsTouched();

  form.f.items.move(0, 1);

  assert.equal(form.getValue().items[0].name, "b", "the value moved");
  assert.equal(held[0].name.value(), "b", "and the handle reads the row now at that index");
  assert.equal(
    held[0].name.touched(),
    false,
    "with that row's own flags, not the ones left by the row that used to be here",
  );

  held[0].name.set("typed after the drag");
  assert.equal(
    form.getValue().items[0].name,
    "typed after the drag",
    "and a write through it reaches the model",
  );
});

test("a structural change resets the flags of the rows it moves", () => {
  const form = createForm({ items: array(group({ name: field("") })) });
  for (const name of ["a", "b", "c"]) form.f.items.push({ name });

  form.f.items.rows()[0].name.markAsTouched();
  form.f.items.rows()[2].name.markAsDirty();

  form.f.items.move(0, 1);

  const flags = form.f.items.rows().map((row) => [row.name.touched(), row.name.dirty()]);
  assert.deepEqual(
    flags,
    [[false, false], [false, false], [false, false]],
    "the documented v1 semantics: what a structural change rebuilds, it rebuilds clean",
  );
});

test("insert and remove keep answering the same way", () => {
  const form = createForm({ items: array(group({ name: field("") })) });
  form.f.items.push({ name: "a" });
  form.f.items.push({ name: "b" });
  form.f.items.rows()[1].name.markAsTouched();

  form.f.items.insert(0, { name: "z" });
  assert.deepEqual(form.getValue().items.map((r) => r.name), ["z", "a", "b"]);
  assert.equal(form.f.items.rows()[2].name.touched(), false, "rebuilt clean, like move");

  form.f.items.remove(0);
  assert.deepEqual(form.getValue().items.map((r) => r.name), ["a", "b"]);
  assert.equal(form.f.items.rows()[0].name.value(), "a", "and the handles read the surviving rows");
});

test("undo of a push takes the row with it, and redo brings it back whole", async () => {
  // A whole-value write states which rows there are, and the engine writes flat paths: a field the
  // write does not mention is set to null, never removed. Read as growth-only, that left an empty
  // row behind after every undo — and, because the restored value then differed from the snapshot
  // that was asked for, the history recorded it as a fresh edit and the redo stack went with it.
  const form = createForm(
    { rows: array(group({ n: field("") }), { initial: [{ n: "a" }] }) },
    { history: { debounceMs: 1 } },
  );
  await tick();

  form.f.rows.push({ n: "b" });
  await tick();
  assert.equal(form.f.rows.length(), 2);

  form.undo();
  await tick();
  assert.deepEqual(form.getValue().rows, [{ n: "a" }], "the pushed row outlived its undo");
  assert.equal(form.f.rows.length(), 1);
  assert.equal(form.canRedo(), true, "the redo stack was cleared by the restore itself");

  form.redo();
  await tick();
  assert.deepEqual(form.getValue().rows, [{ n: "a" }, { n: "b" }], "redo lost what the row held");
});

test("undo of an insert and of a lengthening setAll leave the array as it was", async () => {
  const form = createForm(
    { rows: array(group({ n: field("") }), { initial: [{ n: "a" }] }) },
    { history: { debounceMs: 1 } },
  );
  await tick();

  form.f.rows.insert(0, { n: "z" });
  await tick();
  form.undo();
  await tick();
  assert.deepEqual(form.getValue().rows, [{ n: "a" }], "an undone insert left a row behind");

  form.f.rows.setAll([{ n: "x" }, { n: "y" }]);
  await tick();
  form.undo();
  await tick();
  assert.deepEqual(form.getValue().rows, [{ n: "a" }], "an undone setAll left a row behind");
});

test("a draft written after a deletion does not bring the row back", async () => {
  // The engine's restoreValue already promised this in words: a row the user removed before the
  // snapshot was written stays removed. A keyed collection kept the promise; an indexed one could
  // only grow, so the deleted row returned carrying its seeded value — real data the user could
  // submit without noticing.
  const store = new Map();
  const storage = {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
  const seeded = () => ({
    rows: array(group({ n: field("") }), { initial: [{ n: "a" }, { n: "b" }] }),
  });

  const first = createForm(seeded(), { draft: { key: "d", storage, debounceMs: 1 } });
  first.f.rows.remove(1);
  await tick();
  await tick();

  const restored = createForm(seeded(), { draft: { key: "d", storage, debounceMs: 1 } });
  await tick();
  assert.deepEqual(restored.getValue().rows, [{ n: "a" }], "the deleted row came back");
  assert.equal(restored.f.rows.length(), 1);
});

test("a partial write prunes nothing: only a whole value states which rows exist", async () => {
  // The risk of reading absence as deletion is reading it everywhere. A draft that excludes a field,
  // a patch that names one, a cell that is typed into — none of them say anything about how many
  // rows there are.
  const store = new Map();
  const storage = {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
  const schema = () => ({
    secret: field(""),
    rows: array(group({ n: field("") }), { initial: [{ n: "a" }, { n: "b" }] }),
  });

  const first = createForm(schema(), {
    draft: { key: "e", storage, debounceMs: 1, exclude: ["secret"] },
  });
  first.f.secret.set("hidden");
  first.f.rows.rows()[1].n.set("edited");
  await tick();
  await tick();

  const restored = createForm(schema(), {
    draft: { key: "e", storage, debounceMs: 1, exclude: ["secret"] },
  });
  await tick();
  assert.deepEqual(
    restored.getValue().rows,
    [{ n: "a" }, { n: "edited" }],
    "an excluded key made the restore look like a shorter array",
  );

  const patched = createForm(schema());
  patched.patch({ secret: "x" });
  assert.equal(patched.f.rows.length(), 2, "a patch elsewhere pruned rows");

  patched.f.rows.rows()[0].n.set("typed");
  assert.equal(patched.f.rows.length(), 2, "typing into a cell pruned rows");
});

/**
 * A patch that says nothing does not say "delete everything".
 *
 * `patch({ items: response.items })` where the response omitted the list hands the form an
 * `undefined`; a `null` arrives the same way. A value that is not an array says nothing about rows —
 * the array manager has always read it that way for whole-value writes, and the keyed collection
 * beside it ignores a member of the wrong shape too. Only this path turned it into an empty array.
 */
test("a patch member that is not an array leaves the rows alone", () => {
  for (const malformed of [null, undefined, {}, "nonsense", 7]) {
    const form = orderForm();
    form.f.items.setAll([{ name: "First", qty: 1 }, { name: "Second", qty: 2 }]);

    form.patch({ items: malformed });

    assert.equal(form.f.items.length(), 2, `patching with ${JSON.stringify(malformed) ?? "undefined"} kept the rows`);
    assert.deepEqual(form.getValue().items, [
      { name: "First", qty: 1 },
      { name: "Second", qty: 2 },
    ]);
  }
});

test("a patch member that is an array still replaces the rows", () => {
  const form = orderForm();
  form.f.items.setAll([{ name: "First", qty: 1 }, { name: "Second", qty: 2 }]);

  form.patch({ items: [{ name: "Only", qty: 9 }] });

  assert.equal(form.f.items.length(), 1);
  assert.deepEqual(form.getValue().items, [{ name: "Only", qty: 9 }]);
});

/**
 * A structural change resets the rows it moves, and only those.
 *
 * Rebuilding every row on every call cost more than flags: a control bound to a row that nothing
 * moved lost its claim and, with it, what a binder had said about the cell — a disabled column came
 * back enabled and was submitted. Rows that survive a change are now written in place, and only the
 * ones the change moved are marked clean.
 */
test("appending a row leaves the marks and bindings of the rows above it", () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { items: array(group({ name: field(""), qty: field(0) })) },
    { reactivity: rx },
  );
  form.f.items.push({ name: "first", qty: 1 });
  form.f.items.at(0).name.markAsTouched();
  form.setDisabled("items.0.qty", rx.signal(true));

  form.f.items.push({ name: "second", qty: 2 });

  assert.equal(form.f.items.at(0).name.touched(), true, "a row nothing moved keeps its marks");
  assert.equal(form.getField("items.0.qty")().disabled(), true, "and what a binder said about it");
  assert.deepEqual(form.submitValue().items[0], { name: "first" }, "so the disabled cell stays unsent");
  assert.equal(form.f.items.at(1).name.touched(), false, "the new row arrives clean");
});

test("removing an index the list does not have changes nothing", () => {
  const form = createForm({ items: array(group({ name: field("") })) });
  form.f.items.push({ name: "only" });
  form.f.items.at(0).name.markAsTouched();

  form.f.items.remove(9);

  assert.equal(form.f.items.length(), 1);
  assert.equal(form.f.items.at(0).name.touched(), true);
});

test("inserting at the front resets every row it moved", () => {
  const form = createForm({ items: array(group({ name: field("") })) });
  for (const name of ["a", "b"]) form.f.items.push({ name });
  form.f.items.at(0).name.markAsTouched();
  form.f.items.at(1).name.markAsDirty();

  form.f.items.insert(0, { name: "z" });

  assert.deepEqual(form.getValue().items.map((row) => row.name), ["z", "a", "b"]);
  assert.deepEqual(
    form.f.items.rows().map((row) => [row.name.touched(), row.name.dirty()]),
    [[false, false], [false, false], [false, false]],
  );
});
