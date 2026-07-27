import assert from "node:assert/strict";
import test from "node:test";
import {
  MDY_FIELD_SHELL_CLASSES,
  MDY_FIELD_SHELL_STRUCTURE,
  MDY_WIDGET_CONTRACT_VERSION,
} from "../dist/index.js";
import { inspectWidgetStructure } from "../dist/testing/index.js";

test("contract v1 exposes the canonical field shell without structural issues", () => {
  assert.equal(MDY_WIDGET_CONTRACT_VERSION, 1);
  assert.deepEqual(inspectWidgetStructure(MDY_FIELD_SHELL_STRUCTURE), []);
  assert.deepEqual(Object.keys(MDY_FIELD_SHELL_CLASSES), [
    "root", "label", "requiredMarker", "inputWrapper", "prefix", "control",
    "suffix", "inlineError", "supportingText", "errors", "errorItem",
  ]);
});

test("structure inspection reports unknown parents and duplicate sibling positions", () => {
  const issues = inspectWidgetStructure({
    kind: "broken",
    nodes: [
      { part: "root", element: "root", order: 0 },
      { part: "a", element: "text", parent: "missing", order: 0 },
      { part: "b", element: "text", parent: "missing", order: 0 },
    ],
  });
  assert.deepEqual(issues.map((issue) => issue.code).sort(), ["DUPLICATE_ORDER", "MISSING_PARENT", "MISSING_PARENT"]);
});
