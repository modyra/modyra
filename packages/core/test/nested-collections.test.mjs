/**
 * What a collection does about another collection inside it — today, and what it must do.
 *
 * Two halves. The first fixes the behaviour that exists, including the parts that are defects: a
 * characterization test that blesses nothing, it only makes a change visible. The second is the
 * matrix ADR 0040 commits to, skipped until the phase that answers it, so the work is written down
 * where it will be run rather than in a plan nobody executes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MdyFormEngine, array, createForm, field, group, record, required as mdyRequired, vanillaReactivity } from "../dist/index.js";

const rows = () => group({ sku: field(""), qty: field(0) });

// ── What the refusal does today ────────────────────────────────────────────

test("a nesting the runtime cannot execute is refused when the form is built", () => {
  // Not when a row arrives: a shape the runtime cannot execute must not survive long enough to
  // produce paths that look valid. This is the property the recursion has to keep.
  for (const [name, schema] of [
    ["array in record", { orders: record(group({ lines: array(rows()) })) }],
    ["record in array", { orders: array(group({ lines: record(rows()) })) }],
    ["array in array", { orders: array(group({ lines: array(rows()) })) }],
  ]) {
    // The two managers word it differently — "nested collections … are not supported" against
    // "a record's row cannot contain another record". Asserted as a refusal that names the kind,
    // because pinning either sentence would make a reworded message look like a regression.
    assert.throws(() => createForm(schema), (error) => {
      assert.match(error.message, /^\[modyra\]/, `${name} should be refused by the engine`);
      assert.match(error.message, /record|array/, `${name}'s refusal should name a collection kind`);
      return true;
    }, `${name} should be refused`);
  }
});

test("the refusal names the shape it refused, not the row that reached it", () => {
  try {
    createForm({ orders: array(group({ lines: record(rows()) })) });
    assert.fail("expected a refusal");
  } catch (error) {
    assert.match(String(error.message), /record/, "the message says which kind was nested");
  }
});

test("one level is unaffected, in both directions", () => {
  const form = createForm({ orders: record(rows()), items: array(rows()) });
  form.f.orders.upsert("a", { sku: "S", qty: 1 });
  form.f.items.push({ sku: "T", qty: 2 });
  assert.deepEqual(form.f.orders.keys(), ["a"]);
  assert.equal(form.f.items.rows().length, 1);
  // A record stays an object even where its keys look like indices — the property a nested record
  // under an array must keep, and the reason `array → record` is the hard one.
  form.f.orders.upsert("0", { sku: "Z", qty: 0 });
  assert.equal(Array.isArray(form.getValue().orders), false);
  form.destroy();
});

/**
 * Out of play if any collection above it says no.
 *
 * The engine used to answer from the first gate whose prefix matched, in registration order — so a
 * child registered before its parent admitted paths the closed parent refused. This is the same
 * sentence `conditions.ts` states about sections, over a different set of ancestors.
 */
test("a path is in play only when every collection above it admits it", () => {
  for (const order of ["inner first", "outer first"]) {
    const engine = new MdyFormEngine(vanillaReactivity(), () => undefined, () => "valid-only");
    const closedOuter = ["orders", { isOpen: () => false }];
    const openInner = ["orders.a.lines", { isOpen: () => true }];
    for (const [prefix, gate] of order === "inner first" ? [openInner, closedOuter] : [closedOuter, openInner]) {
      engine.registerPathGate(prefix, gate);
    }

    engine.claimField("orders.a.lines.x");
    assert.equal(engine.peekField("orders.a.lines.x"), null,
      `${order}: the closed parent should refuse the path whatever the registration order`);

    engine.destroy();
  }
});

test("an open parent does not force a closed child open", () => {
  const engine = new MdyFormEngine(vanillaReactivity(), () => undefined, () => "valid-only");
  engine.registerPathGate("orders", { isOpen: () => true });
  engine.registerPathGate("orders.a.lines", { isOpen: () => false });
  engine.claimField("orders.a.lines.x");
  assert.equal(engine.peekField("orders.a.lines.x"), null, "the inner refusal still holds");
  // A sibling the inner gate does not cover is unaffected: composition narrows, it does not spread.
  engine.claimField("orders.a.customer");
  assert.notEqual(engine.peekField("orders.a.customer"), null, "a path only the open gate covers is in play");
  engine.destroy();
});

// ── The matrix ADR 0040 commits to ─────────────────────────────────────────
//
// Each of these is a claim the phase named beside it must make true. They are skipped rather than
// absent so the suite is the work list, and an implementation that forgets one leaves a skip behind
// where a reviewer looks.

const phase = (name, fn) => test(name, { skip: "phase not implemented yet" }, fn);

phase("record → array: rows push and move inside one parent key without touching another's", () => {});
phase("array → record: a move rebuilds the descendant record and says which flags it lost", () => {});
phase("depth beyond the document's cap is refused when the form is built", () => {});

/**
 * The two managers declare a row the same way, because they now run the same code.
 *
 * They did not: only the array told the form the row *owns* its cells, so the sentence
 * `MdyCollectionHost` states about ownership was true of one collection and not the other. Nothing
 * in the value showed it, because the path gate refuses the removal first — which is exactly how a
 * divergence survives.
 */
test("a row owns its cells, whichever collection declared it", () => {
  for (const [kind, build, declare, leaf] of [
    ["record", () => createForm({ c: record(rows()) }), (f) => f.f.c.upsert("k", { sku: "S", qty: 1 }), "c.k.sku"],
    ["array", () => createForm({ c: array(rows()) }), (f) => f.f.c.push({ sku: "S", qty: 1 }), "c.0.sku"],
  ]) {
    const form = build();
    declare(form);
    // A control mounts and goes; the cell is the row's, so it outlives the control.
    form.claimField(leaf);
    form.removeField(leaf);
    assert.notEqual(form.getField(leaf), null, `${kind}: the cell went with the control`);
    form.destroy();
  }
});

// ── record → record, the first public combination ──────────────────────────

const nestedForm = () => createForm({
  orders: record(group({ customer: field(""), lines: record(rows()) })),
});

test("record → record: a row's collection is a collection, not a cell", () => {
  const form = nestedForm();
  form.f.orders.upsert("o1", { customer: "Ada", lines: {} });
  const lines = form.f.orders.row("o1").lines;
  assert.equal(typeof lines.upsert, "function", "the row's own collection answers as one");
  assert.deepEqual(form.getValue(), { orders: { o1: { customer: "Ada", lines: {} } } });

  lines.upsert("l1", { sku: "S", qty: 2 });
  assert.deepEqual(lines.keys(), ["l1"]);
  lines.row("l1").sku.set("S9");
  assert.equal(form.getValue().orders.o1.lines.l1.sku, "S9", "a nested cell writes through");
  form.destroy();
});

test("record → record: removing the parent takes the whole subtree", () => {
  const form = nestedForm();
  form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S", qty: 1 } } });
  assert.notEqual(form.getField("orders.o1.lines.l1.sku"), null);

  form.f.orders.remove("o1");
  assert.deepEqual(form.getValue(), { orders: {} });
  // Not merely absent from the value: the field is gone, so nothing downstream is validating it.
  assert.equal(form.getField("orders.o1.lines.l1.sku")?.().value(), undefined);
  form.destroy();
});

test("record → record: an undeclared parent means an undeclared child", () => {
  const form = nestedForm();
  // Nothing is declared, so the row handle is inert rather than a way to bring a row into being.
  assert.throws(() => form.f.orders.row("ghost").lines.upsert("l", {}), /not declared/);
  form.destroy();
});

test("record → record: a descendant nobody mounted still decides validity", () => {
  const form = createForm({
    orders: record(group({ lines: record(group({ sku: field("", [mdyRequired()]) })) })),
  });
  form.f.orders.upsert("o1", { lines: { l1: { sku: "" } } });
  assert.equal(form.state.valid(), false, "an empty required cell two levels down still counts");
  form.f.orders.row("o1").lines.row("l1").sku.set("S");
  assert.equal(form.state.valid(), true);
  form.destroy();
});

test("record → record: a hostile key is refused at both levels", () => {
  const form = nestedForm();
  for (const key of ["__proto__", "constructor", "with.a.dot"]) {
    form.f.orders.upsert(key, { customer: "x", lines: {} });
    assert.ok(!form.f.orders.keys().includes(key), `the outer level took ${key}`);
  }
  form.f.orders.upsert("o1", { customer: "Ada", lines: {} });
  for (const key of ["__proto__", "constructor", "with.a.dot"]) {
    form.f.orders.row("o1").lines.upsert(key, { sku: "x", qty: 0 });
    assert.ok(!form.f.orders.row("o1").lines.keys().includes(key), `the inner level took ${key}`);
  }
  assert.equal(Object.prototype.polluted, undefined);
  form.destroy();
});

/** A storage a test can read, shaped like the one the draft manager takes. */
function memoryStorage() {
  const store = new Map();
  return {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
}

test("record → record: renaming the parent carries the whole subtree", () => {
  const form = nestedForm();
  form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S1", qty: 3 } } });
  form.f.orders.rename("o1", "o2");
  assert.deepEqual(form.getValue(), { orders: { o2: { customer: "Ada", lines: { l1: { sku: "S1", qty: 3 } } } } });
  assert.deepEqual(form.f.orders.keys(), ["o2"]);
  form.destroy();
});

test("record → record: renaming a child row keeps it inside its own parent", () => {
  const form = nestedForm();
  form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S1", qty: 1 } } });
  form.f.orders.upsert("o2", { customer: "Bo", lines: { l1: { sku: "T1", qty: 1 } } });
  form.f.orders.row("o1").lines.rename("l1", "l9");

  assert.deepEqual(Object.keys(form.getValue().orders.o1.lines), ["l9"]);
  // The other parent's row is named the same and is untouched: two rows, two collections.
  assert.deepEqual(Object.keys(form.getValue().orders.o2.lines), ["l1"]);
  form.destroy();
});

test("record → record: renaming onto an occupied key is refused", () => {
  const form = nestedForm();
  form.f.orders.upsert("o1", { customer: "Ada", lines: {} });
  form.f.orders.upsert("o2", { customer: "Bo", lines: {} });
  form.f.orders.rename("o1", "o2");
  assert.deepEqual(form.f.orders.keys(), ["o1", "o2"], "neither row moved and neither was replaced");
  form.destroy();
});

test("record → record: setAll replaces and patch merges, two levels down", () => {
  const seeded = () => {
    const form = nestedForm();
    form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S1", qty: 1 } } });
    return form;
  };

  // `setAll` says what the collection *is*: a row it does not mention goes, subtree included.
  const replaced = seeded();
  replaced.f.orders.setAll({ o9: { customer: "Zed", lines: {} } });
  assert.deepEqual(replaced.getValue(), { orders: { o9: { customer: "Zed", lines: {} } } });
  replaced.destroy();

  // `patch` says what changed: a subtree the write does not name is left where it was.
  const merged = seeded();
  merged.f.orders.patch({ o1: { customer: "Zed" } });
  assert.deepEqual(merged.getValue().orders.o1.lines, { l1: { sku: "S1", qty: 1 } });
  assert.equal(merged.getValue().orders.o1.customer, "Zed");
  merged.destroy();
});

test("record → record: a restored draft rebuilds both levels", async () => {
  const storage = memoryStorage();
  const schema = () => ({ orders: record(group({ customer: field(""), lines: record(rows()) })) });

  const written = createForm(schema(), { draft: { key: "nested", storage, debounceMs: 0 } });
  written.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S1", qty: 4 } } });
  // A draft is saved when a value changes; declaring rows alone does not ask it to write, which is
  // the same at one level and is why this writes a cell rather than trusting the structure.
  written.f.orders.row("o1").lines.row("l1").sku.set("S9");
  await new Promise((resolve) => setTimeout(resolve, 20));
  written.destroy();

  const restored = createForm(schema(), { draft: { key: "nested", storage, debounceMs: 0 } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(
    restored.getValue(),
    { orders: { o1: { customer: "Ada", lines: { l1: { sku: "S9", qty: 4 } } } } },
    "the inner rows came back too, not only the outer ones",
  );
  restored.destroy();
});

/**
 * History and a collection, measured rather than assumed.
 *
 * Undo does not cross a structural change — and it does not at one level either, so nesting neither
 * introduced this nor made it worse. Written down because the matrix asked the question and the
 * honest answer is a limitation, not a pass: a form that undoes a cell edit but not the row it sits
 * in is a promise half kept, and the phase that fixes it should start from here.
 */
test("history does not cross a structural change, at either depth", () => {
  const oneLevel = createForm({ orders: record(group({ customer: field("") })) }, { history: true });
  oneLevel.f.orders.upsert("o1", { customer: "Ada" });
  oneLevel.undo();
  assert.deepEqual(oneLevel.getValue(), { orders: { o1: { customer: "Ada" } } },
    "one level: the row survives an undo");
  oneLevel.destroy();

  const nested = nestedForm();
  nested.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S", qty: 1 } } });
  nested.undo();
  assert.deepEqual(nested.getValue(), { orders: { o1: { customer: "Ada", lines: { l1: { sku: "S", qty: 1 } } } } },
    "two levels: the same, which is what says this is not about nesting");
  nested.destroy();
});

/**
 * The suite above is two levels deep, which is what the phase promised — and two is exactly the
 * depth at which a rule written for "the parent" can pass while being wrong. `assertRowShape` walks
 * into a row rather than glancing at it, and the gate asks *every* collection above a path, so both
 * should hold at any depth. Should is not a verification.
 */
test("record → record → record: the properties are recursive, not two-deep", () => {
  const deep = () =>
    createForm({
      a: record(group({ b: record(group({ c: record(group({ n: field("", [mdyRequired()]) })) })) })),
    });

  const built = deep();
  built.activate();
  built.f.a.upsert("x", { b: { y: { c: { z: { n: "deep" } } } } });
  assert.deepEqual(
    built.getValue(),
    { a: { x: { b: { y: { c: { z: { n: "deep" } } } } } } },
    "three levels did not read back the shape they were given",
  );
  built.destroy();

  const validity = deep();
  validity.activate();
  validity.f.a.upsert("x", { b: { y: { c: { z: { n: "" } } } } });
  assert.equal(validity.state.valid(), false, "a required field three levels down was not asked about");

  // Removing the row at the top takes the whole subtree — not hides it, takes it.
  validity.f.a.remove("x");
  assert.equal(validity.state.valid(), true, "something under the removed row was still being validated");
  assert.deepEqual(validity.getValue(), { a: {} });
  validity.destroy();
});
