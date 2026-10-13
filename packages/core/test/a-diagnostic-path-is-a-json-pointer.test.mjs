/**
 * A diagnostic's path is a JSON Pointer into the document it was read from.
 *
 * A consumer underlines the place a finding names, so the path has to resolve to exactly one place:
 * a key is escaped as RFC 6901 escapes a token, because "/" and "~" are legal in a name, and a finding
 * about a field points where that field was written — its index in a list, its declaration in a tree
 * — not at a name the document never used as a location.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDynamicForm } from "../dist/index.js";

/** Resolves an RFC 6901 pointer against a document, or `undefined` when it addresses nothing. */
function resolve(document, pointer) {
  let node = document;
  for (const token of pointer.split("/").slice(1)) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (node === null || typeof node !== "object" || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

const tree = (version, children) => ({ version, id: "f", schema: { node: "group", children } });
const integerLeaf = { node: "field", field: { kind: "number", label: "N", validators: { integer: true } } };

test("a child key carrying / and ~ is one escaped segment, and the path resolves to that child", () => {
  const document = tree(5, {
    "a/b": { node: "group" },
    "x~1": { node: "group" },
  });
  const parsed = parseDynamicForm(document);
  const paths = parsed.diagnostics.filter((d) => d.code === "MDY_DYNAMIC_INVALID_GROUP").map((d) => d.path);
  assert.deepEqual(paths.sort(), ["/schema/children/a~1b", "/schema/children/x~01"]);
  for (const path of paths) {
    assert.equal(resolve(document, path)?.node, "group", `${path} does not resolve to the child it names`);
  }
});

test("a field list entry is addressed by its index, and a refused earlier duplicate does not move it", () => {
  const document = {
    version: 4,
    id: "f",
    fields: [
      { name: "a", kind: "text", label: "A" },
      { name: "n", kind: "number", label: "N", validators: { integer: true } },
      { name: "n", kind: "number", label: "Again", validators: { integer: true } },
    ],
  };
  const refusals = parseDynamicForm(document).diagnostics.filter((d) => d.code === "MDY_DYNAMIC_UNSUPPORTED_VERSION");
  assert.deepEqual(refusals.map((d) => d.path), ["/fields/1/validators/integer"]);
  assert.equal(resolve(document, refusals[0].path), true);
});

test("a tree field's finding is at its declaration, with its key escaped", () => {
  const document = tree(4, { "a/b": { node: "group", children: { seats: integerLeaf } } });
  const refusals = parseDynamicForm(document).diagnostics.filter((d) => d.code === "MDY_DYNAMIC_UNSUPPORTED_VERSION");
  assert.deepEqual(refusals.map((d) => d.path), ["/schema/children/a~1b/children/seats/field/validators/integer"]);
  assert.equal(resolve(document, refusals[0].path), true);
});

test("every row of a collection is read from one template, so its finding is reported once, at the template", () => {
  const document = tree(4, {
    rows: {
      node: "array",
      initialValue: [{}, {}, {}],
      item: { node: "group", children: { seats: integerLeaf } },
    },
  });
  const refusals = parseDynamicForm(document).diagnostics.filter((d) => d.code === "MDY_DYNAMIC_UNSUPPORTED_VERSION");
  assert.deepEqual(refusals.map((d) => d.path), ["/schema/children/rows/item/children/seats/field/validators/integer"]);
  assert.equal(resolve(document, refusals[0].path), true);
});

test("a collection with no rows still declares its template, so the template's integer is refused", () => {
  const document = tree(4, {
    rows: { node: "array", item: { node: "group", children: { seats: integerLeaf } } },
    byKey: { node: "record", item: { node: "field", field: { kind: "number", label: "N", validators: { integer: false } } } },
  });
  const parsed = parseDynamicForm(document, { mode: "strict" });
  const refusals = parsed.diagnostics.filter((d) => d.code === "MDY_DYNAMIC_UNSUPPORTED_VERSION");
  assert.deepEqual(refusals.map((d) => d.path).sort(), [
    "/schema/children/byKey/item/field/validators/integer",
    "/schema/children/rows/item/children/seats/field/validators/integer",
  ]);
  assert.equal(parsed.ok, false);
});
