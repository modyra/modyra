/**
 * A tree document is answered declaration by declaration.
 *
 * A child a group cannot use is that child's problem, as an unknown kind is that field's problem: in
 * lenient mode its siblings survive and the counts say one was refused. A refusal is said once, at
 * the declaration and under the name the document gave it. A finding about a field that was kept
 * does not count the field as lost.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDynamicForm } from "../dist/index.js";

const tree = (children) => ({ version: 5, id: "t", schema: { node: "group", children } });
const leaf = (field) => ({ node: "field", field: { label: "F", ...field } });

for (const [what, malformed] of [["a bare value", "x"], ["an unknown node", { node: "nope" }]]) {
  test(`${what} beside a valid field drops alone in lenient mode and refuses the document in strict`, () => {
    const document = tree({ a: leaf({ kind: "text" }), v: malformed });

    const lenient = parseDynamicForm(document, { mode: "lenient" });
    assert.equal(lenient.ok, false);
    assert.deepEqual(lenient.fields.map((field) => field.name), ["a"]);
    assert.deepEqual(
      lenient.diagnostics.map(({ code, path }) => ({ code, path })),
      [{ code: "MDY_DYNAMIC_INVALID_NODE", path: "/schema/children/v" }],
    );
    assert.equal(lenient.acceptedCount, 1);
    assert.equal(lenient.rejectedCount, 1);

    const strict = parseDynamicForm(document, { mode: "strict" });
    assert.equal(strict.ok, false);
    assert.deepEqual(strict.fields, []);
    assert.equal(strict.acceptedCount, 1);
    assert.equal(strict.rejectedCount, 1);
  });
}

test("a bare value on its own is counted as the one declaration refused", () => {
  const result = parseDynamicForm(tree({ v: "x" }), { mode: "lenient" });
  assert.equal(result.acceptedCount, 0);
  assert.equal(result.rejectedCount, 1);
});

test("a schema or a collection item that is not a node still refuses the document whole", () => {
  const root = parseDynamicForm({ version: 5, id: "t", schema: "x" }, { mode: "lenient" });
  assert.equal(root.ok, false);
  assert.deepEqual(root.fields, []);

  // A collection whose item cannot be read has no row shape, so its sibling is not left standing on
  // a document the reader could only half follow.
  const item = parseDynamicForm(
    tree({ a: leaf({ kind: "text" }), rows: { node: "array", item: { node: "nope" } } }),
    { mode: "lenient" },
  );
  assert.equal(item.ok, false);
  assert.deepEqual(item.fields, []);
  assert.deepEqual(item.diagnostics.map((each) => each.path), ["/schema/children/rows/item"]);
});

test("a refused leaf is reported once, at its declaration and by its own name", () => {
  const result = parseDynamicForm(tree({ f: leaf({ kind: "number", validators: { min: "x" } }) }), { mode: "lenient" });
  assert.equal(result.diagnostics.length, 1, JSON.stringify(result.diagnostics));
  const [only] = result.diagnostics;
  assert.equal(only.path, "/schema/children/f/field");
  assert.match(only.message, /"f"/);
  assert.doesNotMatch(only.message, /"leaf"/);
  assert.equal(result.rejectedCount, 1);
});

test("a field kept with a finding is counted as accepted", () => {
  const result = parseDynamicForm(tree({
    s: leaf({ kind: "select", options: [{ value: "a", label: "A" }, { value: "a", label: "Again" }] }),
    t: leaf({ kind: "text" }),
  }), { mode: "lenient" });
  assert.deepEqual(result.fields.map((field) => field.name), ["s", "t"]);
  assert.deepEqual(result.diagnostics.map((each) => each.code), ["MDY_DYNAMIC_DUPLICATE_OPTION"]);
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.rejectedCount, 0);
});

test("a row value the cell's kind cannot hold is reported at the cell's declaration, naming the row", () => {
  const result = parseDynamicForm(tree({
    items: { node: "array", item: leaf({ kind: "number" }), initialValue: ["x", 2] },
  }), { mode: "lenient" });
  assert.deepEqual(result.fields.map((field) => [field.name, field.initialValue]), [["items.1", 2]]);
  assert.equal(result.diagnostics.length, 1, JSON.stringify(result.diagnostics));
  const [only] = result.diagnostics;
  assert.equal(only.code, "MDY_DYNAMIC_INVALID_FIELD");
  assert.equal(only.path, "/schema/children/items/item/field");
  assert.match(only.message, /"items\.0"/);
});
