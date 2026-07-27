import assert from "node:assert/strict";
import test from "node:test";
import { MDY_CANONICAL_UI_CLASSES, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "../dist/index.js";

test("the complete Angular catalog is owned by Widgets", () => {
  assert.deepEqual(MDY_WIDGET_KINDS, ["text","email","password","textarea","number","slider","checkbox","toggle","radio","segmented","select","multiselect","datepicker","daterange","timepicker","file","colors"]);
  assert.equal(new Set(MDY_CANONICAL_UI_CLASSES).size, MDY_CANONICAL_UI_CLASSES.length);
  for (const kind of MDY_WIDGET_KINDS) {
    const contract = MDY_WIDGET_CONTRACTS[kind];
    assert.equal(contract.kind, kind);
    assert.equal(contract.capabilities.keyboard, true);
    assert.equal(contract.capabilities.focus, true);
    assert.ok(contract.classes.includes("mdy-renderer"));
  }
});
