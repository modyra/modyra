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
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── What the refusal does today ────────────────────────────────────────────

test("a second positional level is addressable, and the runtime executes it", () => {
  // What used to be refused: two positional levels. A row's path is a pattern — `orders.*`,
  // `orders.*.allocations.*` — so a descendant is named as unambiguously under the second index as
  // under the first, and the engine registers the whole subtree.
  const form = createForm({
    orders: array(group({
      ref: field(""),
      allocations: array(group({ bin: field(""), qty: field(0) })),
    })),
  });

  form.f.orders.push({ ref: "R1", allocations: [{ bin: "A", qty: 2 }, { bin: "B", qty: 3 }] });
  form.f.orders.push({ ref: "R2", allocations: [] });

  assert.deepEqual(form.getValue().orders, [
    { ref: "R1", allocations: [{ bin: "A", qty: 2 }, { bin: "B", qty: 3 }] },
    { ref: "R2", allocations: [] },
  ]);
  assert.ok(
    form.fieldNames().includes("orders.0.allocations.1.bin"),
    "a descendant two positional levels down has a field of its own",
  );

  // And it is writable through the handle tree, at both levels.
  form.f.orders.at(0).allocations.push({ bin: "C", qty: 1 });
  assert.equal(form.getValue().orders[0].allocations.length, 3);
  form.destroy();
});

test("a form may nest as deep as it needs", () => {
  // Four levels, mixing both kinds: nothing refuses a depth, and the value keeps the shape each
  // level declares.
  const form = createForm({
    orders: record(group({
      lines: array(group({
        allocations: record(group({
          bins: array(field("")),
        })),
      })),
    })),
  });

  form.f.orders.upsert("o1", {
    lines: [{ allocations: { a1: { bins: ["north", "south"] } } }],
  });

  assert.deepEqual(form.getValue().orders.o1.lines[0].allocations.a1.bins, ["north", "south"]);
  assert.equal(Array.isArray(form.getValue().orders.o1.lines), true, "a positional level is an array");
  assert.equal(
    Array.isArray(form.getValue().orders.o1.lines[0].allocations),
    false,
    "and a keyed level inside it is an object",
  );
  assert.ok(form.fieldNames().includes("orders.o1.lines.0.allocations.a1.bins.0"));
  form.destroy();
});

test("a removal at an outer level takes every level below it", () => {
  const form = createForm({
    orders: array(group({ allocations: array(group({ bin: field("") })) })),
  });
  form.f.orders.push({ allocations: [{ bin: "A" }] });
  form.f.orders.push({ allocations: [{ bin: "B" }] });

  form.f.orders.remove(0);

  assert.deepEqual(form.getValue().orders, [{ allocations: [{ bin: "B" }] }]);
  assert.equal(
    form.fieldNames().filter((name) => name.startsWith("orders.1.")).length,
    0,
    "nothing of the row that ended survives under its old index",
  );
  form.destroy();
});

test("one level still behaves as it always did, in both directions", () => {
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

test("record → array: rows push and move inside one parent key without touching another's", async () => {
  const form = createForm({
    orders: record(group({ customer: field(""), lines: array(rows()) })),
  }, { history: true });
  form.f.orders.upsert("o1", { customer: "Ada", lines: [{ sku: "A", qty: 1 }] });
  form.f.orders.upsert("o2", { customer: "Bob", lines: [{ sku: "Z", qty: 9 }] });

  const o1 = () => form.f.orders.row("o1").lines;
  o1().push({ sku: "B", qty: 2 });
  assert.equal(o1().length(), 2, "the row's array grew");
  assert.equal(form.f.orders.row("o2").lines.length(), 1, "the sibling's array is untouched");

  o1().move(0, 1);
  assert.deepEqual(o1().rows().map((r) => r.sku.value()), ["B", "A"], "a move reorders inside the row");
  assert.equal(form.f.orders.row("o2").lines.rows()[0].sku.value(), "Z");

  // The value reads back as a list, and the whole subtree goes with its row.
  assert.deepEqual(form.getValue().orders.o1.lines.map((l) => l.sku), ["B", "A"]);
  form.f.orders.remove("o1");
  assert.deepEqual(Object.keys(form.getValue().orders), ["o2"]);
  form.destroy();
});

test("record → array: a row's array is undoable with its row", async () => {
  const form = createForm({ orders: record(group({ lines: array(rows()) })) }, { history: true });
  form.f.orders.upsert("o1", { lines: [{ sku: "A", qty: 1 }] });
  await tick();
  form.f.orders.remove("o1");
  form.undo();
  assert.deepEqual(form.f.orders.keys(), ["o1"]);
  assert.deepEqual(form.getValue().orders.o1.lines.map((l) => l.sku), ["A"], "the array came back whole");
  form.destroy();
});
test("array → record: a move rebuilds the descendant record and says which flags it lost", () => {
  const form = createForm({
    orders: array(group({ code: field(""), allocs: record(group({ lot: field(""), qty: field(0) })) })),
  });
  form.f.orders.push({ code: "A", allocs: { a1: { lot: "L1", qty: 2 } } });
  form.f.orders.push({ code: "B", allocs: { b1: { lot: "L9", qty: 5 } } });

  // The row's own record answers by key, below a positional prefix.
  assert.deepEqual([...form.f.orders.rows()[0].allocs.keys()], ["a1"]);
  form.f.orders.rows()[0].allocs.upsert("a2", { lot: "L2", qty: 1 });
  assert.deepEqual([...form.f.orders.rows()[0].allocs.keys()], ["a1", "a2"]);
  assert.deepEqual([...form.f.orders.rows()[1].allocs.keys()], ["b1"], "the sibling row is untouched");

  // What a move costs, stated: the descendant is rebuilt under its new index — values follow,
  // touched and dirty do not, exactly as an array's own rows have always behaved (ADR 0040).
  form.f.orders.rows()[0].allocs.row("a1").lot.markAsTouched();
  assert.equal(form.f.orders.rows()[0].allocs.row("a1").lot.touched(), true);
  form.f.orders.move(0, 1);
  assert.equal(form.f.orders.rows()[1].code.value(), "A", "the row moved");
  assert.deepEqual([...form.f.orders.rows()[1].allocs.keys()], ["a1", "a2"], "with its whole record");
  assert.equal(form.f.orders.rows()[1].allocs.row("a1").lot.value(), "L1", "values survive the rebuild");
  assert.equal(form.f.orders.rows()[1].allocs.row("a1").lot.touched(), false, "flags do not — the documented cost");

  // Removing the row takes the record with it, fields and all.
  form.f.orders.remove(1);
  assert.deepEqual(form.getValue().orders.map((o) => o.code), ["B"]);
  assert.equal(form.fieldNames().some((n) => n.includes("a1")), false, "nothing of the row is left registered");
  form.destroy();
});
test("a form deeper than any published cap still builds and runs", () => {
  // There is no number to refuse. A collection inside a row is addressed by the pattern its
  // declaration has, at every level, so depth is the form's business rather than the engine's.
  const nest = (depth) => (depth === 0 ? field("") : record(group({ next: nest(depth - 1) })));

  const form = createForm({ a: nest(12) });
  const write = (depth) => {
    let path = "a";
    let handle = form.f.a;
    for (let level = 0; level < depth; level += 1) {
      handle.upsert("k", {});
      path = `${path}.k.next`;
      handle = handle.row("k").next;
    }
    return path;
  };

  const deepest = write(11);
  assert.ok(deepest.split(".").length > 20, "the path crosses every level");
  form.destroy();
});

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
test("history crosses a structural change, at either depth and on any schedule", async () => {
  // Synchronously: undo records what the scheduler has not seen yet, so a row declared a moment
  // ago is undoable in the same task.
  const oneLevel = createForm({ orders: record(group({ customer: field("") })) }, { history: true });
  await tick();
  oneLevel.f.orders.upsert("o1", { customer: "Ada" });
  oneLevel.undo();
  assert.deepEqual(oneLevel.getValue(), { orders: {} }, "one level: a declared row is undoable synchronously");
  oneLevel.redo();
  assert.deepEqual(oneLevel.getValue(), { orders: { o1: { customer: "Ada" } } }, "and redo declares it again");
  oneLevel.destroy();

  // Removing a parent and undoing brings the whole subtree back — keys and values, both levels.
  const nested = createForm(
    { orders: record(group({ customer: field(""), lines: record(rows()) })) },
    { history: true },
  );
  nested.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S", qty: 1 } } });
  await tick();
  nested.f.orders.remove("o1");
  nested.undo();
  assert.deepEqual(nested.getValue(),
    { orders: { o1: { customer: "Ada", lines: { l1: { sku: "S", qty: 1 } } } } },
    "two levels: the removed subtree comes back whole");
  nested.destroy();
});

test("undo of a parent whose child had a verdict pending stays coherent", async () => {
  let release = () => {};
  const gate = new Promise((r) => { release = r; });
  const form = createForm({
    orders: record(group({
      customer: field(""),
      lines: record(group({ lot: field("", [], { asyncValidators: [async () => { await gate; return ["bad lot"]; }] }) })),
    })),
  }, { history: true });
  form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { lot: "L-9" } } });
  await tick(); // async run starts, snapshot recorded
  form.f.orders.remove("o1");
  form.undo(); // the subtree comes back — as a fresh declaration, not a resurrection
  release();
  await tick(); await tick();
  assert.deepEqual([...form.f.orders.keys()], ["o1"]);
  assert.equal(form.f.orders.row("o1").lines.row("l1").lot.value(), "L-9");
  // The restored row is a new declaration: the old run was aborted with its field, and the fresh
  // field re-ran its validator against the restored value — so the verdict belongs to this row.
  form.destroy();
});

test("redo after an undone rename applies the rename again, once", async () => {
  const form = createForm(
    { orders: record(group({ customer: field(""), lines: record(rows()) })) },
    { history: true },
  );
  form.f.orders.upsert("o1", { customer: "Ada", lines: {} });
  await tick();
  form.f.orders.rename("o1", "o2");
  form.undo();
  assert.deepEqual([...form.f.orders.keys()], ["o1"]);
  form.redo();
  assert.deepEqual([...form.f.orders.keys()], ["o2"], "redo re-applies the whole rename");
  assert.equal(form.canRedo(), false);
  form.destroy();
});

test("a rename is one undo step, and what is not restored is stated", async () => {
  const nested = createForm(
    { orders: record(group({ customer: field(""), lines: record(rows()) })) },
    { history: true },
  );
  nested.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "S", qty: 1 } } });
  await tick();
  nested.f.orders.rename("o1", "o2");
  nested.undo();
  assert.deepEqual([...nested.f.orders.keys()], ["o1"], "one undo takes the rename back");
  assert.equal(nested.f.orders.row("o1").lines.row("l1").sku.value(), "S", "with its subtree's values");
  // The boundary history keeps: only the value is recorded — touched, dirty and validation
  // verdicts are not restored, for structure exactly as for edits.
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

test("a nested collection's own validators run, one instance per row", () => {
  const needsOne = (rows) => (Object.keys(rows ?? {}).length === 0 ? ["needs a line"] : []);
  const form = createForm({
    orders: record(group({ customer: field(""), lines: record(rows(), { validators: [needsOne] }) })),
  });
  form.f.orders.upsert("o1", { customer: "A", lines: {} });
  form.f.orders.upsert("o2", { customer: "B", lines: { l1: { sku: "s", qty: 1 } } });

  assert.equal(form.state.valid(), false, "an empty nested collection gates the form");
  assert.equal(form.errorsFor("orders.o1.lines")().length, 1, "the error carries the instance's own path");
  assert.deepEqual(form.errorsFor("orders.o2.lines")(), [], "the sibling row's instance is untouched");

  form.f.orders.row("o1").lines.upsert("l9", { sku: "x", qty: 1 });
  assert.equal(form.state.valid(), true, "declaring the row clears that instance's verdict");
  form.destroy();
});

test("a validator two collections down answers for its own instance, not for its siblings", () => {
  // The price-band shape: bands own a rule, and every line owns its own bands.
  const ascending = (bands) => {
    const mins = Object.values(bands ?? {}).map((b) => Number(b.min ?? 0));
    return [...mins].sort((a, b) => a - b).join() === mins.join() ? [] : ["bands are out of order"];
  };
  const form = createForm({
    contracts: record(group({
      lines: record(group({ bands: record(group({ min: field(0) }), { validators: [ascending] }) })),
    })),
  });
  form.f.contracts.upsert("c1", {
    lines: {
      l1: { bands: { b1: { min: 1 }, b2: { min: 100 } } },
      l2: { bands: { b1: { min: 1 }, b2: { min: 100 } } },
    },
  });
  assert.equal(form.state.valid(), true, "two well-ordered instances of the same nested rule");

  form.f.contracts.row("c1").lines.row("l1").bands.row("b2").min.set(0);
  assert.equal(form.errorsFor("contracts.c1.lines.l1.bands")().length, 1, "the error names the band collection that broke");
  assert.deepEqual(form.errorsFor("contracts.c1.lines.l2.bands")(), [], "the other line's bands answer for themselves");
  assert.equal(form.state.valid(), false);

  // The rule outlives the row that broke it being replaced wholesale.
  form.f.contracts.row("c1").lines.upsert("l1", { bands: { b1: { min: 1 }, b2: { min: 100 } } });
  assert.deepEqual(form.errorsFor("contracts.c1.lines.l1.bands")(), [], "re-declaring the row recompiles its rule");
  assert.equal(form.state.valid(), true);
  form.destroy();
});

/**
 * `canUndo` and `canRedo` answer for the value as it is now.
 *
 * `undo()` records any change the snapshot effect has not seen before popping, so a structural
 * change is undoable in the task that made it. The affordance a consumer binds a button to has to
 * answer the same question: a disabled Undo over a change that undo would revert offers the user
 * nothing, and a lit Redo over an edit that just invalidated the redo stack offers a no-op.
 */
test("canUndo is true in the task that declared a row, and canRedo false once an edit invalidates redo", async () => {
  const form = createForm({ rows: record(group({ code: field("") })) }, { history: true });

  form.f.rows.upsert("a", { code: "A" });
  assert.equal(form.canUndo(), true, "the declaration is undoable in the task that made it");

  form.undo();
  assert.deepEqual(form.f.rows.keys(), [], "and undoing it in the same task removes the row");
  assert.equal(form.canRedo(), true);

  form.redo();
  await tick();
  assert.deepEqual(form.f.rows.keys(), ["a"]);

  form.undo();
  await tick();
  assert.equal(form.canRedo(), true, "the undone declaration is redoable");

  // An edit after an undo invalidates the redo stack; the signal says so before redo is called.
  form.f.rows.upsert("b", { code: "B" });
  assert.equal(form.canRedo(), false, "an unrecorded edit has already invalidated redo");

  form.redo();
  assert.deepEqual(form.f.rows.keys(), ["b"], "redo did nothing, exactly as canRedo said");
});

/**
 * A row that is itself a collection answers as one through the handle tree.
 *
 * `rows` and `row(key)` built a row by walking the item's `children` — which every row has, unless
 * the row *is* a list or a map. Reaching a nested list through the handle tree then threw where it
 * should have answered, while the same data read through `getValue()` was correct: the value was
 * right and the handle could not reach it.
 */
test("a nested collection is reachable through the handle tree, at both kinds", () => {
  const keyed = createForm({
    orders: record(group({ lines: array(array(field(""))) })),
  });
  keyed.f.orders.upsert("o1", { lines: [["a"], []] });

  assert.equal(keyed.f.orders.row("o1").lines.at(0).length(), 1, "a list inside a list answers");
  keyed.f.orders.row("o1").lines.at(1).push("b");
  assert.deepEqual(keyed.getValue().orders.o1.lines, [["a"], ["b"]]);
  keyed.destroy();

  const positional = createForm({ items: array(record(group({ bin: field("") }))) });
  positional.f.items.push({ k: { bin: "A" } });

  assert.deepEqual([...positional.f.items.at(0).keys()], ["k"], "a map inside a list answers");
  positional.f.items.at(0).upsert("j", { bin: "B" });
  assert.deepEqual(positional.getValue().items[0], { k: { bin: "A" }, j: { bin: "B" } });
  positional.destroy();
});
