/**
 * The "decisive test" of the domain-model extraction: the whole form engine
 * runs in plain Node — no framework, no DI, no DOM.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { array, assertSafeDynamicFieldNames, buildDynamicFieldValidators, buildDynamicValidators, createForm, crossField, eachOneOf, field, group, min, oneOf, parseDynamicFields, record, required } from "../dist/index.js";
import { buildDateLocale } from "../dist/datetime.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("typed form: create, set, validate — no framework", () => {
  const form = createForm({
    email: field("", [required()]),
    age: field(null, [min(18)]),
    address: group({ city: field("Rome") }),
  });

  assert.equal(form.state.valid(), false);
  form.f.email.set("foo@bar.com");
  assert.deepEqual(form.f.email.errors(), []);
  assert.equal(form.state.valid(), true);
  assert.equal(form.getValue().address.city, "Rome");
});

test("cross-field validation reacts through the vanilla graph", () => {
  const form = createForm(
    { password: field(""), confirm: field("") },
    {
      validators: [
        crossField(["confirm"], (v) =>
          v.password === v.confirm ? null : "Passwords differ",
        ),
      ],
    },
  );
  form.f.password.set("secret");
  assert.equal(form.f.confirm.valid(), false);
  form.f.confirm.set("secret");
  assert.equal(form.f.confirm.valid(), true);
});

test("async validators: pending, last-wins, debounce", async () => {
  const form = createForm({
    user: field("", [], {
      asyncValidators: [async (v) => (v === "taken" ? ["Name taken"] : [])],
    }),
  });
  await tick(); // initial effect run
  form.f.user.set("taken");
  await tick(); // effect re-run schedules the validator
  await tick(); // promise settles
  assert.deepEqual(
    form.f.user.errors().map((e) => e.message),
    ["Name taken"],
  );
  form.f.user.set("free");
  await tick();
  await tick();
  assert.deepEqual(form.f.user.errors(), []);
});

test("undo/redo and getChanges", async () => {
  const form = createForm({ name: field("start") }, { history: true });
  await tick(); // seed snapshot
  form.f.name.set("edited");
  await tick(); // record
  assert.deepEqual(form.getChanges(), { name: "edited" });

  form.undo();
  assert.equal(form.f.name.value(), "start");
  form.redo();
  assert.equal(form.f.name.value(), "edited");
});

test("draft persistence with exclude and versioned envelope", async () => {
  const data = new Map();
  const storage = {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
  const make = () =>
    createForm(
      { email: field(""), password: field("") },
      { draft: { key: "d", storage, debounceMs: 1, exclude: ["password"] } },
    );

  const first = make();
  await tick();
  first.f.email.set("a@b.co");
  first.f.password.set("hunter2");
  await tick();
  await new Promise((r) => setTimeout(r, 10)); // debounce flush

  const stored = data.get("d");
  assert.ok(stored.includes("a@b.co"));
  assert.ok(!stored.includes("hunter2"));
  assert.ok(JSON.parse(stored).__mdyDraft === 1);

  const second = make();
  assert.equal(second.f.email.value(), "a@b.co");
  assert.equal(second.f.password.value(), "");
  assert.equal(second.hasDraft(), true);
});

test("submit gates on validity and snapshots server errors", async () => {
  const form = createForm({ name: field("", [required()]) });
  let ran = false;
  await form.submit(() => void (ran = true));
  assert.equal(ran, false); // invalid: blocked, fields marked touched
  assert.equal(form.f.name.touched(), true);

  form.f.name.set("ok");
  await form.submit(() => [{ path: "name", kind: "server", message: "no" }]);
  assert.deepEqual(
    form.f.name.errors().map((e) => `${e.kind}:${e.message}`),
    ["server:no"],
  );
  form.f.name.set("edited"); // editing clears the server error
  assert.deepEqual(form.f.name.errors(), []);
});

test("dynamic validators skip invalid/oversized regexp patterns", () => {
  const invalid = buildDynamicValidators({ pattern: "[" });
  assert.equal(invalid.validators.length, 0);

  const longPattern = "a".repeat(257);
  const oversized = buildDynamicValidators({ pattern: longPattern });
  assert.equal(oversized.validators.length, 0);
});

test("oneOf: whitelists scalar values, empties pass, no coercion", () => {
  const v = oneOf(["one", "two"]);
  assert.deepEqual(v("one"), []);
  assert.deepEqual(v("two"), []);
  assert.equal(v("three").length, 1); // the Reddit case: rejected
  assert.deepEqual(v(""), []); // empty passes — required() owns presence
  assert.deepEqual(v(null), []);
  assert.deepEqual(v(undefined), []);

  const numeric = oneOf([1, 2]);
  assert.deepEqual(numeric(1), []);
  assert.equal(numeric("1").length, 1); // no coercion: string ≠ number
});

test("eachOneOf: every array element must be whitelisted", () => {
  const v = eachOneOf(["a", "b"]);
  assert.deepEqual(v(["a"]), []);
  assert.deepEqual(v(["a", "b"]), []);
  assert.deepEqual(v([]), []); // empty passes
  assert.deepEqual(v(null), []);
  assert.equal(v(["a", "x"]).length, 1);
  assert.equal(v("not-an-array" ).length, 0); // non-arrays pass (wrong shape ≠ this validator's job)
});

test("buildDynamicFieldValidators auto-whitelists declared options", () => {
  const select = buildDynamicFieldValidators({
    name: "plan",
    kind: "select",
    options: [
      { value: "one", label: "One" },
      { value: "two", label: "Two" },
    ],
  });
  // Every validator the builder produced, not the first one: they are always applied as a set, and
  // a test that indexes into them asserts their order rather than their effect.
  const errorsFrom = (built, value) => built.validators.flatMap((validator) => validator(value));
  assert.deepEqual(errorsFrom(select, "one"), []);
  assert.equal(errorsFrom(select, "three").length, 1);

  const radio = buildDynamicFieldValidators({
    name: "r",
    kind: "radio",
    options: [{ value: 1, label: "One" }],
  });
  assert.equal(errorsFrom(radio, 2).length, 1);

  const multi = buildDynamicFieldValidators({
    name: "tags",
    kind: "multiselect",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });
  assert.deepEqual(errorsFrom(multi, ["a", "b"]), []);
  assert.equal(errorsFrom(multi, ["a", "x"]).length, 1);

  // A non-option kind gets no whitelist, but it does guard its own shape: a text field handed a
  // number is a value from outside the widget, exactly as an option outside the list is.
  const text = buildDynamicFieldValidators({ name: "t", kind: "text" });
  assert.deepEqual(errorsFrom(text, "anything"), []);
  assert.equal(errorsFrom(text, 42).length, 1);
});

test("dynamic form end-to-end: out-of-options initial value is invalid at creation", () => {
  // An LLM/CMS config with a hallucinated initial value must not produce a
  // "valid" form — the auto-whitelist catches it immediately.
  const fields = parseDynamicFields([
    {
      name: "plan",
      kind: "select",
      initialValue: "three",
      options: [
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
      ],
    },
  ]);
  const { validators } = buildDynamicFieldValidators(fields[0]);
  const form = createForm({ plan: field("three", validators) });
  assert.equal(form.state.valid(), false);
  assert.match(form.f.plan.errors()[0].message, /must be one of/);
  form.f.plan.set("two");
  assert.equal(form.state.valid(), true);
});

test("draft persistence skips nested File values", {
  skip: typeof File === "undefined",
}, async () => {
  const data = new Map();
  const storage = {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };

  const form = createForm(
    { attachment: field(null), note: field("") },
    { draft: { key: "nested-file", storage, debounceMs: 1 } },
  );
  await tick();
  form.f.attachment.set({
    nested: { file: new File(["x"], "a.txt") },
  });
  form.f.note.set("keep-me");
  await tick();
  await new Promise((r) => setTimeout(r, 10));

  const stored = data.get("nested-file");
  assert.ok(stored.includes("keep-me"));
  assert.ok(!stored.includes("attachment"));
});

test("engine rejects reserved path segments", () => {
  const form = createForm({ name: field("") });
  assert.throws(
    () => form.getField("__proto__.admin"),
    /Invalid field path/,
  );
});

test("assertSafeDynamicFieldNames refuses a path no form can hold, and passes one it can", () => {
  // A name is a path. What is refused is a path with nothing in a segment, a prototype key, the id
  // delimiter, or an identity already taken — never the separator itself.
  const refused = [
    [{ name: "", kind: "text" }, /name/],
    [{ name: "__proto__", kind: "text" }, /__proto__/],
    [{ name: "prototype", kind: "text" }, /prototype/],
    [{ name: "shipping..city", kind: "text" }, /shipping\.\.city/],
    [{ name: "lines.__proto__.name", kind: "text" }, /__proto__/],
    [{ name: "constructor", kind: "text" }, /constructor/],
    [{ name: "a__label", kind: "text" }, /a__label/],
  ];
  for (const [field, message] of refused) {
    assert.throws(() => assertSafeDynamicFieldNames([field]), message, `accepted ${JSON.stringify(field.name)}`);
  }

  assert.throws(() => assertSafeDynamicFieldNames([{ name: "x", kind: "text" }, { name: "x", kind: "text" }]), /x/);

  // A rule that refuses more than it was given is the usual way of breaking what it protects.
  assert.doesNotThrow(() =>
    assertSafeDynamicFieldNames([
      { name: "email", kind: "text" },
      { name: "line_1", kind: "text" },
      { name: "addressLine2", kind: "text" },
      { name: "zip5", kind: "text" },
      { name: "prototypeName", kind: "text" },
      { name: "a_b", kind: "text" },
      // A name is a path: a flattened document names a nested field this way, and every segment of
      // this one is a name the form can hold.
      { name: "shipping.city", kind: "text" },
      { name: "lines.12.name", kind: "text" },
    ]),
  );
});

test("parseDynamicFields drops malformed and duplicate entries", () => {
  const parsed = parseDynamicFields([
    { name: "email", kind: "email", validators: { required: true } },
    { name: "email", kind: "text" },
    { name: "broken-dot.path", kind: "text" },
    { name: "num", kind: "number", min: 10, max: 1 },
    { name: "sel", kind: "select", options: [{ value: 1, label: "One" }] },
    { name: "badOptions", kind: "select", options: [{ label: "Missing" }] },
    { name: "v", kind: "text", validators: { minLength: 5, maxLength: 1 } },
  ]);

  assert.equal(parsed.length, 2);
  assert.deepEqual(
    parsed.map((field) => field.name),
    ["email", "sel"],
  );
});

test("draft persistence excludes BigInt-bearing fields instead of mutating their type", async () => {
  const data = new Map();
  const storage = {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };

  const form = createForm(
    { meta: field({}), note: field("") },
    { draft: { key: "bigint", storage, debounceMs: 1 } },
  );

  // A JSON round-trip would restore count as a string — the field must be
  // skipped entirely rather than silently changing type.
  form.f.meta.set({ count: BigInt(42) });
  form.f.note.set("kept");
  await tick();
  await new Promise((r) => setTimeout(r, 10));

  const stored = data.get("bigint");
  assert.ok(stored);
  assert.ok(!stored.includes("count"));
  assert.ok(stored.includes('"note":"kept"'));
});

test("draft persistence skips circular values without throwing", async () => {
  const data = new Map();
  const storage = {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };

  const form = createForm(
    { meta: field({}) },
    { draft: { key: "cycle", storage, debounceMs: 1 } },
  );

  const cyclic = {};
  cyclic.self = cyclic;
  form.f.meta.set(cyclic);
  await tick();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(data.has("cycle"), false);
});

test("draft write is idempotent for semantically identical values", async () => {
  const data = new Map();
  const storage = {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };

  const form = createForm(
    { email: field(""), name: field("") },
    { draft: { key: "idempotent", storage, debounceMs: 1 } },
  );
  await tick();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(data.has("idempotent"), false);

  form.f.name.set("Bob");
  await tick();
  await new Promise((r) => setTimeout(r, 10));
  const firstWrite = data.get("idempotent");
  assert.ok(firstWrite);

  // Setting the same value again (new string instance) must not rewrite.
  form.f.name.set("Bob");
  await tick();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(data.get("idempotent"), firstWrite);

  // Re-setting an unchanged field must also not rewrite.
  form.f.email.set("");
  await tick();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(data.get("idempotent"), firstWrite);
});

test("buildDateLocale produces complete locale bundles", () => {
  const locale = buildDateLocale("en-US");
  assert.equal(locale.locale, "en-US");
  assert.equal(locale.monthNamesLong.length, 12);
  assert.equal(locale.monthNamesShort.length, 12);
  assert.equal(locale.dayNamesNarrow.length, 7);
  assert.equal(locale.dayNamesShort.length, 7);
  assert.ok(locale.firstDayOfWeek >= 0 && locale.firstDayOfWeek <= 6);
});

test("parseDynamicForm validates v2 layout and rules in strict/lenient modes", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const valid = parseDynamicForm({
    version: 2,
    fields: [
      { name: "type", kind: "select", options: [{ value: "business", label: "Business" }] },
      { name: "vat", kind: "text" },
    ],
    layout: [{ kind: "section", id: "identity", children: ["type", "vat"] }],
    rules: [{ effect: "visible", target: "vat", when: { field: "type", operator: "equals", value: "business" } }],
  }, { mode: "strict" });
  assert.equal(valid.ok, true);
  assert.equal(valid.version, 2);
  assert.equal(valid.layout.length, 1);
  assert.equal(valid.rules.length, 1);

  const bad = parseDynamicForm({
    version: 2,
    fields: [{ name: "email", kind: "email" }],
    layout: [{ kind: "section", id: "bad", children: ["missing"] }],
  }, { mode: "strict" });
  assert.equal(bad.ok, false);
  assert.equal(bad.fields.length, 0);
  assert.equal(bad.diagnostics[0].code, "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE");
});

test("a collected diagnostic is not also written to the console", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const spoken = [];
  const warn = console.warn;
  console.warn = (...args) => spoken.push(args.join(" "));

  try {
    const collected = parseDynamicForm({
      version: 2,
      fields: [{ name: "plan", kind: "select" }],
    });
    assert.equal(collected.diagnostics.length, 1, "the finding still reaches the caller");
    assert.deepEqual(spoken, [], "the same finding was duplicated onto the console");

    // Without a sink the console is the only channel the finding has, so it keeps it.
    parseDynamicFields([{ name: "plan", kind: "select" }]);
    assert.equal(spoken.length, 1, "a caller collecting nothing was left with nothing");
  } finally {
    console.warn = warn;
  }
});

test("Contract v2 layout nests: a columns row inside a section", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const fields = [
    { name: "street", kind: "text" },
    { name: "city", kind: "text" },
    { name: "zip", kind: "text" },
  ];
  const nested = parseDynamicForm({
    version: 2,
    fields,
    layout: [{
      kind: "section",
      id: "address",
      label: "Address",
      children: ["street", { kind: "columns", id: "cityZip", columns: [["city"], ["zip"]] }],
    }],
  }, { mode: "strict" });

  assert.equal(nested.ok, true);
  assert.equal(nested.layout.length, 1);
  const [section] = nested.layout;
  assert.equal(section.children[0], "street");
  assert.equal(section.children[1].kind, "columns");
  assert.deepEqual(section.children[1].columns, [["city"], ["zip"]]);
});

test("Contract v2 layout rejects a field placed in two slots", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  // The same field twice would render twice and bind one value to both controls.
  const duplicated = parseDynamicForm({
    version: 2,
    fields: [{ name: "city", kind: "text" }, { name: "zip", kind: "text" }],
    layout: [
      { kind: "columns", id: "row", columns: [["city"], ["zip"]] },
      { kind: "section", id: "again", children: ["city"] },
    ],
  }, { mode: "strict" });

  assert.equal(duplicated.ok, false);
  assert.equal(duplicated.diagnostics[0].code, "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE");
});

test("Contract v2 layout rejects nesting past the depth cap", async () => {
  const { parseDynamicForm, MDY_LAYOUT_MAX_DEPTH } = await import("../dist/dynamic-config.js");
  let node = { kind: "section", id: "leaf", children: ["city"] };
  for (let depth = 0; depth < MDY_LAYOUT_MAX_DEPTH + 1; depth += 1) {
    node = { kind: "section", id: `wrap${depth}`, children: [node] };
  }
  const tooDeep = parseDynamicForm(
    { version: 2, fields: [{ name: "city", kind: "text" }], layout: [node] },
    { mode: "strict" },
  );

  assert.equal(tooDeep.ok, false);
  // The code names the depth, not a field. It used to say UNKNOWN_FIELD_REFERENCE, which sent an
  // author looking for a misspelled name while every name in the document was correct.
  assert.equal(tooDeep.diagnostics[0].code, "MDY_DYNAMIC_INVALID_LAYOUT");
  assert.match(tooDeep.diagnostics[0].message, /nests deeper/);
});

test("Contract v2 recursively flattens group and array nodes", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const result = parseDynamicForm({
    version: 2,
    schema: { node: "group", children: {
      shipping: { node: "group", children: {
        city: { node: "field", field: { kind: "text", label: "City", validators: { required: true } } },
      } },
      items: { node: "array", initialValue: [{ sku: "A", qty: 2 }], item: {
        node: "group", children: {
          sku: { node: "field", field: { kind: "text", label: "SKU" } },
          qty: { node: "field", field: { kind: "number", label: "Qty", min: 1 } },
        },
      } },
    } },
  }, { mode: "strict" });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.fields.map((field) => field.name), ["shipping.city", "items.0.sku", "items.0.qty"]);
  assert.equal(result.fields.find((field) => field.name === "items.0.qty")?.initialValue, 2);
});

test("a columns row may be authored per breakpoint, and hostile counts are rejected", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const document = (at) => ({
    version: 2,
    fields: [{ name: "a", kind: "text" }, { name: "b", kind: "text" }],
    layout: [{ kind: "columns", id: "row", columns: [["a"], ["b"]], ...(at ? { at } : {}) }],
  });

  const accepted = parseDynamicForm(document({ base: 1, sm: 2, lg: 4 }), { mode: "strict" });
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.layout[0].at, { base: 1, sm: 2, lg: 4 });

  // A track count reaches the renderer as a custom property, so it is checked like any other
  // untrusted number rather than trusted because it arrived inside a layout.
  for (const hostile of [{ sm: 0 }, { sm: -2 }, { sm: 1.5 }, { sm: 99 }, { xl: 2 }, { sm: "2" }, "two"]) {
    const result = parseDynamicForm(document(hostile), { mode: "strict" });
    assert.equal(result.ok, false, `accepted ${JSON.stringify(hostile)}`);
  }

  // A row that says nothing is still valid: it stacks, then takes its declared tracks.
  assert.equal(parseDynamicForm(document(null), { mode: "strict" }).ok, true);
});

test("Contract v3 parses a slot that moves and hides per breakpoint", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const result = parseDynamicForm({
    version: 3,
    fields: [{ name: "a", kind: "text" }, { name: "b", kind: "text" }],
    layout: [{
      kind: "columns",
      id: "row",
      columns: [
        [{ ref: "a", at: { md: { column: 2 } } }],
        [{ ref: "b", at: { base: { hidden: true }, lg: { column: 1, hidden: false } } }],
      ],
    }],
  }, { mode: "strict" });

  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.version, 3);
  assert.deepEqual(result.layout[0].columns[0][0], { ref: "a", at: { md: { column: 2 } } });
  assert.equal(result.layout[0].columns[1][0].at.base.hidden, true);
});

test("Contract v3 slots stay mixable with plain names, and v2 keeps parsing", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const fields = [{ name: "a", kind: "text" }, { name: "b", kind: "text" }];

  // A name and a slot side by side: v3 adds a way to say more, it does not require saying it.
  const mixed = parseDynamicForm({
    version: 3,
    fields,
    layout: [{ kind: "columns", id: "row", columns: [["a"], [{ ref: "b", at: { sm: { hidden: true } } }]] }],
  }, { mode: "strict" });
  assert.equal(mixed.ok, true, JSON.stringify(mixed.diagnostics));

  // The same document as v2 is unchanged by v3 existing.
  const v2 = parseDynamicForm({
    version: 2,
    fields,
    layout: [{ kind: "columns", id: "row", columns: [["a"], ["b"]], at: { sm: 2 } }],
  }, { mode: "strict" });
  assert.equal(v2.ok, true);
  assert.equal(v2.version, 2);
});

test("a v3 slot is refused by a v2 document, and hostile placement is refused everywhere", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const fields = [{ name: "a", kind: "text" }, { name: "b", kind: "text" }];
  const document = (version, slot) => ({
    version,
    fields,
    layout: [{ kind: "columns", id: "row", columns: [["a"], [slot]] }],
  });

  // A v2 reader has never heard of `ref`. Accepting it here would make this parser disagree with
  // every other reader of the same bytes about what the contract says.
  assert.equal(parseDynamicForm(document(2, { ref: "b", at: { sm: { hidden: true } } }), { mode: "strict" }).ok, false);

  for (const hostile of [
    { ref: "nope" },                          // a field that does not exist
    { ref: "a" },                             // already placed by the first column
    { ref: "b", at: { sm: { column: 0 } } },  // columns are 1-based
    { ref: "b", at: { sm: { column: 3 } } },  // past the row's two tracks
    { ref: "b", at: { sm: { column: 1.5 } } },
    { ref: "b", at: { xl: { column: 1 } } },  // not a size the layout knows
    { ref: "b", at: { sm: { hidden: "yes" } } },
    { ref: "b", at: { sm: {} } },             // a size that says nothing is a typo, not a no-op
    { ref: "b", at: "everywhere" },
  ]) {
    const result = parseDynamicForm(document(3, hostile), { mode: "strict" });
    assert.equal(result.ok, false, `accepted ${JSON.stringify(hostile)}`);
  }

  // A section has no tracks, so there is no element a placement could act on. Accepting it would
  // have been a silent no-op in every renderer, which is the failure this refusal exists to prevent.
  const inSection = (child) => ({
    version: 3,
    fields,
    layout: [{ kind: "section", id: "sec", children: [child] }],
  });
  assert.equal(parseDynamicForm(inSection({ ref: "a", at: { sm: { hidden: true } } }), { mode: "strict" }).ok, false);
  assert.equal(parseDynamicForm(inSection({ ref: "a", at: { sm: { column: 1 } } }), { mode: "strict" }).ok, false);
  // A slot with nothing to place is just a field name written longhand, and is fine anywhere.
  assert.equal(parseDynamicForm(inSection({ ref: "a" }), { mode: "strict" }).ok, true);

  // `at` on the row may widen it, and a slot may then name the wider column.
  const widened = {
    version: 3,
    fields,
    layout: [{ kind: "columns", id: "row", columns: [["a"], [{ ref: "b", at: { lg: { column: 4 } } }]], at: { lg: 4 } }],
  };
  assert.equal(parseDynamicForm(widened, { mode: "strict" }).ok, true);
});

test("a section occupying a column may be placed; one at the top of the layout may not", async () => {
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const fields = [{ name: "a", kind: "text" }, { name: "b", kind: "text" }];
  const section = (at) => ({ kind: "section", id: "sec", children: ["b"], ...(at ? { at } : {}) });

  // In a row the section is the column, so it is placed exactly as a slot is.
  const inRow = parseDynamicForm({
    version: 3,
    fields,
    layout: [{ kind: "columns", id: "row", columns: [["a"], [section({ base: { hidden: true }, md: { column: 2 } })]] }],
  }, { mode: "strict" });
  assert.equal(inRow.ok, true, JSON.stringify(inRow.diagnostics));

  // At the top of the layout it occupies no column, so there is nothing to place it in.
  const topLevel = parseDynamicForm({
    version: 3, fields, layout: [section({ md: { hidden: true } })],
  }, { mode: "strict" });
  assert.equal(topLevel.ok, false);
  assert.equal(topLevel.diagnostics[0].code, "MDY_DYNAMIC_INVALID_LAYOUT");

  // Unplaced, it is the section it has always been — at any version.
  assert.equal(parseDynamicForm({ version: 3, fields, layout: [section(null)] }, { mode: "strict" }).ok, true);
  assert.equal(parseDynamicForm({ version: 2, fields, layout: [section(null)] }, { mode: "strict" }).ok, true);
  // And below v3 the key does not exist, so a v2 document carrying one is refused like any slot.
  const v2WithPlacement = parseDynamicForm({
    version: 2,
    fields,
    layout: [{ kind: "columns", id: "row", columns: [["a"], [section({ md: { hidden: true } })]] }],
  }, { mode: "strict" });
  assert.equal(v2WithPlacement.ok, false);
});

test("the shared v3 fixture parses here, as it does in the Rust and Java SDKs", async () => {
  // One document, three implementations. A v3 envelope is what a layout placing a slot per
  // breakpoint produces, and it is the shape an SDK is most likely to refuse — on the version
  // alone, or by falling through every branch of its envelope check. This fixture is what stops the
  // three drifting: `sdk/rust/.../tests/contract.rs` and `MdyDynamicFormParserTest` read it too.
  const { parseDynamicForm } = await import("../dist/dynamic-config.js");
  const { readFileSync } = await import("node:fs");
  const raw = JSON.parse(
    readFileSync(new URL("../../../spec/fixtures/dynamic-form/v3/placement.json", import.meta.url), "utf8"),
  );

  const result = parseDynamicForm(raw, { mode: "strict" });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.version, 3);
  assert.equal(result.fields.length, 5);

  const [row, body] = result.layout;
  assert.deepEqual(row.at, { sm: 2 }, "v2's track counts still ride a v3 document");
  assert.deepEqual(row.columns[1][0], {
    ref: "last",
    at: { base: { hidden: true }, md: { column: 2, hidden: false } },
  });
  // A section occupying a column carries that column's placement.
  assert.equal(body.columns[0][0].kind, "section");
  assert.deepEqual(body.columns[0][0].at, { base: { hidden: true } });
});

test("parseDynamicFields keeps usable calendar options and drops unusable ones", () => {
  const parsed = parseDynamicFields([
    { name: "ok", kind: "datepicker", locale: "it-IT", firstDayOfWeek: 1, minDate: "2026-01-01", maxDate: "2026-12-31" },
    { name: "bare", kind: "datepicker" },
    { name: "range", kind: "daterange", locale: "de-DE" },
    // A malformed tag does not degrade: Intl throws a RangeError, so a config carrying one would
    // take the form down at mount rather than render an approximate calendar.
    { name: "badLocale", kind: "datepicker", locale: "en_US" },
    { name: "emptyLocale", kind: "datepicker", locale: "" },
    { name: "badDay", kind: "datepicker", firstDayOfWeek: 7 },
    { name: "fractionalDay", kind: "datepicker", firstDayOfWeek: 1.5 },
    { name: "badMin", kind: "datepicker", minDate: "01/01/2026" },
    { name: "impossibleDate", kind: "datepicker", minDate: "2026-02-30" },
    { name: "inverted", kind: "datepicker", minDate: "2026-12-31", maxDate: "2026-01-01" },
  ]);

  assert.deepEqual(parsed.map((field) => field.name), ["ok", "bare", "range"]);
  assert.equal(parsed[0].locale, "it-IT");
  assert.equal(parsed[0].minDate, "2026-01-01");
  // Unset stays unset rather than being filled in with a default the form never asked for.
  assert.equal(parsed[1].locale, undefined);
  assert.equal(parsed[1].firstDayOfWeek, undefined);
});

test("a declared locale survives the parser and is the one a renderer would use", () => {
  const [field] = parseDynamicFields([{ name: "when", kind: "datepicker", locale: "it-IT" }]);
  // The tag is only worth keeping if it is one `buildDateLocale` accepts — the parser's guarantee
  // and the consumer's expectation are the same guarantee.
  assert.equal(buildDateLocale(field.locale).firstDayOfWeek, 1);
  assert.equal(buildDateLocale("en-US").firstDayOfWeek, 0);
});

test("a schema key that spells a path is the structure that path describes", () => {
  // A name is a path everywhere else — `claimField("shipping.city")` registers a field inside
  // `shipping` — and the engine stores every value flat by path and reads it back unflattened. A
  // schema keyed by the literal string would describe a shape no read can produce.
  const form = createForm({ country: field("IT"), "shipping.city": field("Roma") });
  form.activate();
  assert.deepEqual(form.getValue(), { country: "IT", shipping: { city: "Roma" } });
  assert.equal(form.f.shipping.city.value(), "Roma", "the handle tree kept the flat spelling");

  form.f.shipping.city.set("Milano");
  assert.deepEqual(form.getValue(), { country: "IT", shipping: { city: "Milano" } });
  form.deactivate();
});

test("a path is normalized wherever a schema is written, not only at the root", () => {
  const nested = createForm({ o: group({ "shipping.city": field("MI") }) });
  nested.activate();
  assert.deepEqual(nested.getValue(), { o: { shipping: { city: "MI" } } });
  nested.deactivate();

  // A collection stays a collection: its item is a schema of its own, and rows still read as a list.
  const rows = createForm({ rows: array(group({ "a.b": field("x") }), { initial: [{}, {}] }) });
  rows.activate();
  assert.deepEqual(rows.getValue(), { rows: [{ a: { b: "x" } }, { a: { b: "x" } }] });
  rows.deactivate();
});

test("two declarations of the same group are one group, in either order", () => {
  const after = createForm({ shipping: group({ zip: field("20100") }), "shipping.city": field("Milano") });
  after.activate();
  assert.deepEqual(after.getValue(), { shipping: { zip: "20100", city: "Milano" } });
  after.deactivate();

  const before = createForm({ "shipping.city": field("Milano"), shipping: group({ zip: field("20100") }) });
  before.activate();
  assert.deepEqual(before.getValue(), { shipping: { city: "Milano", zip: "20100" } });
  before.deactivate();
});

test("normalizing a schema does not write into the schema it was given", () => {
  // A schema is usually a module constant, and a path passing through a group the caller declared
  // must not add a child to the object they wrote: it would gain members they never declared, and
  // the next form built from it would find the name already taken.
  const SCHEMA = { g: group({ z: field("") }), "g.y": field("") };
  const first = createForm(SCHEMA);
  first.activate();
  assert.deepEqual(Object.keys(SCHEMA.g.children), ["z"], "the caller's group gained a child");

  const second = createForm(SCHEMA);
  second.activate();
  assert.deepEqual(second.getValue(), { g: { z: "", y: "" } }, "a second form from the same schema");
  first.deactivate();
  second.deactivate();

  // The copy has to reach every level a path passes through, not only the first.
  const DEEP = { o: group({ inner: group({ k: field("1") }) }), "o.inner.j": field("2") };
  const deep = createForm(DEEP);
  deep.activate();
  assert.deepEqual(Object.keys(DEEP.o.children.inner.children), ["k"], "a nested group gained a child");
  assert.deepEqual(deep.getValue(), { o: { inner: { k: "1", j: "2" } } });
  deep.deactivate();
});

test("a name that is both a field and a group is refused, not silently resolved", () => {
  // Nothing can be a value and hold children at once, and picking one for the caller would drop the
  // other without saying so.
  assert.throws(() => createForm({ a: field(""), "a.b": field("") }), /"a"/);
  assert.throws(() => createForm({ "a.b": field(""), a: field("") }), /"a"/);
});

/**
 * A verdict that decides `valid` is readable somewhere.
 *
 * A form-level validator attributes errors to field paths, and a keyed collection's paths are data:
 * a rule about rows names one, and the row can leave while the rule still names it. The error keeps
 * deciding validity, so dropping it from every read leaves a form that will not submit and cannot
 * say why — the one state a consumer cannot render. Server errors already surface at the form when
 * their path matches no field; cross-field errors now do the same.
 */
test("a cross-field error naming no live field surfaces at the form", async () => {
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { validators: [() => [{ path: "rows.a.code", kind: "range", message: "bad code" }]] },
  );

  form.f.rows.upsert("a", { code: "C" });
  await tick();
  assert.equal(form.state.valid(), false);
  assert.equal(form.errorsFor("rows.a.code")().length, 1, "while the row exists it reads at its own path");

  form.f.rows.remove("a");
  await tick();
  assert.equal(form.state.valid(), false, "the rule still says the form is invalid");
  assert.deepEqual(
    form.errorsFor("")().map((error) => error.message),
    ["bad code"],
    "and the form's own bucket is where it can be read",
  );
});

test("oneOf: an object option is recognised by what it holds, not by which copy it is", () => {
  // A draft is written as JSON and read back as JSON, so the value that comes back is a different
  // object holding the same data. Compared by identity, a user who left a form half-filled and came
  // back was told their own choice is not on the list.
  const OPTIONS = [{ id: 1, label: "One" }, { id: 2, label: "Two" }];
  const v = oneOf(OPTIONS);

  assert.deepEqual(v(OPTIONS[0]), []);
  assert.deepEqual(v(JSON.parse(JSON.stringify(OPTIONS[0]))), [], "a round-tripped choice was refused");
  assert.deepEqual(v({ label: "One", id: 1 }), [], "key order decided whether a choice was offered");
});

test("oneOf: the guard still refuses what was never offered", () => {
  // The reason oneOf exists. Every one of these is a value no option list contained, and structural
  // comparison must not turn "looks like an option" into "is one".
  const OPTIONS = [{ id: 1, label: "One" }, { id: 2, label: "Two" }];
  const v = oneOf(OPTIONS);

  assert.equal(v({ id: 3, label: "Three" }).length, 1, "an option that was never offered");
  assert.equal(v({ id: 1 }).length, 1, "a member missing");
  assert.equal(v({ id: 1, label: "One", admin: true }).length, 1, "a member added");
  assert.equal(v({ id: "1", label: "One" }).length, 1, "a member of the wrong type");
  assert.equal(v("One").length, 1, "the label alone is not the option");
  assert.equal(v({ id: 1, label: "one" }).length, 1, "a member differing in case");
});

test("oneOf: only what JSON round-trips is compared structurally", () => {
  // A class instance is not data this can claim to recognise a copy of, so it keeps identity — the
  // behaviour every option had before objects were compared at all.
  class Choice {
    constructor(id) { this.id = id; }
  }
  const offered = new Choice(1);
  const v = oneOf([offered]);
  assert.deepEqual(v(offered), []);
  assert.equal(v(new Choice(1)).length, 1, "a copy of a class instance was accepted");

  // Arrays and dates are data, and are compared as such.
  const withArray = oneOf([{ tags: ["a", "b"] }]);
  assert.deepEqual(withArray({ tags: ["a", "b"] }), []);
  assert.equal(withArray({ tags: ["b", "a"] }).length, 1, "order inside an option stopped mattering");

  const day = new Date("2026-08-14T00:00:00.000Z");
  const withDate = oneOf([{ day }]);
  assert.deepEqual(withDate({ day: new Date("2026-08-14T00:00:00.000Z") }), []);
  assert.equal(withDate({ day: new Date("2026-08-15T00:00:00.000Z") }).length, 1);
});

test("eachOneOf: a multiselect survives the same round trip, and refuses the same forgeries", () => {
  const OPTIONS = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const v = eachOneOf(OPTIONS);

  assert.deepEqual(v(JSON.parse(JSON.stringify([OPTIONS[0], OPTIONS[2]]))), []);
  assert.equal(v([{ id: 1 }, { id: 9 }]).length, 1, "one forged element among offered ones");
});
