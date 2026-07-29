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

/**
 * The sizes a layout can be authored against.
 *
 * Mobile-first and deliberately few: three names cover phone, tablet and desktop, and a form that
 * needs a fourth is a form arguing with its own content. The widths live here rather than in each
 * theme because a row that becomes two columns at `sm` has to do it at the same width everywhere —
 * a breakpoint that moved per theme would make a layout untestable, which is the point of naming it.
 */
export const MDY_LAYOUT_BREAKPOINTS = Object.freeze({
  /** Narrowest first: what a row looks like before any breakpoint applies. */
  base: "0",
  sm: "40rem",
  md: "64rem",
  lg: "80rem",
});

export type MdyLayoutBreakpoint = keyof typeof MDY_LAYOUT_BREAKPOINTS;

/** How many tracks a row has, per breakpoint. Omitted sizes inherit the next smaller one. */
export type MdyLayoutColumnCounts = Partial<Readonly<Record<MdyLayoutBreakpoint, number>>>;

/** The custom property carrying the track count at each size. */
export const MDY_LAYOUT_COLUMN_COUNT_PROPERTIES: Readonly<Record<MdyLayoutBreakpoint, string>> = Object.freeze({
  base: MDY_CSS_PROPERTIES.layout.columnCount,
  sm: `${MDY_CSS_PROPERTIES.layout.columnCount}-sm`,
  md: `${MDY_CSS_PROPERTIES.layout.columnCount}-md`,
  lg: `${MDY_CSS_PROPERTIES.layout.columnCount}-lg`,
});

/** The classes and inline style a layout node needs, ready to apply. */
export function layoutNodeAttributes(
  node: {
    readonly kind: "section" | "columns";
    readonly id: string;
    readonly columns?: ReadonlyArray<unknown>;
    /** Tracks per breakpoint, when the row is authored responsively. */
    readonly at?: MdyLayoutColumnCounts;
  },
): { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly dataset: Readonly<Record<string, string>> } {
  if (node.kind === "section") {
    return { className: MDY_LAYOUT_CLASSES.section, style: {}, dataset: { layoutId: node.id } };
  }
  const declared = Math.max(1, node.columns?.length ?? 1);
  const at = node.at ?? {};
  // Mobile-first, and the default is the behaviour the foundation already had: one column until the
  // first breakpoint, then the tracks the row declares. Authoring `at` overrides any of the four.
  const counts: Record<string, number> = {
    base: at.base ?? 1,
    sm: at.sm ?? declared,
    ...(at.md !== undefined ? { md: at.md } : {}),
    ...(at.lg !== undefined ? { lg: at.lg } : {}),
  };
  const style: Record<string, string> = {};
  for (const [size, count] of Object.entries(counts)) {
    style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES[size as MdyLayoutBreakpoint]] = String(Math.max(1, count));
  }
  return { className: MDY_LAYOUT_CLASSES.columns, style, dataset: { layoutId: node.id } };
}
