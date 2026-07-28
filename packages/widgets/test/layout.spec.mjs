/**
 * The declarative layout contract: the vocabulary a form's sections and column rows render as.
 * Asserted here so an adapter cannot quietly invent its own grid, and a theme has one set of
 * classes to style.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_LAYOUT_CLASSES,
  MDY_LAYOUT_COLUMN_COUNT_PROPERTY,
  layoutNodeAttributes,
} from "../dist/index.js";

test("the layout vocabulary is fixed and namespaced", () => {
  assert.deepEqual(MDY_LAYOUT_CLASSES, {
    section: "mdy-layout-section",
    sectionLabel: "mdy-layout-legend",
    columns: "mdy-layout-columns",
    column: "mdy-layout-column",
  });
  assert.equal(MDY_LAYOUT_COLUMN_COUNT_PROPERTY, "--mdy-layout-column-count");
});

test("a section carries its class and its identity, and needs no style", () => {
  const attributes = layoutNodeAttributes({ kind: "section", id: "contact" });
  assert.equal(attributes.className, MDY_LAYOUT_CLASSES.section);
  assert.deepEqual(attributes.style, {});
  assert.deepEqual(attributes.dataset, { layoutId: "contact" });
});

test("a columns row publishes how many tracks it wants", () => {
  const attributes = layoutNodeAttributes({ kind: "columns", id: "row-1", columns: [["a"], ["b"], ["c"]] });
  assert.equal(attributes.className, MDY_LAYOUT_CLASSES.columns);
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "3");
});

test("a row with no columns still occupies one track", () => {
  // Zero tracks would collapse the row and take its fields off the page.
  const empty = layoutNodeAttributes({ kind: "columns", id: "row-0", columns: [] });
  assert.equal(empty.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "1");
  const missing = layoutNodeAttributes({ kind: "columns", id: "row-x" });
  assert.equal(missing.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "1");
});
