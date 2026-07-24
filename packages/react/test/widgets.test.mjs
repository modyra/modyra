import { test } from "node:test";
import assert from "node:assert/strict";
import { useMdySelect, useMdyCommandQueue, useMdyField, useMdyBooleanField, useMdyOptionField, useMdyMultiselectField, useMdyDatepickerField, useMdyTimepickerField } from "../dist/index.js";

test("widget entrypoints expose expected symbols", () => {
  assert.equal(typeof useMdySelect, "function");
  assert.equal(typeof useMdyCommandQueue, "function");
  assert.equal(typeof useMdyField, "function");
  assert.equal(typeof useMdyBooleanField, "function");
  assert.equal(typeof useMdyOptionField, "function");
  assert.equal(typeof useMdyMultiselectField, "function");
  assert.equal(typeof useMdyDatepickerField, "function");
  assert.equal(typeof useMdyTimepickerField, "function");
});
