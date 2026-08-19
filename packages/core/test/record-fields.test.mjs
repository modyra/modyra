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

test("a record inside a row is declared, not refused", () => {
  // The first nesting the runtime can execute. Both levels have declared identity, which is what
  // makes rename and late binding answerable without rebasing anything — see ADR 0040.
  const form = createForm({ rows: record(group({ inner: record(field("")) })) });
  form.f.rows.upsert("r", { inner: {} });
  assert.deepEqual(form.getValue(), { rows: { r: { inner: {} } } });
  form.destroy();
});

test("a draft restores the rows it was holding", async () => {
  const store = new Map();
  const storage = {
    read: (key) => (store.has(key) ? store.get(key) : null),
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
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

  const alsoSaid = captureWarnings(() => form.f.rows.patch(undefined));
  assert.deepEqual(form.value().rows.k, { nome: "kept", qta: 2 }, "and so is the whole collection");
  assert.match(alsoSaid.join("\n"), /patch on "rows" ignored/);
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

test("a document may nest a collection of either kind, at any depth", async () => {
  const { parseDynamicForm, buildDynamicFormSchema } = await import("../dist/index.js");

  const recordInsideArray = {
    node: "group",
    children: {
      rows: {
        node: "array",
        item: { node: "record", item: { node: "field", field: { name: "leaf", kind: "text" } } },
      },
    },
  };

  const parsed = parseDynamicForm({ version: 3, schema: recordInsideArray });
  assert.deepEqual(parsed.diagnostics, [], "a keyed collection below a positional one is addressable");
  // The row *is* the keyed collection here, so the row handle is the record's own.
  const built = createForm(buildDynamicFormSchema(recordInsideArray));
  built.f.rows.push({});
  built.f.rows.at(0).upsert("k", "written");
  assert.deepEqual(built.getValue(), { rows: [{ k: "written" }] });
  built.destroy();

  // And a second positional level, which the parser used to refuse: its rows are named below the
  // outer index, which is as addressable as the first level.
  const arrayInsideArray = {
    node: "group",
    children: {
      rows: {
        node: "array",
        item: { node: "array", item: { node: "field", field: { name: "leaf", kind: "text" } } },
      },
    },
  };
  const nestedParse = parseDynamicForm({ version: 3, schema: arrayInsideArray });
  assert.deepEqual(nestedParse.diagnostics, [], "two positional levels parse");

  const deep = createForm(buildDynamicFormSchema(arrayInsideArray));
  deep.f.rows.push([]);
  deep.f.rows.at(0).push("written");
  assert.deepEqual(deep.getValue(), { rows: [["written"]] });
  deep.destroy();
});

test("an array inside a record row is a document a form can run", async () => {
  const { parseDynamicForm, buildDynamicFormSchema } = await import("../dist/index.js");

  const schema = {
    node: "group",
    children: {
      rows: {
        node: "record",
        item: { node: "array", item: { node: "field", field: { name: "leaf", kind: "text" } } },
      },
    },
  };
  const parsed = parseDynamicForm({ version: 3, schema });

  assert.deepEqual(parsed.diagnostics, []);
  const form = createForm(buildDynamicFormSchema(schema));
  form.f.rows.upsert("a", []);
  form.f.rows.row("a").push("first");
  assert.deepEqual(form.getValue(), { rows: { a: ["first"] } });
  form.destroy();
});

test("a draft restores the rows that were there, and not the one the user removed", async () => {
  const store = new Map();
  const storage = {
    read: (key) => (store.has(key) ? store.get(key) : null),
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
  const schema = () => ({
    rows: record(group({ n: field("") }), { initial: { seed: { n: "s" } } }),
  });

  const first = createForm(schema(), { draft: { key: "rows-removal", storage, debounceMs: 0 } });
  first.f.rows.remove("seed");                 // the user deletes the row the schema seeded
  first.f.rows.upsert("new", { n: "added" }); // and adds one of their own
  await new Promise((r) => setTimeout(r, 20));

  const restored = createForm(schema(), { draft: { key: "rows-removal", storage, debounceMs: 0 } });
  await new Promise((r) => setTimeout(r, 20));

  assert.deepEqual([...restored.f.rows.keys()], ["new"], "the deletion is part of what was saved");
  assert.equal(restored.value().rows.new.n, "added");
  assert.equal(restored.f.rows.has("seed"), false, "a restore must not undo a removal");
});

test("undo and redo step a row's value both ways", async () => {
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const form = createForm({ rows: record(group({ n: field("") })) }, { history: true });
  await tick();
  form.f.rows.upsert("k", { n: "one" });
  await tick();
  form.f.rows.cell("k", "n").set("two");
  await tick();

  form.undo();
  assert.equal(form.value().rows.k.n, "one");
  form.redo();
  assert.equal(form.value().rows.k.n, "two");
});

test("the form's security policy reaches a row's cells like any other field", () => {
  const seen = [];
  const form = createForm(
    { rows: record(group({ n: field("") })) },
    { security: { maxValueLength: 4, onViolation: (violation) => seen.push(violation) } },
  );

  form.f.rows.upsert("k", { n: "far too long" });

  assert.equal(form.value().rows.k.n, "far ", "the cap applies inside a row");
  assert.deepEqual(seen.map((v) => v.kind), ["max-length"], "and the interception is reported");
});

test("two columns rendering the same cell share one state", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("k", { nome: "one", qta: 1 });

  // What two columns asking for the same part looks like to the engine.
  form.claimField("rows.k.nome");
  form.claimField("rows.k.nome");
  form.f.rows.cell("k", "nome").set("two");

  assert.equal(form.value().rows.k.nome, "two");
  form.removeField("rows.k.nome");
  assert.equal(form.value().rows.k.nome, "two", "one column leaving takes nothing with it");
  form.removeField("rows.k.nome");
  assert.equal(form.value().rows.k.nome, "two", "and neither does the last: the row owns the value");
});

test("a rename while a cell is mounted moves the control's binding, not its value", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("tmp:1", { nome: "typed", qta: 3 });
  form.claimField("rows.tmp:1.nome");
  const beforeCell = form.f.rows.cell("tmp:1", "nome");

  form.f.rows.rename("tmp:1", "88");

  assert.equal(beforeCell.value(), null, "the old key addresses nothing now");
  assert.equal(form.f.rows.cell("88", "nome").value(), "typed", "and the value moved with the row");
  assert.equal(
    form.fieldNames().some((n) => n.startsWith("rows.tmp:1.")),
    false,
    "nothing of the old key is left registered",
  );
});

test("a large collection is declared once and grows in constant time", () => {
  const form = createForm({ rows: record(rowSchema()) });
  const rows = Object.fromEntries(
    Array.from({ length: 500 }, (_, i) => [String(i), { nome: `n${i}`, qta: i }]),
  );

  form.f.rows.setAll(rows);
  assert.equal(form.f.rows.keys().length, 500);
  assert.equal(form.value().rows["499"].nome, "n499", "and the last row is readable");

  form.f.rows.upsert("500", { nome: "one more", qta: 1 });
  assert.equal(form.f.rows.keys().length, 501);

  // Churn: the collection ends where it started, with nothing left registered.
  for (let i = 0; i < 500; i++) form.f.rows.remove(String(i));
  assert.deepEqual([...form.f.rows.keys()], ["500"]);
  assert.equal(
    form.fieldNames().filter((n) => n.startsWith("rows.")).length,
    2,
    "one row of two cells, and the collection's own path",
  );
});

test("reset returns the collection to what the schema declared, and clears interaction", () => {
  const form = createForm({
    rows: record(group({ n: field("x") }), { initial: { seed: { n: "s" } } }),
  });
  form.f.rows.upsert("added", { n: "y" });
  form.f.rows.cell("seed", "n").set("edited");
  form.f.rows.cell("seed", "n").markAsTouched();

  form.reset();

  assert.deepEqual(form.value().rows, { seed: { n: "s" } }, "the rows the schema declared, as declared");
  assert.equal(form.f.rows.has("added"), false, "a row added at runtime is not part of that");
  assert.equal(form.f.rows.cell("seed", "n").touched(), false);
});

test("a record with no declared rows resets to none — like an array with no initial", () => {
  const form = createForm({ rows: record(group({ n: field("") })) });
  form.f.rows.upsert("k", { n: "typed" });

  form.reset();

  assert.deepEqual([...form.f.rows.keys()], [], "reset means what the schema said, which was nothing");
});

test("an invalid row blocks a submit, as an invalid field does", async () => {
  const form = createForm({
    rows: record(group({ n: field("", [required()]) })),
  });
  form.f.rows.upsert("k", { n: "" });

  let ran = false;
  await form.submit(async () => {
    ran = true;
  });
  assert.equal(ran, false, "the handler is not reached while a row is invalid");

  form.f.rows.cell("k", "n").set("filled");
  await form.submit(async () => {
    ran = true;
  });
  assert.equal(ran, true);
});

// ─── Ordering ────────────────────────────────────────────────────────────────

test("a batched mutation ends where its last call left the collection", () => {
  const form = createForm({ rows: record(rowSchema()) });

  form.mutate(() => {
    form.f.rows.upsert("k", { nome: "x", qta: 1 });
    form.f.rows.remove("k");
  });
  assert.deepEqual(form.value().rows, {}, "declared and removed inside one batch leaves nothing");

  form.f.rows.upsert("k", { nome: "before", qta: 1 });
  form.mutate(() => {
    form.f.rows.remove("k");
    form.f.rows.upsert("k", { nome: "after", qta: 2 });
  });
  assert.deepEqual(form.value().rows.k, { nome: "after", qta: 2 }, "and the other order rebuilds it");
});

test("a control claimed before the churn follows it to the end", () => {
  const form = createForm({ rows: record(rowSchema()) });
  const cell = form.f.rows.cell("k", "nome");
  form.claimField("rows.k.nome");

  form.mutate(() => {
    form.f.rows.upsert("k", { nome: "declared", qta: 1 });
    form.f.rows.remove("k");
    form.f.rows.upsert("k", { nome: "again", qta: 2 });
  });

  assert.equal(cell.value(), "again", "the handle reads whatever the row ended as");
  assert.equal(form.value().rows.k.qta, 2);
});

test("one whole-value write reconciles two collections at once", () => {
  const form = createForm({ left: record(rowSchema()), right: record(rowSchema()) });
  form.f.left.setAll({ a: { nome: "1", qta: 1 }, b: { nome: "2", qta: 2 } });
  form.f.right.setAll({ z: { nome: "9", qta: 9 } });

  form.setValue({
    left: { a: { nome: "kept", qta: 1 } },
    right: { z: { nome: "9", qta: 9 }, y: { nome: "new", qta: 0 } },
  });

  assert.deepEqual([...form.f.left.keys()], ["a"], "the one it shrank");
  assert.deepEqual([...form.f.right.keys()].sort(), ["y", "z"], "and the one it grew");
});

test("a flat write declares every row it carries", () => {
  const form = createForm({ rows: record(rowSchema()) });

  // What a draft restore or an undo looks like from the engine's side.
  form.patchValue({ "rows.x.nome": "one", "rows.y.nome": "two" });

  assert.deepEqual([...form.f.rows.keys()].sort(), ["x", "y"]);
  assert.equal(form.value().rows.x.nome, "one");
});

test("a structural change inside a mutate is one step of history", async () => {
  const tick = () => new Promise((r) => setTimeout(r, 10));
  const form = createForm({ rows: record(rowSchema()) }, { history: true });
  await tick();

  form.mutate(() => {
    form.f.rows.upsert("k", { nome: "one", qta: 1 });
    form.f.rows.cell("k", "nome").set("two");
  });
  await tick();

  assert.equal(form.value().rows.k.nome, "two");
  form.undo();
  assert.deepEqual(form.value().rows, {}, "one step back is before the whole batch, not inside it");
});

// ─── Beside an array ─────────────────────────────────────────────────────────

test("an array and a record under one group keep their own shapes", async () => {
  const { array } = await import("../dist/index.js");
  const form = createForm({
    order: group({
      list: array(group({ n: field("") }), { initial: [{ n: "idx0" }] }),
      rows: record(group({ n: field("") })),
    }),
  });

  // Keys that read as indices, next to a collection that really is indexed.
  form.f.order.rows.setAll({ 0: { n: "keyed0" }, 1: { n: "keyed1" } });

  const value = form.value().order;
  assert.equal(Array.isArray(value.list), true, "the array is still an array");
  assert.equal(Array.isArray(value.rows), false, "and the record is still an object");
  assert.deepEqual(Object.keys(value.rows).sort(), ["0", "1"]);
});

test("one patch and one setValue reach both collections", async () => {
  const { array } = await import("../dist/index.js");
  const form = createForm({
    list: array(group({ n: field("") }), { initial: [{ n: "row0" }] }),
    rows: record(group({ n: field("") })),
  });
  form.f.rows.upsert("k", { n: "keyed" });

  form.patch({ list: [{ n: "replaced" }], rows: { k: { n: "merged" } } });
  assert.deepEqual(form.value().list, [{ n: "replaced" }]);
  assert.equal(form.value().rows.k.n, "merged");

  form.setValue({ list: [{ n: "a" }, { n: "b" }], rows: { x: { n: "c" } } });
  assert.equal(form.value().list.length, 2);
  assert.deepEqual([...form.f.rows.keys()], ["x"]);
});

test("reset returns both collections to what the schema declared", async () => {
  const { array } = await import("../dist/index.js");
  const form = createForm({
    list: array(group({ n: field("") }), { initial: [{ n: "seed" }] }),
    rows: record(group({ n: field("") }), { initial: { s: { n: "seeded" } } }),
  });
  form.f.list.push({ n: "added" });
  form.f.rows.upsert("extra", { n: "added" });

  form.reset();

  assert.deepEqual(form.value().list, [{ n: "seed" }]);
  assert.deepEqual([...form.f.rows.keys()], ["s"]);
});

test("a row may hold a collection of either kind, at any depth", async () => {
  const { array } = await import("../dist/index.js");

  // An array's row holding a keyed collection, and that keyed collection holding an array: three
  // levels, both kinds, nothing refused.
  const inArray = createForm({ list: array(group({ inner: record(field("")) })) });
  inArray.f.list.push({ inner: { a: "x" } });
  assert.deepEqual(inArray.value().list, [{ inner: { a: "x" } }]);
  inArray.destroy();

  const twoPositional = createForm({ list: array(group({ inner: array(field("")) })) });
  twoPositional.f.list.push({ inner: ["a", "b"] });
  twoPositional.f.list.at(0).inner.push("c");
  assert.deepEqual(twoPositional.value().list, [{ inner: ["a", "b", "c"] }]);
  twoPositional.destroy();

  const nested = createForm({ rows: record(group({ inner: array(field("")) })) });
  nested.f.rows.upsert("r1", { inner: ["a", "b"] });
  assert.deepEqual(nested.value().rows.r1.inner, ["a", "b"]);
  nested.destroy();
});

// ─── The document's limits ───────────────────────────────────────────────────

test("a deep document is walked rather than refused, and its content is still checked", async () => {
  const { parseDynamicForm } = await import("../dist/index.js");
  const leaf = () => ({ node: "field", field: { name: "leaf", kind: "text" } });

  // Depth is the document's business. A hundred levels is a document, and the walk is iterative, so
  // what used to be a refusal — and, without the cap, a stack overflow — is now an answer.
  let deep = leaf();
  for (let i = 0; i < 100; i += 1) {
    deep = { node: "record", item: { node: "group", children: { inner: deep } } };
  }
  const nested = parseDynamicForm({ version: 3, schema: { node: "group", children: { root: deep } } });
  assert.deepEqual(nested.diagnostics, [], "a deep document parses");

  // What is still checked is content: a row key that cannot be a path segment names a row nothing
  // can address, at any depth. Parsed from text, because that is how a document arrives — and
  // because a `__proto__` key written as a literal sets a prototype instead of becoming one.
  const unsafe = parseDynamicForm(JSON.parse(JSON.stringify({
    version: 3,
    schema: {
      node: "group",
      children: {
        rows: {
          node: "record",
          item: { node: "group", children: { n: leaf() } },
          initialValue: { placeholder: { n: "x" } },
        },
      },
    },
  }).replace('"placeholder"', '"__proto__"')));
  assert.ok(unsafe.diagnostics.some((d) => d.code === "MDY_DYNAMIC_UNSAFE_NAME"));
});

test("a layout slot and a validation may address a row's leaf", async () => {
  const { parseDynamicForm, buildDynamicFormSchema, buildDynamicValidations } = await import(
    "../dist/index.js"
  );
  const leaf = () => ({ node: "field", field: { name: "leaf", kind: "text" } });
  const document_ = {
    version: 3,
    schema: {
      node: "group",
      children: {
        rows: {
          node: "record",
          item: { node: "group", children: { n: leaf() } },
          initialValue: { 12: { n: "a" } },
        },
      },
    },
    layout: [{ kind: "section", id: "s", label: "Rows", children: ["rows.12.n"] }],
    validations: [
      {
        message: "the row says bad",
        target: "rows.12.n",
        when: { op: "equals", operands: [{ path: "rows.12.n" }, "bad"] },
      },
    ],
  };

  const parsed = parseDynamicForm(document_);
  assert.deepEqual(parsed.diagnostics, [], "a row's leaf is an address like any other");

  // And the rule the document declared actually runs on the form built from it.
  const form = createForm(buildDynamicFormSchema(document_.schema), {
    validators: buildDynamicValidations(document_.validations),
  });
  form.f.rows.cell("12", "n").set("bad");
  assert.equal(form.state.valid(), false);
  form.f.rows.cell("12", "n").set("fine");
  assert.equal(form.state.valid(), true);
});

// ─── What leaves the form ────────────────────────────────────────────────────

test("a rename is structure, so the change set stays quiet — and the next edit does not", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("tmp:1", { nome: "typed", qta: 2 });
  // A row the form was not built with is itself a change — reset would throw it away — so the
  // baseline moves to hold it, and what the rename does is the only thing left to read.
  form.rebaselineToCurrentValue();

  form.f.rows.rename("tmp:1", "77");
  assert.deepEqual(
    form.getChanges(),
    {},
    "changed values, not structure — the same rule removals follow",
  );

  form.f.rows.cell("77", "nome").set("edited after the rename");
  assert.deepEqual(form.getChanges(), { rows: { 77: { nome: "edited after the rename" } } });
});

test("a draft carries five hundred rows there and back", async () => {
  const store = new Map();
  const storage = {
    read: (key) => (store.has(key) ? store.get(key) : null),
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
  const schema = () => ({ rows: record(rowSchema()) });
  const rows = Object.fromEntries(
    Array.from({ length: 500 }, (_, i) => [String(i), { nome: `row ${i}`, qta: i }]),
  );

  const first = createForm(schema(), { draft: { key: "big", storage, debounceMs: 0 } });
  first.f.rows.setAll(rows);
  await new Promise((r) => setTimeout(r, 40));

  const restored = createForm(schema(), { draft: { key: "big", storage, debounceMs: 0 } });
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(restored.f.rows.keys().length, 500);
  assert.deepEqual(restored.value().rows["499"], { nome: "row 499", qta: 499 });
});

test("a key is any string a path segment allows, alphabet included", () => {
  const form = createForm({ rows: record(rowSchema()) });
  const keys = ["città", "日本語", "emoji-🙂", "x".repeat(300)];

  for (const key of keys) form.f.rows.upsert(key, { nome: key.slice(0, 4), qta: 1 });

  assert.equal(form.f.rows.keys().length, keys.length);
  assert.equal(form.value().rows["日本語"].nome, "日本語");
  assert.equal(form.f.rows.cell("emoji-🙂", "nome").value(), "emoj");
});

test("a disabled cell leaves the row in the submit, without itself", () => {
  const form = createForm({ rows: record(rowSchema()) });
  form.f.rows.upsert("k", { nome: "sent", qta: 3 });

  form.setDisabled("rows.k.qta", () => true);

  assert.deepEqual(form.submitValue(), { rows: { k: { nome: "sent" } } });
  assert.equal(form.value().rows.k.qta, 3, "the value is still the form's; it is simply not sent");
});

/**
 * A row declared with no value is the row the template describes.
 *
 * `upsert(key)` states that a row exists without stating its contents, and the item descriptor is
 * what a row is. Reading the row back before it exists answers `null` for every cell, and declaring
 * it from that answer would ship a row of nulls where the schema declares initials — visible in the
 * submitted payload, and in every control bound to a cell that should have started empty.
 */
test("a row declared without a value carries the template's initial values", () => {
  const form = createForm({
    rows: record(group({ nome: field(""), qta: field(7) })),
  });

  form.f.rows.upsert("valueless");
  form.f.rows.upsert("empty", {});
  form.f.rows.patch({ patched: {} });

  const template = { nome: "", qta: 7 };
  assert.deepEqual(form.value().rows.valueless, template);
  assert.deepEqual(form.value().rows.empty, template);
  assert.deepEqual(form.value().rows.patched, template);
  assert.deepEqual(form.submitValue().rows.valueless, template, "and it is what would be submitted");
});

test("re-declaring an existing row without a value keeps what the row holds", () => {
  const form = createForm({ rows: record(group({ nome: field(""), qta: field(7) })) });

  form.f.rows.upsert("k", { nome: "Espresso", qta: 2 });
  form.f.rows.upsert("k");

  assert.deepEqual(form.value().rows.k, { nome: "Espresso", qta: 2 });
});

/**
 * A binding is the binder's, and the binder outlives the row.
 *
 * A control may bind before its row is declared — that is what a waiting claim is for — and it stays
 * bound while a row is removed and declared again under it. A binding held only on the field record
 * would be dropped by both, leaving a control that believes the field is disabled over a value that
 * is submitted.
 */
test("a disabled binding made before the row applies to the row that arrives", () => {
  const rx = vanillaReactivity();
  const form = createForm({ rows: record(group({ nome: field(""), qta: field(0) })) }, { reactivity: rx });
  const disabled = rx.signal(true);

  form.claimField("rows.14.nome");
  form.setDisabled("rows.14.nome", disabled);

  form.f.rows.upsert("14", { nome: "Espresso", qta: 2 });
  assert.equal(form.getField("rows.14.nome")().disabled(), true);
  assert.deepEqual(form.submitValue().rows["14"], { qta: 2 }, "a disabled cell is not submitted");

  form.f.rows.remove("14");
  form.f.rows.upsert("14", { nome: "Ristretto", qta: 1 });
  assert.equal(
    form.getField("rows.14.nome")().disabled(),
    true,
    "the control never moved, so neither did what it said",
  );

  disabled.set(false);
  assert.equal(form.getField("rows.14.nome")().disabled(), false, "and it is still the binder's to release");
});

/**
 * The row's shape is the template's shape.
 *
 * Which control mounted first is a rendering decision, and a value whose key order followed it would
 * let the rendering be read out of the payload.
 */
test("a row's value keys follow the template, not the order controls mounted", () => {
  const form = createForm({ rows: record(group({ nome: field(""), qta: field(0) })) });

  form.claimField("rows.k.qta");
  form.f.rows.upsert("k", { nome: "Espresso", qta: 2 });

  assert.deepEqual(Object.keys(form.value().rows.k), ["nome", "qta"]);
  assert.deepEqual(Object.keys(form.submitValue().rows.k), ["nome", "qta"]);
});

/**
 * A declaration that raises while it is read leaves nothing behind.
 *
 * A row's value is not always plain data: an ORM entity behind a lazy association, or a proxy over a
 * store, raises when a column nobody loaded is read. The key was committed before the row's fields
 * were registered, so a caller who caught the error was left with `keys()` naming a row that
 * `getValue()` did not have — two public reads disagreeing about whether a row exists.
 */
test("a row whose value raises while it is read is not declared", () => {
  const form = createForm({ rows: record(group({ code: field(""), note: field("") })) });
  form.f.rows.upsert("ok", { code: "OK", note: "n" });

  assert.throws(() => form.f.rows.upsert("bad", {
    get code() { throw new Error("not loaded"); },
    note: "kept",
  }), /not loaded/);

  assert.deepEqual([...form.f.rows.keys()], ["ok"], "the key that could not be read is not declared");
  assert.deepEqual(form.getValue().rows, { ok: { code: "OK", note: "n" } });
  assert.equal(form.fieldNames().some((name) => name.startsWith("rows.bad")), false);
});

test("a rewrite that raises leaves the row it was rewriting", () => {
  const form = createForm({ rows: record(group({ code: field(""), note: field("") })) });
  form.f.rows.upsert("k", { code: "first", note: "n" });

  assert.throws(() => form.f.rows.upsert("k", {
    get code() { throw new Error("not loaded"); },
    note: "second",
  }), /not loaded/);

  assert.deepEqual(form.getValue().rows.k, { code: "first", note: "n" });
});
