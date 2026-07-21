import { test } from "node:test";
import assert from "node:assert/strict";
import { useMdySelect, useMdyCommandQueue, useMdyField } from "../dist/index.js";

test("widget entrypoints expose expected symbols", () => {
  assert.equal(typeof useMdySelect, "function");
  assert.equal(typeof useMdyCommandQueue, "function");
  assert.equal(typeof useMdyField, "function");
});
