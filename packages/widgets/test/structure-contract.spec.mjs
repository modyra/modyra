import assert from "node:assert/strict";
import test from "node:test";
import {
  MDY_FIELD_SHELL_CLASSES,
  MDY_WIDGET_CONTRACT_VERSION,
} from "../dist/index.js";
import { MDY_FIELD_SHELL_STRUCTURE } from "../dist/vocabulary.js";
import { inspectWidgetStructure } from "../dist/testing/index.js";

test("the published contract version names the anatomy this suite checks", () => {
  // Pinned, not read: the number exists so an adapter can say "the parts I build are the parts this
  // number describes", and a test that took whatever it found would agree with any anatomy. It moved
  // to 2 for the release that removed `datepicker.actions` and `daterange.actions` and turned
  // `multiselect.searchButton` into an `input` with `role="combobox"`, to 3 for the multiselect
  // popup becoming a dialog, and to 4 when a boolean's drawn box moved inside its label: the wrapper
  // stopped being a `<label>`, so the box needed a parent that still forwards a click.
  assert.equal(MDY_WIDGET_CONTRACT_VERSION, 4);
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
