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

/** The custom property carrying a column's starting track at each size. */
export const MDY_LAYOUT_COLUMN_START_PROPERTIES: Readonly<Record<MdyLayoutBreakpoint, string>> = Object.freeze({
  base: MDY_CSS_PROPERTIES.layout.columnStart,
  sm: `${MDY_CSS_PROPERTIES.layout.columnStart}-sm`,
  md: `${MDY_CSS_PROPERTIES.layout.columnStart}-md`,
  lg: `${MDY_CSS_PROPERTIES.layout.columnStart}-lg`,
});

/** The custom property carrying whether a column shows at each size. */
export const MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES: Readonly<Record<MdyLayoutBreakpoint, string>> = Object.freeze({
  base: MDY_CSS_PROPERTIES.layout.columnDisplay,
  sm: `${MDY_CSS_PROPERTIES.layout.columnDisplay}-sm`,
  md: `${MDY_CSS_PROPERTIES.layout.columnDisplay}-md`,
  lg: `${MDY_CSS_PROPERTIES.layout.columnDisplay}-lg`,
});

/** Where a slot sits and whether it shows, at one size — Contract v3's per-slot placement. */
export interface MdyLayoutSlotPlacement {
  readonly column?: number;
  readonly hidden?: boolean;
}

/**
 * The inline style a column takes from the slot inside it.
 *
 * A slot's placement is the placement of the column it occupies. That is a deliberate reading rather
 * than a shortcut: `grid-column` and `display` are properties of a grid item, and the column *is* the
 * grid item — a wrapper inside the cell could not move itself into a different track however it was
 * styled. A column holding several slots takes the first placement it is given, so a row built one
 * slot per column — the ordinary case — behaves exactly as written.
 *
 * Sizes cascade the way the track count already does: what a size does not say, it inherits from the
 * next smaller one. Only the sizes actually authored are emitted, so a slot that says nothing adds
 * no properties and a column with no slot is untouched.
 */
export function layoutSlotStyle(
  at: Partial<Readonly<Record<MdyLayoutBreakpoint, MdyLayoutSlotPlacement>>> | undefined,
): Readonly<Record<string, string>> {
  const style: Record<string, string> = {};
  if (!at) return style;
  for (const size of Object.keys(MDY_LAYOUT_BREAKPOINTS) as MdyLayoutBreakpoint[]) {
    const placement = at[size];
    if (!placement) continue;
    if (placement.column !== undefined) {
      style[MDY_LAYOUT_COLUMN_START_PROPERTIES[size]] = String(Math.max(1, Math.trunc(placement.column)));
    }
    if (placement.hidden !== undefined) {
      // `display` rather than a hidden class: a class cannot be undone at a larger size without a
      // second class saying the opposite, and "shown at lg" is the case that makes this worth having.
      style[MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES[size]] = placement.hidden ? "none" : "flex";
    }
  }
  return style;
}

/** The classes and inline style a layout node needs, ready to apply. */
export function layoutNodeAttributes(
  node: {
    readonly kind: "section" | "columns";
    readonly id: string;
    readonly columns?: ReadonlyArray<unknown>;
    /**
     * Tracks per breakpoint on a row. A section's `at` is a placement rather than a count — it says
     * where the section's own column sits — and is read by `layoutSlotStyle`, not here.
     */
    readonly at?: MdyLayoutColumnCounts | Partial<Readonly<Record<MdyLayoutBreakpoint, MdyLayoutSlotPlacement>>>;
  },
): { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly dataset: Readonly<Record<string, string>> } {
  if (node.kind === "section") {
    return { className: MDY_LAYOUT_CLASSES.section, style: {}, dataset: { layoutId: node.id } };
  }
  const declared = Math.max(1, node.columns?.length ?? 1);
  // A row's `at` is counts, and only counts are read. `at` is spelled the same on a section, where it
  // is a placement instead, so anything that is not a number is ignored rather than turned into
  // `NaN` tracks — the two shapes meet whenever a layout is walked as a union.
  const raw = (node.at ?? {}) as Readonly<Record<string, unknown>>;
  const count = (size: MdyLayoutBreakpoint): number | undefined =>
    typeof raw[size] === "number" ? (raw[size] as number) : undefined;
  // Mobile-first, and the default is the behaviour the foundation already had: one column until the
  // first breakpoint, then the tracks the row declares. Authoring `at` overrides any of the four.
  const counts: Record<string, number> = {
    base: count("base") ?? 1,
    sm: count("sm") ?? declared,
    ...(count("md") !== undefined ? { md: count("md")! } : {}),
    ...(count("lg") !== undefined ? { lg: count("lg")! } : {}),
  };
  const style: Record<string, string> = {};
  for (const [size, count] of Object.entries(counts)) {
    style[MDY_LAYOUT_COLUMN_COUNT_PROPERTIES[size as MdyLayoutBreakpoint]] = String(Math.max(1, count));
  }
  return { className: MDY_LAYOUT_CLASSES.columns, style, dataset: { layoutId: node.id } };
}
