/**
 * The declarative layout contract: the vocabulary a form's sections and column rows render as.
 * Asserted here so an adapter cannot quietly invent its own grid, and a theme has one set of
 * classes to style.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MDY_LAYOUT_CLASSES,
  MDY_LAYOUT_COLUMN_COUNT_PROPERTY,
  MDY_LAYOUT_COLUMN_COUNT_PROPERTIES,
  MDY_LAYOUT_BREAKPOINTS,
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

test("a columns row publishes how many tracks it wants, narrowest first", () => {
  const attributes = layoutNodeAttributes({ kind: "columns", id: "row-1", columns: [["a"], ["b"], ["c"]] });
  assert.equal(attributes.className, MDY_LAYOUT_CLASSES.columns);
  // Mobile-first: a row is a stack on a phone and takes its declared tracks from the first
  // breakpoint up. That is exactly what the foundation's single `max-width: 40rem` rule did for
  // every row alike; the difference is that each step is now a number the layout supplies.
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "1");
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.sm], "3");
});

test("a row with no columns still occupies one track", () => {
  // Zero tracks would collapse the row and take its fields off the page.
  const empty = layoutNodeAttributes({ kind: "columns", id: "row-0", columns: [] });
  assert.equal(empty.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "1");
  assert.equal(empty.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.sm], "1");
  const missing = layoutNodeAttributes({ kind: "columns", id: "row-x" });
  assert.equal(missing.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "1");
});

test("a row can be authored per breakpoint", () => {
  const attributes = layoutNodeAttributes({
    kind: "columns", id: "row-2", columns: [["a"], ["b"], ["c"], ["d"]],
    at: { base: 2, md: 3, lg: 4 },
  });
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTY], "2");
  // `sm` was not authored, so it falls back to the tracks the row declares.
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.sm], "4");
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.md], "3");
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.lg], "4");
});

test("a size nobody authored is not emitted, so the CSS falls back to the one below", () => {
  const attributes = layoutNodeAttributes({ kind: "columns", id: "row-3", columns: [["a"], ["b"]] });
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.md], undefined);
  assert.equal(attributes.style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.lg], undefined);
});

test("the breakpoints are named once, and the foundation switches at those widths", () => {
  assert.deepEqual(Object.keys(MDY_LAYOUT_BREAKPOINTS), ["base", "sm", "md", "lg"]);
  const css = readFileSync(new URL("../../styles/src/modyra.css", import.meta.url), "utf8");
  for (const [size, width] of Object.entries(MDY_LAYOUT_BREAKPOINTS)) {
    if (size === "base") continue;
    assert.ok(css.includes(`@media (min-width: ${width})`), `the foundation never switches at ${size} (${width})`);
  }
});
