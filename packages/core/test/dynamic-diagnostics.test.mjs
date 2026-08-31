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
  // Seven does not divide sixty, so the rule the author wrote — "every seven minutes" — is not the
  // one the field would enforce: it offers 0, 7 … 56 and then jumps four minutes into the next hour.
  MDY_DYNAMIC_UNHONOURABLE_GRANULARITY: [{ name: "a", kind: "timepicker", granularity: { minuteStep: 7 } }],
  // A clock is one of two, and a third name is not a clock this contract draws.
  MDY_DYNAMIC_UNHONOURABLE_FORMAT: [{ name: "a", kind: "timepicker", format: "36h" }],
  // A picker has two views and a third name is not one of them.
  MDY_DYNAMIC_UNOPENABLE_VIEW: [{ name: "a", kind: "timepicker", viewMode: "sundial" }],
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
  // More declarations than the count walks. What it reports then is a floor, and saying so is the
  // difference between a number a host can act on and one that quietly saturates.
  // A member nobody declared, in the slot a document is most often assembled by hand: the parser is
  // the only one of the three checks a stored or generated document ever meets.
  MDY_DYNAMIC_UNKNOWN_MEMBER: [{ name: "a", kind: "text", nonsenseKey: 1 }],
  MDY_DYNAMIC_COUNT_INCOMPLETE: (() => {
    const children = {};
    for (let index = 0; index <= 100_000; index += 1) {
      children[`f${index}`] = { node: "field", field: { kind: "text" } };
    }
    return { version: 3, schema: { node: "group", children } };
  })(),
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
 * `ok` is false as soon as anything was graded an error, and the counts say how much survived.
 *
 * A document whose every field was dropped still parses in the sense that its shape was understood
 * and each field was refused with a reason — but nothing about that is a success, and a result that
 * grades a diagnostic an error while reporting `ok: true` contradicts itself. The counts remain the
 * finer answer: `ok` says whether anything was lost, `rejectedCount` and `fields.length` say what.
 */
test("a refusal with no name of its own falls back, and says why it was refused", () => {
  const result = parseDynamicForm([{ name: "a", kind: "text", label: 42 }]);

  assert.equal(result.ok, false, "a refusal is an error, and `ok` does not survive one");
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

/**
 * The refusal a document that worked yesterday will meet.
 *
 * ADR 0136 stops this runtime accepting `version: 1`, because a version the other two refuse is not a
 * version the contract has. The record states what the refusal owes and says no gate reads a message,
 * so this is that gate: the version refused, the versions accepted, and the one-line migration.
 */
test("refusing version one says which version, which versions it has, and what to write instead", () => {
  const refused = parseDynamicForm({ version: 1, fields: [{ name: "a", kind: "text" }] });

  assert.equal(refused.ok, false, "a version this contract does not have built a form");
  assert.deepEqual(refused.fields, [], "a refused document handed fields over anyway");
  assert.deepEqual(
    refused.diagnostics.map((each) => [each.code, each.path]),
    [["MDY_DYNAMIC_UNSUPPORTED_VERSION", "/version"]],
  );

  const said = refused.diagnostics[0].message;
  assert.match(said, /\b1\b/, "the refusal does not name the version it refused");
  assert.match(said, /2, 3 and 4/, "the refusal does not name the versions it has");
  assert.match(said, /"version": 2/, "the refusal does not say what to write instead");
});

/** The shape most callers pass declares no version at all, and it is not what was refused. */
test("a bare field array is read, not refused", () => {
  const parsed = parseDynamicForm([{ name: "a", kind: "text" }]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.fields.length, 1);
});

test("a member a version predates is named, not ignored", () => {
  // The member that arrived with version 4, on a document that says 2. Dropped in silence, an author
  // who wrote it against the wrong version number got a document the parser called clean, a lint with
  // nothing to report, and a form that read no context — the three places they could have learned,
  // all quiet.
  const predates = parseDynamicForm({
    version: 2,
    id: "f",
    fields: [{ name: "x", kind: "text", label: "X" }],
    requiresContext: ["role"],
  }, { mode: "lenient" });
  const named = predates.diagnostics.filter((each) => each.path === "/requiresContext");
  assert.equal(named.length, 1, "requiresContext was dropped without a word");
  assert.equal(named[0].code, "MDY_DYNAMIC_UNSUPPORTED_VERSION");

  // The control: the same member at the version that has it is read, not reported.
  const v4 = parseDynamicForm({
    version: 4,
    id: "f",
    fields: [{ name: "x", kind: "text", label: "X" }],
    requiresContext: ["role"],
  }, { mode: "strict" });
  assert.equal(v4.ok, true);

  // And the whole document, where the version itself is the one this contract does not have: the
  // slots are not reported one by one, because the answer is not that `rules` is misplaced.
  const retired = parseDynamicForm({
    version: 1,
    id: "f",
    fields: [{ name: "x", kind: "text", label: "X" }],
    rules: [{ effect: "hidden", target: "x", when: { field: "x", operator: "equals", value: "a" } }],
  }, { mode: "lenient" });
  assert.deepEqual(
    retired.diagnostics.map((each) => each.path),
    ["/version"],
    "a version this contract does not have was reported as a misplaced member",
  );
});

