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
import { createForm, field, group, record, vanillaReactivity } from "../dist/index.js";

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

test("a document can declare a keyed collection, and it becomes a record", async () => {
  const { parseDynamicForm } = await import("../dist/index.js");
  const document = JSON.parse(
    await (await import("node:fs/promises")).readFile(
      new URL("../../../spec/fixtures/dynamic-form/v3/keyed-rows.json", import.meta.url),
      "utf8",
    ),
  );

  const parsed = parseDynamicForm(document);
  assert.deepEqual(parsed.diagnostics, [], "the fixture parses without a complaint");

  const flat = parsed.fields.map((f) => f.name);
  assert.ok(flat.includes("lines.12.name"), "a row declared by the document is addressable");
  assert.ok(flat.includes("lines.tmp:1.qty"), "a provisional key is a key like any other");
});

test("a document's unsafe row key is reported, not rendered", async () => {
  const { parseDynamicForm } = await import("../dist/index.js");
  const parsed = parseDynamicForm({
    version: 3,
    schema: {
      node: "group",
      children: {
        rows: {
          node: "record",
          item: { node: "field", field: { name: "leaf", kind: "text" } },
          initialValue: { "__proto__": "x", "a.b": "y" },
        },
      },
    },
  });

  const codes = parsed.diagnostics.map((d) => d.code);
  assert.ok(codes.includes("MDY_DYNAMIC_UNSAFE_NAME"), "an unaddressable key is a finding");
  assert.equal(({}).x, undefined);
});

test("the typed schema built from a document carries a working record", async () => {
  const { buildDynamicFormSchema } = await import("../dist/index.js");
  const schema = buildDynamicFormSchema({
    node: "group",
    children: {
      lines: {
        node: "record",
        item: {
          node: "group",
          children: {
            name: { node: "field", field: { name: "leaf", kind: "text" } },
            qty: { node: "field", field: { name: "leaf", kind: "number" } },
          },
        },
        initialValue: { 12: { name: "Espresso", qty: 2 } },
      },
    },
  });

  const form = createForm(schema);

  assert.deepEqual([...form.f.lines.keys()], ["12"], "the document's rows are declared");
  assert.equal(form.value().lines["12"].name, "Espresso");

  // And the runtime keeps the last word on which rows exist.
  form.f.lines.upsert("tmp:9", { name: "Cornetto", qty: 1 });
  assert.deepEqual([...form.f.lines.keys()].sort(), ["12", "tmp:9"]);
});

test("has() and validOf() answer inside a computed, like every other member", () => {
  const rx = vanillaReactivity();
  const form = createForm({ rows: record(group({ nome: field("", [required()]) })) }, { reactivity: rx });

  const has = rx.computed(() => form.f.rows.has("k"));
  const inKeys = rx.computed(() => form.f.rows.keys().includes("k"));
  const valid = rx.computed(() => form.f.rows.validOf("k"));

  assert.equal(has(), false);
  assert.equal(inKeys(), false);

  form.f.rows.upsert("k", { nome: "filled" });

  assert.equal(has(), true, "has() must move with the key set, as keys() does");
  assert.equal(inKeys(), true);
  assert.equal(valid(), true, "a row declared valid reads valid without a second read");

  form.f.rows.remove("k");

  assert.equal(has(), false, "and back again when the row ends");
  assert.equal(inKeys(), false);
  assert.equal(valid(), false);
});

test("a record nested in a group keeps its own paths", () => {
  const form = createForm({ order: group({ rows: record(group({ n: field("") })) }) });

  form.f.order.rows.upsert("a3f9", { n: "x" });

  assert.deepEqual(form.value(), { order: { rows: { a3f9: { n: "x" } } } });
  assert.equal(form.f.order.rows.cell("a3f9", "n").value(), "x");
  assert.ok(form.fieldNames().includes("order.rows.a3f9.n"));
});

test("two records in one form do not share a key space", () => {
  const form = createForm({ a: record(field("")), b: record(field("")) });

  form.f.a.upsert("1", "one");
  form.f.b.upsert("1", "two");

  assert.deepEqual(form.value(), { a: { 1: "one" }, b: { 1: "two" } });
  form.f.a.remove("1");
  assert.deepEqual(form.value(), { a: {}, b: { 1: "two" } });
});

test("form-wide operations reach the cells of a declared row", () => {
  const form = createForm({ rows: record(group({ n: field("", [required()]) })) });
  form.f.rows.upsert("k", { n: "" });

  form.markAllTouched();
  assert.equal(form.f.rows.cell("k", "n").touched(), true);

  form.f.rows.cell("k", "n").set("v");
  assert.deepEqual(form.getChanges(), { rows: { k: { n: "v" } } });
  assert.deepEqual(form.submitValue(), { rows: { k: { n: "v" } } });
});

test("a row carries the sanitizer and the async validator its schema declared", async () => {
  const form = createForm({
    rows: record(
      group({
        n: field("", [], { sanitize: (v) => String(v).trim() }),
        code: field("", [], {
          asyncValidators: [async (v) => (v === "taken" ? ["already used"] : [])],
          asyncDebounceMs: 0,
        }),
      }),
    ),
  });

  form.f.rows.upsert("k", { n: "  spaced  ", code: "taken" });
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(form.value().rows.k.n, "spaced", "the row's sanitizer ran");
  assert.deepEqual(
    form.f.rows.cell("k", "code").errors().map((e) => e.message),
    ["already used"],
    "the row's async validator ran, on the row's own field",
  );
});

test("a disabled cell is not submitted, and the row still is", () => {
  const form = createForm({ rows: record(group({ n: field("x"), m: field("y") })) });
  form.f.rows.upsert("k", { n: "x", m: "y" });

  form.setDisabled("rows.k.m", () => true);

  assert.deepEqual(form.submitValue(), { rows: { k: { n: "x" } } });
  assert.equal(form.value().rows.k.m, "y", "the value is still there — it is simply not sent");
});

// ─── Corner cases ────────────────────────────────────────────────────────────

/** Collects what the form's development channel says, and restores the console after. */
function captureWarnings(run) {
  const said = [];
  const original = console.warn;
  console.warn = (message) => said.push(String(message));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return said;
}

test("a handle in use is never let go, however the row churns", () => {
  const form = createForm({ rows: record(rowSchema()) });
  const held = form.f.rows.cell("k", "nome"); // what a mounted control holds

  for (let i = 0; i < 200; i++) {
    form.f.rows.upsert("k", { nome: `v${i}`, qta: i });
    form.f.rows.remove("k");
  }
  form.f.rows.upsert("k", { nome: "last", qta: 1 });

  assert.equal(form.f.rows.cell("k", "nome"), held, "the same object, after 200 rebuilds");
  assert.equal(held.value(), "last", "and it reads the row that exists now");
});

test("handles for rows nobody holds are collectable", async () => {
  const form = createForm({ rows: record(rowSchema()) });

  // Allocated and dropped inside their own frame: a handle held by an enclosing scope stays
  // reachable whatever the cache does, and a test that measured that would prove nothing.
  const showOnceThenRemove = (key) => {
    form.f.rows.upsert(key, { nome: "x", qta: 1 });
    const handle = form.f.rows.cell(key, "nome");
    form.f.rows.remove(key);
    return new WeakRef(handle);
  };

  const gone = showOnceThenRemove("tmp:0");
  for (let i = 1; i < 200; i++) showOnceThenRemove(`tmp:${i}`);

  if (typeof globalThis.gc !== "function") {
    // Without --expose-gc nothing can be asked to collect, and a timing-based guess would be a coin
    // toss dressed as a check. Say what was not established rather than pretend it was.
    assert.ok(true, "collection not established here — run node with --expose-gc to assert it");
    return;
  }

  await new Promise((r) => setTimeout(r, 0)); // a WeakRef keeps its target through the current job
  globalThis.gc();
  await new Promise((r) => setTimeout(r, 5));
  globalThis.gc();

  assert.equal(gone.deref(), undefined, "a handle for a row nobody holds is let go");
  assert.equal(
    form.f.rows.cell("fresh", "nome").path,
    "rows.fresh.nome",
    "and the cache still hands out handles",
  );
});

test("setAll refuses what is not an object instead of emptying the collection", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("a", { nome: "kept", qta: 1 });

  const said = captureWarnings(() => form.f.rows.setAll(undefined));

  assert.deepEqual([...form.f.rows.keys()], ["a"], "an undefined payload empties nothing");
  assert.equal(form.value().rows.a.nome, "kept");
  assert.match(said.join("\n"), /setAll .* ignored/);
  assert.match(said.join("\n"), /\{\}/, "the message names the deliberate way to empty it");

  form.f.rows.setAll({});
  assert.deepEqual([...form.f.rows.keys()], [], "which still works");
});

test("patching a group row with something that is not an object is reported, not swallowed", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("k", { nome: "kept", qta: 2 });

  const said = captureWarnings(() => form.f.rows.patch({ k: 5 }));

  assert.deepEqual(form.value().rows.k, { nome: "kept", qta: 2 }, "the row is untouched");
  assert.match(said.join("\n"), /patch on "rows\.k" ignored/);
});

test("rename says why it did nothing", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("a", { nome: "A", qta: 1 });
  form.f.rows.upsert("b", { nome: "B", qta: 2 });

  const said = captureWarnings(() => {
    form.f.rows.rename("a", "b");   // b is taken
    form.f.rows.rename("zz", "yy"); // zz does not exist
  });

  assert.deepEqual([...form.f.rows.keys()], ["a", "b"], "neither call moved anything");
  assert.equal(form.value().rows.b.nome, "B", "and the row that was in the way is intact");
  assert.match(said.join("\n"), /already names a row/);
  assert.match(said.join("\n"), /no row "zz" to move/);
});

test("cell() on a part the row does not have says what the row offers", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("k", { nome: "x", qta: 1 });

  const said = captureWarnings(() => form.f.rows.cell("k", "nome2"));

  assert.match(said.join("\n"), /addresses nothing/);
  assert.match(said.join("\n"), /nome, qta/, "the diagnostic names the way out");
});

test("a wrong cell part is reported once, not once per render", () => {
  const form = createForm({ rows: record(rowSchema()) });

  const said = captureWarnings(() => {
    // What a table does: the same mistaken part, asked for on every row and every render.
    for (let render = 0; render < 3; render++) {
      for (const key of ["a", "b", "c"]) form.f.rows.cell(key, "nome2");
    }
    form.f.rows.cell("a", "qta2"); // a different mistake still gets its own word
  });

  assert.equal(said.length, 2, "one diagnostic per distinct mistake, not per call");
  assert.match(said[0], /"nome2".*addresses nothing/);
  assert.match(said[1], /"qta2"/);
});

test("a record-level validator gates the form on the whole collection", () => {
  const form = createForm({
    rows: record(rowSchema(), {
      validators: [(rows) => (Object.keys(rows).length > 0 ? [] : ["at least one row"])],
    }),
  });

  assert.equal(form.state.valid(), false);
  assert.deepEqual(form.f.rows.errors().map((e) => e.message), ["at least one row"]);

  form.f.rows.upsert("k", { nome: "x", qta: 1 });
  assert.equal(form.state.valid(), true);
});

test("a group nested inside a row keeps its own dotted path", () => {
  const form = createForm({ rows: record(group({ n: field("x"), inner: group({ deep: field("d") }) })) });

  form.f.rows.upsert("k", { n: "y", inner: { deep: "z" } });

  assert.deepEqual(form.value().rows.k, { n: "y", inner: { deep: "z" } });
  assert.equal(form.f.rows.cell("k", "inner.deep").value(), "z");
  assert.ok(form.fieldNames().includes("rows.k.inner.deep"));
});

test("a hostile key arriving through a flat write is refused, not registered", () => {
  const form = createForm({ rows: record(group({ n: field("") })) });

  const said = captureWarnings(() => form.patchValue({ "rows.__proto__.n": "polluted" }));

  assert.deepEqual([...form.f.rows.keys()], []);
  assert.equal(({}).n, undefined, "nothing reached Object.prototype");
  assert.match(said.join("\n"), /Ignored record key/);
});

test("upsert rewrites the row, patch merges into it", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("k", { nome: "typed", qta: 9 });
  form.f.rows.cell("k", "nome").markAsTouched();

  form.f.rows.upsert("k", { nome: "again" });
  assert.deepEqual(
    form.value().rows.k,
    { nome: "again", qta: 0 },
    "a field the rewrite does not name goes back to the schema's initial",
  );
  assert.equal(form.f.rows.cell("k", "nome").touched(), true, "what the user did survives a rewrite");

  form.f.rows.patch({ k: { nome: "merged" } });
  assert.deepEqual(form.value().rows.k, { nome: "merged", qta: 0 }, "a patch leaves the rest alone");
});

test("removing a row while its async validator is in flight settles cleanly", async () => {
  const form = createForm({
    rows: record(
      group({
        n: field("", [], {
          asyncValidators: [
            async (value) => {
              await new Promise((r) => setTimeout(r, 40));
              return value === "bad" ? ["taken"] : [];
            },
          ],
          asyncDebounceMs: 0,
        }),
      }),
    ),
  });

  form.f.rows.upsert("k", { n: "bad" });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(form.state.pending(), true, "the row is being checked");

  form.f.rows.remove("k");
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(form.state.pending(), false, "the run does not outlive the row");
  assert.equal(form.state.valid(), true, "and cannot report an error against a row that is gone");
  assert.deepEqual(form.fieldNames(), ["rows"], "nothing of the row is left registered");
});
