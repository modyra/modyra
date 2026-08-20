import { test } from "node:test";
import assert from "node:assert/strict";
import { useMdySelect, useMdyCommandQueue, useMdyField, useMdyTextField, useMdyBooleanField, useMdyOptionField, useMdyMultiselectField, useMdyDatepickerField, useMdyDaterangeField, useMdyTimepickerField } from "../dist/index.js";

test("widget entrypoints expose expected symbols", () => {
  assert.equal(typeof useMdySelect, "function");
  assert.equal(typeof useMdyCommandQueue, "function");
  assert.equal(typeof useMdyField, "function");
  assert.equal(typeof useMdyTextField, "function");
  assert.equal(useMdyField.length, 1);
  assert.equal(useMdyTextField.length, 2);
  assert.equal(typeof useMdyBooleanField, "function");
  assert.equal(typeof useMdyOptionField, "function");
  assert.equal(typeof useMdyMultiselectField, "function");
  assert.equal(typeof useMdyDatepickerField, "function");
  assert.equal(typeof useMdyDaterangeField, "function");
  assert.equal(typeof useMdyTimepickerField, "function");
});
