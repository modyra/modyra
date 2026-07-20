/**
 * Injection prevention: sanitization profiles at the value-write choke
 * point (set/patch/setValue/arrays/drafts), per-field overrides, length
 * caps, violation telemetry, and the always-on structural checks (draft
 * shape validation, server-error path validation). See docs/guides/security.md.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyValueSecurity,
  array,
  createForm,
  draftShapeMatches,
  field,
  group,
} from "../dist/index.js";

const BIDI = "admin\u202E"; // right-to-left override
const ZERO_WIDTH = "a\u200Bb"; // zero-width space
const CONTROL = "a\u0001b"; // SOH control char

function memoryStorage() {
  const data = new Map();
  return {
    data,
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

function draftEnvelope(value) {
  return JSON.stringify({ __mdyDraft: 1, savedAt: Date.now(), value });
}

// ─── Opt-in default ──────────────────────────────────────────────────────────

test("default policy is off: dangerous characters pass through untouched", () => {
  const violations = [];
  const form = createForm(
    { name: field("") },
    { security: { onViolation: (v) => violations.push(v) } },
  );
  form.f.name.set(BIDI);
  assert.equal(form.f.name.value(), BIDI);
  assert.deepEqual(violations, []);
});

// ─── Built-in profiles ───────────────────────────────────────────────────────

test('profile "text" strips bidi/zero-width/control chars, keeps legit text', () => {
  const violations = [];
  const form = createForm(
    { bio: field("") },
    {
      security: {
        sanitize: "text",
        onViolation: (v) => violations.push(v),
      },
    },
  );
  form.f.bio.set(`${BIDI}${ZERO_WIDTH}${CONTROL}`);
  assert.equal(form.f.bio.value(), "adminabab");
  assert.deepEqual(
    violations.map((v) => [v.kind, v.path]),
    [["sanitized", "bio"]],
  );

  violations.length = 0;
  form.f.bio.set("Città\tmultiline\n✓ — legitimate unicode stays");
  assert.equal(form.f.bio.value(), "Città\tmultiline\n✓ — legitimate unicode stays");
  assert.deepEqual(violations, []);
});

test('profile "strict" also removes markup characters', () => {
  const form = createForm(
    { name: field("") },
    { security: { sanitize: "strict" } },
  );
  form.f.name.set("<script>alert(`x`)</script>O'Brien & \"Co\"");
  // Quotes and & stay (legit names); angle brackets/backticks go.
  assert.equal(form.f.name.value(), "scriptalert(x)/scriptO'Brien & \"Co\"");
});

test("sanitization is deep through arrays and plain objects, reference-preserving", () => {
  const result = applyValueSecurity(
    { tags: ["ok", `${ZERO_WIDTH}`], nested: { note: "fine" } },
    { sanitizer: "text" },
  );
  assert.deepEqual(result.value, { tags: ["ok", "ab"], nested: { note: "fine" } });
  assert.equal(result.actions.length, 1);

  const untouched = { tags: ["ok"] };
  const same = applyValueSecurity(untouched, { sanitizer: "strict" });
  assert.equal(same.value, untouched); // same reference: signal identity intact
  assert.deepEqual(same.actions, []);
});

// ─── Per-field override and custom functions ─────────────────────────────────

test("per-field override beats the form policy, both ways", () => {
  const form = createForm(
    {
      name: field(""),                    // form policy applies
      code: field("", [], { sanitize: "off" }), // exempt
      nick: field("", [], { sanitize: "strict" }),
    },
    { security: { sanitize: "text" } },
  );
  form.f.name.set(ZERO_WIDTH);
  assert.equal(form.f.name.value(), "ab");

  form.f.code.set(BIDI); // bidi survives in the exempt field
  assert.equal(form.f.code.value(), BIDI);

  form.f.nick.set("<b>x</b>");
  assert.equal(form.f.nick.value(), "bx/b");
});

test("custom sanitizer function receives the whole value", () => {
  const violations = [];
  const form = createForm(
    { html: field("", [], { sanitize: (v) => String(v).replace(/<[^>]*>/g, "") }) },
    { security: { onViolation: (v) => violations.push(v) } },
  );
  form.f.html.set("<p>hello</p>");
  assert.equal(form.f.html.value(), "hello");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, "sanitized");
});

test("a throwing onViolation hook cannot break the form", () => {
  const form = createForm(
    { name: field("") },
    {
      security: {
        sanitize: "text",
        onViolation: () => {
          throw new Error("telemetry down");
        },
      },
      devWarnings: false,
    },
  );
  form.f.name.set(BIDI);
  assert.equal(form.f.name.value(), "admin");
});

// ─── Length cap ──────────────────────────────────────────────────────────────

test("maxValueLength truncates without splitting surrogate pairs", () => {
  const violations = [];
  const form = createForm(
    { name: field("") },
    {
      security: {
        maxValueLength: 3,
        onViolation: (v) => violations.push(v),
      },
    },
  );
  form.f.name.set("ab💥cdef");
  assert.equal(form.f.name.value(), "ab💥"); // 💥 counts once, stays whole
  assert.deepEqual(
    violations.map((v) => v.kind),
    ["max-length"],
  );
});

// ─── The choke point covers every entry path ─────────────────────────────────

test("patch, setValue, group paths and array operations are all sanitized", () => {
  const form = createForm(
    {
      name: field(""),
      address: group({ city: field("") }),
      tags: array(field("")),
    },
    { security: { sanitize: "text" } },
  );
  form.patch({ name: ZERO_WIDTH, address: { city: `Rome${BIDI}` } });
  assert.equal(form.f.name.value(), "ab");
  assert.equal(form.f.address.city.value(), "Romeadmin");

  form.f.tags.push(ZERO_WIDTH);
  assert.equal(form.f.tags.at(0).value(), "ab");

  form.setValue({ name: BIDI, address: { city: "Milan" }, tags: [] });
  assert.equal(form.f.name.value(), "admin");
});

test("initial values from the schema are sanitized at registration", () => {
  const form = createForm(
    { name: field(BIDI) },
    { security: { sanitize: "text" } },
  );
  assert.equal(form.f.name.value(), "admin");
});

// ─── Tier 0a: draft shape validation (always on) ─────────────────────────────

test("draft entries with a mismatched shape are dropped and reported", () => {
  const storage = memoryStorage();
  storage.data.set(
    "d",
    draftEnvelope({
      email: "a@b.co",          // right shape: restored
      age: { $ne: 1 },           // object into a number field: dropped
      nickname: ["x"],           // array into a string field: dropped
      bio: null,                 // null: always allowed (empty sentinel)
    }),
  );
  const violations = [];
  const form = createForm(
    {
      email: field(""),
      age: field(0),
      nickname: field(""),
      bio: field("initial"),
    },
    {
      draft: { key: "d", storage },
      security: { onViolation: (v) => violations.push(v) },
    },
  );
  assert.equal(form.f.email.value(), "a@b.co");
  assert.equal(form.f.age.value(), 0);
  assert.equal(form.f.nickname.value(), "");
  assert.equal(form.f.bio.value(), null);
  assert.deepEqual(
    violations.map((v) => [v.kind, v.path]).sort(),
    [
      ["draft-shape", "age"],
      ["draft-shape", "nickname"],
    ],
  );
});

test("restored drafts are also sanitized at the write choke point", () => {
  const storage = memoryStorage();
  storage.data.set("d", draftEnvelope({ name: BIDI }));
  const form = createForm(
    { name: field("") },
    { draft: { key: "d", storage }, security: { sanitize: "text" } },
  );
  assert.equal(form.f.name.value(), "admin");
});

test("unsafe draft keys are dropped (prototype pollution guard)", () => {
  const storage = memoryStorage();
  storage.data.set(
    "d",
    draftEnvelope({ name: "ok", "__proto__": { polluted: true } }),
  );
  const form = createForm(
    { name: field("") },
    { draft: { key: "d", storage } },
  );
  assert.equal(form.f.name.value(), "ok");
  assert.equal({}.polluted, undefined);
});

// ─── Tier 0b: server-error path validation (always on) ───────────────────────

test("server errors with unsafe paths are dropped and reported", async () => {
  const violations = [];
  const form = createForm(
    { name: field("") },
    { security: { onViolation: (v) => violations.push(v) } },
  );
  form.f.name.set("x");
  await form.submit(() => [
    { path: "__proto__", kind: "server", message: "evil" },
    { path: "name", kind: "server", message: "taken" },
    { path: null, kind: "server", message: "global" },
  ]);
  assert.deepEqual(
    form.f.name.errors().map((e) => e.message),
    ["taken"],
  );
  assert.deepEqual(
    form.errorsFor("")().map((e) => e.message),
    ["global"],
  );
  assert.deepEqual(
    violations.map((v) => [v.kind, v.path]),
    [["error-path", "__proto__"]],
  );
});

// ─── Pure units ──────────────────────────────────────────────────────────────

test("draftShapeMatches: null initial accepts JSON shapes, typed initials are strict", () => {
  assert.equal(draftShapeMatches(null, "s"), true);
  assert.equal(draftShapeMatches(null, [1]), true);
  assert.equal(draftShapeMatches(null, { a: 1 }), true);
  assert.equal(draftShapeMatches("", null), true); // empty sentinel
  assert.equal(draftShapeMatches("", "s"), true);
  assert.equal(draftShapeMatches("", 1), false);
  assert.equal(draftShapeMatches(0, 1), true);
  assert.equal(draftShapeMatches(0, "1"), false);
  assert.equal(draftShapeMatches(true, false), true);
  assert.equal(draftShapeMatches([], [1]), true);
  assert.equal(draftShapeMatches([], {}), false);
  assert.equal(draftShapeMatches({ a: 1 }, { b: 2 }), true);
  assert.equal(draftShapeMatches({ a: 1 }, [1]), false);
});
