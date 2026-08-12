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
import { MDY_DYNAMIC_DIAGNOSTICS, parseDynamicForm } from "../dist/index.js";

/** A document refused for each named reason. */
const REFUSALS = {
  MDY_DYNAMIC_UNSUPPORTED_VERSION: { version: 99, fields: [{ name: "a", kind: "text" }] },
  MDY_DYNAMIC_DUPLICATE_NAME: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }],
  MDY_DYNAMIC_UNSAFE_NAME: [{ name: "__proto__", kind: "text" }],
  MDY_DYNAMIC_UNKNOWN_KIND: [{ name: "a", kind: "wormhole" }],
  MDY_DYNAMIC_OPTIONS_REQUIRED: [{ name: "a", kind: "select" }],
  MDY_DYNAMIC_PATTERN_TOO_LONG: [{ name: "a", kind: "text", validators: { pattern: "x".repeat(300) } }],
};

test("every named code is one the parser can actually produce", () => {
  for (const { code } of MDY_DYNAMIC_DIAGNOSTICS) {
    const document_ = REFUSALS[code];
    assert.ok(document_, `${code} has no document that produces it`);
    const { diagnostics } = parseDynamicForm(document_);
    assert.ok(
      diagnostics.some((d) => d.code === code),
      `${code} was never reported — got ${JSON.stringify(diagnostics.map((d) => d.code))}`,
    );
  }
});

test("the phrase each code is recognised by still appears in its message", () => {
  for (const { code, phrase } of MDY_DYNAMIC_DIAGNOSTICS) {
    const { diagnostics } = parseDynamicForm(REFUSALS[code]);
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
