/**
 * A field in a tree has no name of its own: the key its parent gives it is the name, and that is the
 * name every finding on it says. A key may hold "/", so the name is the key itself and never the
 * last segment of the path the key is written into.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDynamicForm } from "../dist/index.js";

const findingsAt = (document, path) =>
  parseDynamicForm(document, { mode: "lenient" }).diagnostics
    .filter((d) => d.path === path)
    .map((d) => [d.code, d.message]);

test("a finding on a tree field names the field by its whole key", () => {
  const document = {
    version: 2,
    schema: {
      node: "group",
      children: {
        "a/b": { node: "field", field: { kind: "nope" } },
        "x/": { node: "field", field: { kind: "text" } },
      },
    },
  };
  assert.deepEqual(findingsAt(document, "/schema/children/a/b/field"), [
    ["MDY_DYNAMIC_UNKNOWN_KIND", 'Dropped dynamic field "a/b" with unknown kind "nope".'],
  ]);
  assert.deepEqual(findingsAt(document, "/schema/children/x//field"), []);
});

test("a collection's template field is named item", () => {
  const document = {
    version: 2,
    schema: { node: "group", children: { rows: { node: "array", item: { node: "field", field: { kind: "nope" } } } } },
  };
  assert.deepEqual(findingsAt(document, "/schema/children/rows/item/field"), [
    ["MDY_DYNAMIC_UNKNOWN_KIND", 'Dropped dynamic field "item" with unknown kind "nope".'],
  ]);
});
