/**
 * What a document's rows may cost a reader beyond what the document declares.
 *
 * A collection's declared rows are lent to every enclosing row that writes none, so the flatten
 * visits the product of the row counts and not the size of the document. The reader bounds the
 * visits beyond the declared nodes and refuses the whole schema past the bound, at `/schema`, in
 * both modes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MdyDynamicSchemaLimitError, flattenDynamicForm, parseDynamicForm } from "../dist/index.js";

const EXTRA = 10_000;
const text = { node: "field", field: { kind: "text", label: "Cell" } };

/** A collection of `count` rows that write nothing, each row a group of `children`. */
const rowsOf = (count, children) => ({
  node: "array",
  initialValue: Array.from({ length: count }, () => ({})),
  item: { node: "group", children },
});

/** Nested collections of `rows` rows each, `depth` deep, ending in `leaf`. */
const nested = (depth, rows, leaf) => {
  let node = leaf;
  for (let level = 0; level < depth; level += 1) node = rowsOf(rows, { [`c${level}`]: node });
  return { node: "group", children: { root: node } };
};

const parse = (schema, mode) => parseDynamicForm({ version: 5, schema }, { mode });

for (const mode of ["lenient", "strict"]) {
  test(`${mode}: rows that multiply past the bound refuse the schema whole, at /schema`, () => {
    const started = performance.now();
    const result = parse(nested(6, 100, text), mode);
    assert.ok(performance.now() - started < 1000, "the refusal does not walk what it refuses");
    assert.equal(result.ok, false);
    assert.deepEqual(result.fields, []);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.code, d.severity, d.path]),
      [["MDY_DYNAMIC_SCHEMA_LIMIT", "error", "/schema"]],
    );
  });
}

test("a branch that ends in no field is bounded too", () => {
  // Leafless rows cost the walk what rows with cells cost it; a bound on fields alone leaves this.
  const result = parse(nested(6, 100, { node: "group", children: {} }), "lenient");
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map((d) => d.code), ["MDY_DYNAMIC_SCHEMA_LIMIT"]);
});

test("the bound is exact: the last visit it allows is accepted and the next is refused", () => {
  // Declared: the root group, the collection and its row group. Each row is one visit beyond them.
  const at = parse({ node: "group", children: { rows: rowsOf(EXTRA, {}) } }, "strict");
  assert.equal(at.ok, true, JSON.stringify(at.diagnostics));
  const past = parse({ node: "group", children: { rows: rowsOf(EXTRA + 1, {}) } }, "strict");
  assert.deepEqual(past.diagnostics.map((d) => d.code), ["MDY_DYNAMIC_SCHEMA_LIMIT"]);
});

test("a table of a hundred rows and twenty cells is accepted", () => {
  const cells = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`c${index}`, text]));
  const result = parse({ node: "group", children: { lines: rowsOf(100, cells) } }, "strict");
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.fields.length, 2000);
});

test("a document as large as what it declares is not refused for its size", () => {
  const children = Object.fromEntries(Array.from({ length: 3 * EXTRA }, (_, index) => [`f${index}`, text]));
  const result = parse({ node: "group", children }, "strict");
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics.slice(0, 3)));
  assert.equal(result.fields.length, 3 * EXTRA);
});

test("the flatten called directly throws a typed error naming the code and the path", () => {
  assert.throws(
    () => flattenDynamicForm(nested(4, 100, text)),
    (error) =>
      error instanceof MdyDynamicSchemaLimitError
      && error.code === "MDY_DYNAMIC_SCHEMA_LIMIT"
      && error.path === "/schema"
      && error.limit === EXTRA,
  );
});
