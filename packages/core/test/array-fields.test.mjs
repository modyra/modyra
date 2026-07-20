/**
 * Typed field arrays: structure follows value, rebuild-on-structure-change,
 * array-level validation, reset, history/draft integration (see A.3/A.6 in
 * .modyra/piano-consolidamento-killer-features.md and the "Field arrays"
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
