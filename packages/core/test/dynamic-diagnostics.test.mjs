/**
 * A code is a name a consumer matches on; a message is prose.
 *
 * The parser derived one from the other by substring match, so rewording an English sentence renamed
 * a code somebody was keying on and nothing in a build objected. The table is the coupling written
 * down; these are the checks that it still holds.
 *
 * Every entry is driven by a document that must produce it. A table row nobody can reach is a claim
 * about the parser, and the only way to know is to make the parser say it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_DYNAMIC_DIAGNOSTICS, applyFlatValidators, buildFlatFormSchema, createForm, parseDynamicForm } from "../dist/index.js";

/** A document refused for each named reason. */
/** The options a code needs to be produced, when the document alone cannot produce it. */
const ASKED_WITH = {
  MDY_DYNAMIC_UNKNOWN_PARSE_MODE: { mode: "STRICT" },
};

const REFUSALS = {
  MDY_DYNAMIC_UNSUPPORTED_VERSION: { version: 99, fields: [{ name: "a", kind: "text" }] },
  MDY_DYNAMIC_DUPLICATE_NAME: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }],
  MDY_DYNAMIC_UNSAFE_NAME: [{ name: "__proto__", kind: "text" }],
  MDY_DYNAMIC_UNKNOWN_KIND: [{ name: "a", kind: "wormhole" }],
  MDY_DYNAMIC_OPTIONS_REQUIRED: [{ name: "a", kind: "select" }],
  MDY_DYNAMIC_DUPLICATE_OPTION: [{
    name: "a",
    kind: "select",
    options: [{ value: "pro", label: "Pro monthly" }, { value: "pro", label: "Pro yearly" }],
  }],
  MDY_DYNAMIC_UNKNOWN_PARSE_MODE: [{ name: "a", kind: "text" }],
  // A path is the payload key and the widget id, and a document can grow one without limit.
  MDY_DYNAMIC_PATH_TOO_LONG: (() => {
    let node = { node: "field", field: { kind: "text", label: "L" } };
    for (let level = 0; level < 400; level += 1) node = { node: "group", children: { group: node } };
    return { version: 3, schema: node };
  })(),
  // A condition on a node, in the two ways a document can get one wrong: a clause that is not an
  // expression at all, and one reading a context key the envelope never declared.
  MDY_DYNAMIC_INVALID_CONDITION: {
    version: 4,
    schema: {
      node: "group",
      children: { a: { node: "field", field: { kind: "text" }, when: { nope: true } } },
    },
  },
  MDY_DYNAMIC_UNDECLARED_CONTEXT: {
    version: 4,
    schema: {
      node: "group",
      children: {
        a: {
          node: "field",
          field: { kind: "text" },
          when: { op: "equals", operands: [{ context: "role" }, "admin"] },
        },
      },
    },
  },
  MDY_DYNAMIC_CONSTRAINT_CANNOT_FAIL: [{ name: "a", kind: "slider", validators: { required: true } }],
  MDY_DYNAMIC_MISPLACED_VALIDATOR: [{ name: "a", kind: "text", required: true }],
  MDY_DYNAMIC_PATTERN_TOO_LONG: [{ name: "a", kind: "text", validators: { pattern: "x".repeat(300) } }],
  MDY_DYNAMIC_PATTERN_TOO_COSTLY: [{ name: "a", kind: "text", validators: { pattern: "(a+)+$" } }],
};

test("every named code is one the parser can actually produce", () => {
  for (const { code } of MDY_DYNAMIC_DIAGNOSTICS) {
    const document_ = REFUSALS[code];
    assert.ok(document_, `${code} has no document that produces it`);
    const { diagnostics } = parseDynamicForm(document_, ASKED_WITH[code]);
    assert.ok(
      diagnostics.some((d) => d.code === code),
      `${code} was never reported — got ${JSON.stringify(diagnostics.map((d) => d.code))}`,
    );
  }
});

test("the phrase each code is recognised by still appears in its message", () => {
  for (const { code, phrase } of MDY_DYNAMIC_DIAGNOSTICS) {
    const { diagnostics } = parseDynamicForm(REFUSALS[code], ASKED_WITH[code]);
    const reported = diagnostics.find((d) => d.code === code);
    assert.ok(
      reported && reported.message.includes(phrase),
      `${code} is recognised by "${phrase}" and its message no longer contains it`,
    );
  }
});

/**
 * `ok` is about the envelope, and the counts are about the fields.
 *
 * A document whose every field was dropped still parses: the shape was understood, and each field
 * was refused individually with a reason. So `ok` alone is not enough to decide whether there is a
 * form to mount — `rejectedCount` and `fields.length` are what say that, and a consumer reading only
 * the first mounts nothing and believes it succeeded.
 */
test("a refusal with no name of its own falls back, and says why it was refused", () => {
  const result = parseDynamicForm([{ name: "a", kind: "text", label: 42 }]);

  assert.equal(result.ok, true, "the envelope was understood, which is what `ok` reports");
  assert.equal(result.rejectedCount, 1, "the field was refused, which is what the counts report");
  assert.deepEqual(result.fields, [], "a refused field must not reach a renderer");

  assert.ok(result.diagnostics.length > 0, "a refused field reported nothing");
  for (const diagnostic of result.diagnostics) {
    assert.match(diagnostic.code, /^MDY_DYNAMIC_/);
    assert.ok(diagnostic.message.length > 0, "a diagnostic with a code and no message says nothing");
  }
  assert.equal(result.diagnostics[0].code, "MDY_DYNAMIC_INVALID_FIELD",
    "a refusal with no name of its own must still carry the fallback code");
});

test("a document that parses reports no diagnostic at all", () => {
  const { ok, diagnostics } = parseDynamicForm([{ name: "email", kind: "email", label: "Email" }]);
  assert.equal(ok, true);
  assert.deepEqual(diagnostics, []);
});

/**
 * A finding belongs to the document being read, and to no other.
 *
 * The sink is module state: one parse installs it, the next reads it. Restoring it only on the
 * happy path would mean a document that throws mid-read leaves the following parse reporting into
 * a result that has already been returned — findings attributed to a document that never produced
 * them, and a console that goes quiet for everyone.
 */
test("a finding stays with the document that produced it", async () => {
  const { collectingDiagnostics, warnDev } = await import("../dist/dynamic/guards.js");

  const outer = [];
  const seen = collectingDiagnostics((m) => outer.push(m), () => {
    const inner = [];
    assert.throws(() => collectingDiagnostics((m) => inner.push(m), () => {
      warnDev("inner finding");
      throw new Error("document abandoned mid-read");
    }), /abandoned/);
    assert.deepEqual(inner, ["inner finding"], "the abandoned read still collected its own finding");

    warnDev("outer finding");
    return "read";
  });

  assert.equal(seen, "read");
  assert.deepEqual(outer, ["outer finding"], "a nested read that threw did not keep the sink");
});

test("a pattern that backtracks exponentially is refused, and its field is kept", () => {
  // A document's pattern is a string from a CMS, a saved project or a POST. Syntax was checked and
  // cost was not, so `(a+)+$` against thirty characters and a miss took twelve seconds — a
  // synchronous match, so the whole thread, between two keystrokes.
  const parsed = parseDynamicForm([
    { name: "code", kind: "text", validators: { pattern: "(a+)+$", required: true } },
  ]);

  // The field stays: one rule the engine will not run is not a reason to take an input away.
  assert.deepEqual(parsed.fields.map((f) => f.name), ["code"]);
  assert.equal(parsed.diagnostics[0].code, "MDY_DYNAMIC_PATTERN_TOO_COSTLY");

  // And the rule really is gone, rather than reported and run anyway.
  const started = Date.now();
  const form = createForm(buildFlatFormSchema(parsed.fields), { autoActivate: false });
  applyFlatValidators(form, parsed.fields);
  form.f.code.set("a".repeat(34) + "!");
  assert.equal(form.f.code.errors().some((e) => e.kind === "pattern"), false);
  assert.ok(Date.now() - started < 1000, "the refused pattern ran anyway");
  form.destroy();
});

test("an ordinary pattern still runs, in both directions", () => {
  // The control: the refusal is about a shape, not about patterns. A document whose rule is
  // ordinary keeps it, and it still rejects what it is meant to reject.
  const parsed = parseDynamicForm([
    { name: "zip", kind: "text", validators: { pattern: "^\\d{5}$" } },
  ]);
  assert.deepEqual(parsed.diagnostics, []);

  const form = createForm(buildFlatFormSchema(parsed.fields), { autoActivate: false });
  applyFlatValidators(form, parsed.fields);
  form.f.zip.set("1234");
  assert.equal(form.f.zip.errors().length, 1, "an ordinary pattern stopped rejecting");
  form.f.zip.set("12345");
  assert.deepEqual(form.f.zip.errors(), []);
  form.destroy();
});

test("a finding names the entry it is about, not the array it is in", () => {
  // The path is what an editor underlines and what a reader is sent to. Every per-field finding
  // carried `/fields` — the line the array opens on — so a two-hundred-line document assembled by a
  // CMS pointed at the same line whichever entry was wrong, and the underline stopped being worth
  // more than the console message.
  const at = (fields) => parseDynamicForm(fields).diagnostics.map((d) => [d.code, d.path]);

  assert.deepEqual(
    at([{ name: "a", kind: "text" }, { name: "b", kind: "text" }, { name: "c", kind: "wormhole" }]),
    [["MDY_DYNAMIC_UNKNOWN_KIND", "/fields/2"]],
  );
  assert.deepEqual(
    at([{ name: "a", kind: "text" }, { name: "__proto__", kind: "text" }]),
    [["MDY_DYNAMIC_UNSAFE_NAME", "/fields/1"]],
  );

  // A duplicate names the *second* occurrence: the first is legitimate until the second exists, and
  // the second is the one a reader has to change.
  assert.deepEqual(
    at([{ name: "a", kind: "text" }, { name: "b", kind: "text" }, { name: "a", kind: "text" }]),
    [["MDY_DYNAMIC_DUPLICATE_NAME", "/fields/2"]],
  );

  // A version this reader does not have is about the version, not about the list: a document from a
  // publisher one version ahead sent its reader hunting for a broken field it does not have.
  assert.deepEqual(
    parseDynamicForm({ version: 99, fields: [{ name: "a", kind: "text" }] }).diagnostics
      .map((d) => [d.code, d.path]),
    [["MDY_DYNAMIC_UNSUPPORTED_VERSION", "/version"]],
  );
});

test("a member a version predates is named, not ignored", () => {
  // Version 1 is a flat field list and nothing else: `layout`, `rules` and `validations` are not in
  // its vocabulary. Dropped in silence, an author who wrote rules against the wrong version number
  // got a document the parser called clean, a lint with nothing to report, and a form where the
  // rules simply were not there — the three places they could have learned, all quiet.
  const v1 = (extra) => ({
    version: 1,
    id: "f",
    fields: [{ name: "x", kind: "text", label: "X" }],
    ...extra,
  });
  const rule = { effect: "hidden", target: "x", when: { field: "x", operator: "equals", value: "a" } };

  for (const [slot, extra] of Object.entries({
    rules: { rules: [rule] },
    layout: { layout: [{ kind: "section", id: "s", children: ["x"] }] },
    validations: { validations: [{ when: { op: "equals", operands: [{ path: "x" }, "a"] }, message: "no" }] },
  })) {
    const parsed = parseDynamicForm(v1(extra), { mode: "lenient" });
    const named = parsed.diagnostics.filter((each) => each.path === `/${slot}`);
    assert.equal(named.length, 1, `${slot} was dropped without a word`);
    assert.equal(named[0].code, "MDY_DYNAMIC_UNSUPPORTED_VERSION");
  }

  // The control, and it is what makes the three above about the member rather than about version 1:
  // a v1 document that stays inside its own vocabulary parses clean in the strictest mode there is.
  assert.equal(parseDynamicForm(v1({}), { mode: "strict" }).ok, true);

  // And the same members at the version that has them are read, not reported.
  const v2 = parseDynamicForm({
    version: 2,
    id: "f",
    fields: [{ name: "x", kind: "text", label: "X" }],
    rules: [rule],
  }, { mode: "strict" });
  assert.equal(v2.ok, true);
  assert.equal(v2.rules.length, 1);
});
