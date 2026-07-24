import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidIdentifier, printArray, printCall, printKey, printObject, printRegExp, printString } from "../dist/index.js";

test("isValidIdentifier accepts bare JS identifiers, rejects everything else", () => {
  assert.equal(isValidIdentifier("country"), true);
  assert.equal(isValidIdentifier("_private"), true);
  assert.equal(isValidIdentifier("$id"), true);
  assert.equal(isValidIdentifier("2fast"), false);
  assert.equal(isValidIdentifier("has-dash"), false);
  assert.equal(isValidIdentifier(""), false);
});

test("printKey quotes only when the key is not a valid identifier", () => {
  assert.equal(printKey("country"), "country");
  assert.equal(printKey("has-dash"), '"has-dash"');
});

test("printString and printRegExp always produce safely-escaped source", () => {
  assert.equal(printString('a"b'), JSON.stringify('a"b'));
  assert.equal(printRegExp("^\\d{5}$"), `new RegExp(${JSON.stringify("^\\d{5}$")})`);
});

test("printObject: empty object prints {}, non-empty prints one prop per line", () => {
  assert.equal(printObject([]), "{}");
  assert.equal(printObject([{ key: "a", value: "1" }, { key: "has-dash", value: "2" }]), '{\n  a: 1,\n  "has-dash": 2,\n}');
});

test("printObject indents nested content: callers always pass a bare (indent-less) child, the parent's own indentLines cascades it", () => {
  const nested = printObject([{ key: "inner", value: "1" }]);
  const outer = printObject([{ key: "outer", value: nested }]);
  assert.equal(outer, '{\n  outer: {\n    inner: 1,\n  },\n}');
});

test("printArray: empty prints [], short items stay inline, multiline items break one per line", () => {
  assert.equal(printArray([]), "[]");
  assert.equal(printArray(["1", "2", "3"]), "[1, 2, 3]");
  assert.equal(printArray([printObject([{ key: "a", value: "1" }])]), "[\n  {\n    a: 1,\n  },\n]");
});

test("printCall joins args with a comma-space", () => {
  assert.equal(printCall("required", []), "required()");
  assert.equal(printCall("min", ["0", '"too small"']), 'min(0, "too small")');
});
