/**
 * The "decisive test" of the domain-model extraction: the whole form engine
 * runs in plain Node — no framework, no DI, no DOM.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDateLocale,
  buildDynamicFieldValidators,
  buildDynamicValidators,
  createForm,
  crossField,
  eachOneOf,
  field,
  group,
  min,
  oneOf,
  parseDynamicFields,
  required,
} from "../dist/index.js";

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

test("oneOf: whitelists scalar values, empties pass, Object.is semantics", () => {
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
  const [check] = select.validators;
  assert.deepEqual(check("one"), []);
  assert.equal(check("three").length, 1);

  const radio = buildDynamicFieldValidators({
    name: "r",
    kind: "radio",
    options: [{ value: 1, label: "One" }],
  });
  assert.equal(radio.validators[0](2).length, 1);

  const multi = buildDynamicFieldValidators({
    name: "tags",
    kind: "multiselect",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });
  assert.deepEqual(multi.validators[0](["a", "b"]), []);
  assert.equal(multi.validators[0](["a", "x"]).length, 1);

  // Non-option kinds are untouched.
  const text = buildDynamicFieldValidators({ name: "t", kind: "text" });
  assert.equal(text.validators.length, 0);
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
