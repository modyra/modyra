/**
 * A pattern's verdict depends on the value alone, whatever flags the expression carries.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { pattern } from "../dist/index.js";

test("a global or sticky expression gives the same verdict on every call", () => {
  for (const re of [/x/g, /x/y]) {
    const rule = pattern(re);
    for (let i = 0; i < 4; i++) assert.deepEqual(rule("x"), [], `${re} call ${i}`);
  }
});
