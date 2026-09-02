import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { parseDynamicForm } from "@modyra/core";
import plugin from "../dist/index.js";

/**
 * Every expectation here is the parser's own answer, obtained by calling it. Nothing in this file
 * states what a valid contract is, for the same reason the rule does not: a test that carried its
 * own list would pass while the rule and the parser disagreed. See ADR 0024.
 */

const CORPUS = fileURLToPath(new URL("../../../spec/fixtures/dynamic-form", import.meta.url));
const SRC = fileURLToPath(new URL("../src", import.meta.url));

const linter = new Linter();

const lint = (code, parser) =>
  linter.verify(code, {
    ...(parser ? { languageOptions: { parser } } : {}),
    plugins: { modyra: plugin },
    rules: { "modyra/valid-dynamic-form": "error" },
  });

/** The rule puts the diagnostic code at the end of every message. */
const codesOf = (messages) =>
  messages.map((message) => {
    const match = /\(([A-Z_0-9]+)\)$/.exec(message.message);
    assert.ok(match, `message carries no code: ${message.message}`);
    return match[1];
  });

const fixtures = readdirSync(CORPUS).flatMap((version) =>
  readdirSync(join(CORPUS, version))
    // **A document is named for itself; anything with a second suffix is written beside one.** A
    // fixture's context is a twin file, not a document (ADR 0098), and so is the verdict a document
    // declares — linting either would ask the rule what the parser says about an object the parser
    // never reads.
    //
    // Stated as one rule rather than as a list of known suffixes: the list was `.context.json`
    // alone, so the corpus gaining a second kind of companion turned this into two failures about a
    // file that is not a document. A rule that names the shape holds for the third kind too.
    .filter((file) => file.endsWith(".json") && !file.slice(0, -".json".length).includes("."))
    .map((file) => ({
    name: `${version}/${file}`,
    document: JSON.parse(readFileSync(join(CORPUS, version, file), "utf8")),
  })),
);

test("the corpus has fixtures on both sides of the verdict", () => {
  const withDiagnostics = fixtures.filter((f) => parseDynamicForm(f.document).diagnostics.length > 0);
  assert.ok(fixtures.length >= 5, `expected a corpus, found ${fixtures.length} fixtures`);
  assert.ok(
    withDiagnostics.length > 0,
    "every fixture parses clean, so a rule that reported nothing at all would pass this suite",
  );
});

for (const { name, document } of fixtures) {
  test(`reports exactly what the parser reports: ${name}`, () => {
    const expected = parseDynamicForm(document).diagnostics;
    // JSON is a subset of JavaScript expression syntax, so the document round-trips into source
    // without being described a second time.
    const messages = lint(`const form = ${JSON.stringify(document, null, 2)};`);

    assert.deepEqual(codesOf(messages), expected.map((d) => d.code));
  });
}

/**
 * The corpus is shared with the Rust and Java parsers and exercises layout and rule references. The
 * mistakes a consumer makes most often are in the fields themselves, and no fixture carries one, so
 * they are stated here as documents — never as expected codes, which still come from the parser.
 */
const FIELD_LEVEL = {
  "a kind the catalogue does not have": { version: 2, fields: [{ name: "a", kind: "nope" }] },
  "a choice with no options": { version: 2, fields: [{ name: "a", kind: "select" }] },
  "two fields with one name": {
    version: 2,
    fields: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }],
  },
  "a name that is a path": { version: 2, fields: [{ name: "a.b", kind: "text" }] },
};

for (const [description, document] of Object.entries(FIELD_LEVEL)) {
  test(`reports exactly what the parser reports: ${description}`, () => {
    const expected = parseDynamicForm(document).diagnostics;
    assert.ok(expected.length > 0, "the parser stopped objecting to this document");

    const messages = lint(`const form = ${JSON.stringify(document, null, 2)};`);
    assert.deepEqual(codesOf(messages), expected.map((d) => d.code));
  });
}

test("a field-level finding underlines the field it is about", () => {
  // This asserted the opposite, and said why: the parser stamped every field diagnostic `/fields`
  // rather than `/fields/1`, and sharpening it was a change to the parser rather than to the rule.
  // The parser now names the entry, and the rule positions it with no edit here — which is what
  // "walk the literal as far as the path reaches" buys.
  const document = FIELD_LEVEL["a choice with no options"];
  const [diagnostic] = parseDynamicForm(document).diagnostics;
  assert.match(diagnostic.path, /^\/fields\/\d+$/, "the parser stopped naming the entry");

  const source = `const form = ${JSON.stringify(document, null, 2)};`;
  const [message] = lint(source);
  const fieldsLine = source.split("\n").findIndex((line) => line.includes('"fields"')) + 1;
  assert.ok(
    message.line > fieldsLine,
    `expected the finding inside the array, not on its \`fields\` property (line ${message.line})`,
  );
});

test("an indexed path underlines the element it names, not the document", () => {
  const document = JSON.parse(readFileSync(join(CORPUS, "v2", "invalid-reference.json"), "utf8"));
  const diagnostics = parseDynamicForm(document).diagnostics;
  assert.ok(diagnostics.length >= 2, "fixture no longer carries two findings at distinct paths");

  const messages = lint(`const form = ${JSON.stringify(document, null, 2)};`);
  const positions = new Set(messages.map((m) => `${m.line}:${m.column}`));

  assert.equal(positions.size, messages.length, "two findings at different paths landed on one node");
  for (const message of messages) {
    assert.ok(message.line > 1, "a finding was reported on the whole statement rather than inside it");
  }
});

test("says nothing about a document it can only partly see", () => {
  const partial = `
    const extra = [{ name: "vat", kind: "text" }];
    const form = {
      version: 2,
      fields: [...extra, { name: "vat", kind: "text" }],
      layout: [{ kind: "slot", field: "nope" }],
    };
  `;
  assert.deepEqual(lint(partial), [], "reported a finding about syntax it could not read");
});

test("says nothing about an object that is not a form document", () => {
  assert.deepEqual(lint(`const config = { version: 2, timeout: 30 };`), []);
  assert.deepEqual(lint(`const config = { fields: [{ name: "" }] };`), []);
});

test("names no diagnostic code of its own", () => {
  // The decision in ADR 0024 is that the rule holds no notion of validity. Comparing the rule's
  // findings against the parser's cannot show that: if the rule carried a copy of the codes and the
  // parser renamed one, both sides of every assertion here would move together and stay green. What
  // does show it is the absence: a rule that reports a code it never mentions cannot be holding a
  // list of them.
  const sources = readdirSync(SRC, { recursive: true })
    .filter((entry) => typeof entry === "string" && entry.endsWith(".ts"))
    .map((entry) => ({ entry, text: readFileSync(join(SRC, entry), "utf8") }));

  assert.ok(sources.length >= 3, "expected to be reading the rule's own source");
  for (const { entry, text } of sources) {
    assert.ok(
      !text.includes("MDY_DYNAMIC"),
      `${entry} names a diagnostic code; the parser is the only place that decides them`,
    );
  }
});

test("reads the same document through the TypeScript parser", () => {
  const document = JSON.parse(readFileSync(join(CORPUS, "v2", "invalid-reference.json"), "utf8"));
  const expected = parseDynamicForm(document).diagnostics;

  const source = `const form = ${JSON.stringify(document, null, 2)} satisfies unknown;`;
  const messages = lint(source, tseslint.parser);

  assert.deepEqual(codesOf(messages), expected.map((d) => d.code));
});

/**
 * The reconstruction has to build the document JSON builds. `out.__proto__ = value` sets a prototype
 * and creates no property, so a key the parser judges — or a node's own `node` — either vanished
 * from the rule's copy or arrived as inheritance, and the editor answered about a document nobody
 * would ever run.
 */
for (const [name, json] of [
  [
    "a child named __proto__",
    String.raw`{"version":3,"schema":{"node":"group","children":{"__proto__":{"node":"field","field":{"kind":"text"}},"ok":{"node":"field","field":{"kind":"text"}}}}}`,
  ],
  [
    "a node whose type would only come from a crafted prototype",
    String.raw`{"version":3,"schema":{"node":"group","children":{"a":{"__proto__":{"node":"field","field":{"kind":"text"}}}}}}`,
  ],
  [
    "an ordinary document, which must stay silent on both sides",
    String.raw`{"version":3,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}}}}}`,
  ],
]) {
  test(`the rule and the parser read the same document: ${name}`, () => {
    // Both sides answer about the same source text: the parser through JSON.parse, the rule through
    // its reconstruction. Anything else would be this file stating what validity is (ADR 0024).
    const expected = parseDynamicForm(JSON.parse(json)).diagnostics.map((d) => d.code);
    assert.deepEqual(codesOf(lint(`const form = ${json};`)), expected);
  });
}

/**
 * A document is seen whatever number its version carries.
 *
 * The detector once listed the versions it would recognise — `1 || 2 || 3` — so a document at a
 * version the language had since gained was not *rejected* but **unseen**: the rule returned before
 * asking the parser anything, and a planted defect produced no report at all. Silence is the worst
 * available answer from a tool that exists to break silence, and it arrives exactly when the
 * contract moves.
 *
 * So the property asserted is not "these versions are supported" — that list would rot the same way.
 * It is that **which number sits in `version` never decides whether the document is looked at**. The
 * parser owns the vocabulary and answers for a version it does not support; this rule only decides
 * whether to ask it.
 *
 * The range deliberately runs past what the contract has, so a version it gains later is already
 * covered, and starts below what it still accepts, so a version it has dropped is too.
 */
for (const version of [1, 2, 3, 4, 5, 6, 7]) {
  test(`a document carrying a defect is never silent at version ${version}`, () => {
    const document = {
      version,
      fields: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }],
    };

    const messages = lint(`const form = ${JSON.stringify(document, null, 2)};`);
    assert.ok(
      messages.length > 0,
      `version ${version} was not recognised as a document, so a planted duplicate name went unreported`,
    );

    // And what it says is the parser's answer, not this rule's opinion of the version.
    assert.deepEqual(codesOf(messages), parseDynamicForm(document).diagnostics.map((d) => d.code));
  });
}
