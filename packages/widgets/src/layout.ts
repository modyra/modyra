/**
 * How a form arranges its fields.
 *
 * Contract v2 lets a form declare sections and column rows (`MdyDynamicLayoutNode` in
 * `@modyra/core`). What that turns into on screen is this vocabulary: one set of classes and one
 * custom property, so a two-column row is the same two-column row whichever adapter rendered it and
 * whichever theme is loaded. Without it each renderer invents its own grid and no theme can style
 * any of them.
 */

import { MDY_CSS_PROPERTIES } from "./css.js";

/** Canonical class vocabulary for declarative layout. */
export const MDY_LAYOUT_CLASSES = Object.freeze({
  /** A titled group of fields. */
  section: "mdy-layout-section",
  /** The section's title. */
  sectionLabel: "mdy-layout-legend",
  /** A row that divides its width into columns. */
  columns: "mdy-layout-columns",
  /** One column within that row. */
  column: "mdy-layout-column",
});

/**
 * Set by the renderer on a columns row. The foundation divides the row into this many tracks, so a
 * three-column row needs no extra class and no per-count CSS.
 */
export const MDY_LAYOUT_COLUMN_COUNT_PROPERTY = MDY_CSS_PROPERTIES.layout.columnCount;

export type MdyLayoutPart = keyof typeof MDY_LAYOUT_CLASSES;

/** The classes and inline style a layout node needs, ready to apply. */
export function layoutNodeAttributes(
  node: { readonly kind: "section" | "columns"; readonly id: string; readonly columns?: ReadonlyArray<unknown> },
): { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly dataset: Readonly<Record<string, string>> } {
  if (node.kind === "section") {
    return { className: MDY_LAYOUT_CLASSES.section, style: {}, dataset: { layoutId: node.id } };
  }
  return {
    className: MDY_LAYOUT_CLASSES.columns,
    // The count drives the grid; a row with no declared columns still occupies one track rather
    // than collapsing to zero-width tracks.
    style: { [MDY_LAYOUT_COLUMN_COUNT_PROPERTY]: String(Math.max(1, node.columns?.length ?? 1)) },
    dataset: { layoutId: node.id },
  };
}
