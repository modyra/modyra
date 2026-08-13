import assert from "node:assert/strict";
import test from "node:test";
import {
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
} from "../dist/index.js";
import { MDY_CANONICAL_UI_CLASSES } from "../dist/vocabulary.js";
const expected = ["text","email","password","textarea","number","slider","checkbox","toggle","radio","segmented","select","multiselect","datepicker","daterange","timepicker","file","colors"];
test("the complete Angular catalog has ordered anatomy and closed part maps", () => {
  assert.deepEqual(MDY_WIDGET_KINDS, expected);
  for (const kind of MDY_WIDGET_KINDS) {
    const contract = MDY_WIDGET_CONTRACTS[kind];
    assert.equal(contract.kind, kind);
    assert.ok(contract.rootClasses.includes("mdy-renderer"));
    assert.deepEqual(contract.parts.root.classes, contract.rootClasses);
    assert.deepEqual(contract.structure.nodes.map((node) => node.part), Object.keys(contract.parts));
    assert.equal(new Set(contract.structure.nodes.map((node) => node.part)).size, contract.structure.nodes.length);
  }
  assert.equal(new Set(MDY_CANONICAL_UI_CLASSES).size, MDY_CANONICAL_UI_CLASSES.length);
});
