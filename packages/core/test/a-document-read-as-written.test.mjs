/**
 * The reader judges what a document wrote, and reports it under the code of the rule it broke.
 *
 * Each case is a document whose author wrote something ordinary — a child called `valueOf`, a name
 * that happens to contain a phrase, a list where an object belongs, two option values beyond what a
 * double holds — and the verdict must follow from the document rather than from what JavaScript
 * finds on a prototype or in the words of a message.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { explainValueMismatch, parseDynamicForm } from "../dist/index.js";

const tree = (children) => ({ version: 5, id: "p", schema: { node: "group", children } });
const leaf = (field) => ({ node: "field", field: { label: "F", ...field } });

test("a tree child named like an Object method reads its own initial, not the prototype's", () => {
  for (const name of ["valueOf", "hasOwnProperty", "isPrototypeOf", "constructor"]) {
    const result = parseDynamicForm(tree({ [name]: leaf({ kind: "text", initialValue: "a" }) }));
    if (name === "constructor") {
      // Refused for its name, which is a separate rule; what matters is that no finding speaks of a
      // function the document never wrote.
      assert.ok(result.diagnostics.every((d) => !d.message.includes("function")), JSON.stringify(result.diagnostics));
      continue;
    }
    assert.deepEqual(result.diagnostics, [], `${name}: ${JSON.stringify(result.diagnostics)}`);
    assert.deepEqual(result.fields.map((f) => [f.name, f.initialValue]), [[name, "a"]]);
  }
});

test("a tree child with no initial of its own starts empty, whatever its name", () => {
  const result = parseDynamicForm(tree({ valueOf: leaf({ kind: "text" }) }));
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.fields[0].initialValue, undefined);
});

test("a name carrying a code's phrase does not rename the code", () => {
  const cases = [
    // Whitespace is refused, and the name happens to quote the path and kind phrases.
    [{ name: "a path may be", kind: "text" }, "MDY_DYNAMIC_INVALID_FIELD"],
    [{ name: "unknown kind", kind: "text" }, "MDY_DYNAMIC_INVALID_FIELD"],
    // A label of the wrong type, on names quoting the pattern and context phrases.
    [{ name: "pattern-length", kind: "text", label: 1 }, "MDY_DYNAMIC_INVALID_FIELD"],
    [{ name: "x", kind: "text", label: 1, placeholder: "does not declare in" }, "MDY_DYNAMIC_INVALID_FIELD"],
    // An unknown kind whose own spelling quotes the duplicate-option phrase.
    [{ name: "k", kind: "duplicate option value" }, "MDY_DYNAMIC_UNKNOWN_KIND"],
    // A pattern the platform cannot compile, whose source quotes the length phrase.
    [{ name: "p", kind: "text", validators: { pattern: "pattern length [" } }, "MDY_DYNAMIC_INVALID_FIELD"],
    // A timepicker clock that is not one of the two, spelled with the kind phrase.
    [{ name: "t", kind: "timepicker", format: "unknown kind" }, "MDY_DYNAMIC_UNHONOURABLE_FORMAT"],
  ];
  for (const [field, code] of cases) {
    const { diagnostics } = parseDynamicForm({ version: 5, id: "p", fields: [field] });
    assert.deepEqual(diagnostics.map((d) => d.code), [code], JSON.stringify(field));
  }
});

test("validators written as a list are refused as not being an object", () => {
  for (const validators of [[], [{ required: true }]]) {
    const result = parseDynamicForm({ version: 5, id: "p", fields: [{ name: "f", kind: "text", validators }] });
    assert.equal(result.ok, false);
    assert.deepEqual(result.fields, []);
    assert.deepEqual(result.diagnostics.map((d) => d.code), ["MDY_DYNAMIC_INVALID_FIELD"]);
    assert.match(result.diagnostics[0].message, /validators must be an object/);
  }
});

test("options at the two infinities are two options", () => {
  const document = JSON.parse(
    '{"version":5,"id":"p","fields":[{"name":"f","kind":"select","label":"F",' +
      '"options":[{"value":1e400,"label":"a"},{"value":-1e400,"label":"b"}]}]}',
  );
  const result = parseDynamicForm(document);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.fields[0].options.map((o) => o.value), [Infinity, -Infinity]);
});

test("a number initial beyond what a double holds is refused for what it is", () => {
  const document = JSON.parse('{"version":5,"id":"p","fields":[{"name":"f","kind":"number","label":"F","initialValue":1e400}]}');
  const { diagnostics } = parseDynamicForm(document);
  assert.equal(diagnostics.length, 1);
  assert.doesNotMatch(diagnostics[0].message, /got number/);
  assert.match(diagnostics[0].message, /got Infinity/);
  assert.equal(explainValueMismatch("number", Number.NaN), "number holds number, got NaN");
  assert.equal(explainValueMismatch("number", "1"), "number holds number, got string");
});
