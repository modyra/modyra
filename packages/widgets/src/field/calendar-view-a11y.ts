/**
 * The month and year views, projected once for every renderer that draws them.
 *
 * Two renderers grew these views separately, with the same seven class names and no role between
 * them: a keyboard user met a grid of days in one view and a run of bare buttons in the next, with
 * nothing saying which month was chosen. Since a calendar is already a `grid`, so are the views that
 * replace it — the structure a user meets does not change with the view.
 */
import type { MdyPartContract } from "../contract.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { partClasses } from "../part-classes.js";
import type { MdyCalendarViewMode } from "./calendar-view.js";

export interface MdyCalendarViewA11yOptions {
  /** The kind whose catalogue entry names the classes — `datepicker` or `daterange`. */
  readonly kind: "datepicker" | "daterange";
  readonly widgetId: string;
  /**
   * What names the view.
   *
   * Not optional: a `grid` without an accessible name is a grid a screen-reader user meets as an
   * unlabelled table of numbers, and the conformance kit rejects it — which is how this was caught
   * rather than shipped. Defaults to the field's own label, which every renderer already has.
   */
  readonly labelledBy?: string;
}

/** One choosable period — a month of a year, or a year of a run. */
export interface MdyCalendarPeriodCell {
  /** 1–12 for a month, the year itself for a year. */
  readonly value: number;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly focused?: boolean;
}

/** The container of whichever view is showing, or null while the day grid is. */
export function projectCalendarViewA11y(
  mode: MdyCalendarViewMode,
  options: MdyCalendarViewA11yOptions,
): MdyPartContract | null {
  if (mode === "days") return null;
  const part = mode === "months" ? "monthPicker" : "yearPicker";
  return {
    id: `${options.widgetId}__${mode}`,
    classes: [...MDY_WIDGET_CONTRACTS[options.kind].parts[part].classes],
    attributes: {
      role: "grid",
      "aria-labelledby": options.labelledBy ?? `${options.widgetId}__label`,
    },
  };
}

/**
 * One cell of the month or year view.
 *
 * `aria-selected` rather than a class alone: which month is chosen was carried by
 * `--selected` and nothing else, so it was visible and unannounced.
 */
export function projectCalendarPeriodCellA11y(
  mode: Exclude<MdyCalendarViewMode, "days">,
  cell: MdyCalendarPeriodCell,
  options: MdyCalendarViewA11yOptions,
): MdyPartContract {
  const part = mode === "months" ? "monthCell" : "yearCell";
  return {
    classes: [
      // Only `selected`: a refused period wears the native `disabled`, which the themes style, and
      // a class nothing paints is a promise to a theme author that nothing keeps.
      ...partClasses(options.kind, part as never, { selected: cell.selected }),
    ],
    attributes: {
      role: "gridcell",
      "aria-selected": String(cell.selected),
      // A period the bounds refuse is announced as unavailable rather than merely greyed: the
      // native `disabled` also takes it out of the tab order, which is what a grid expects.
      "aria-disabled": String(cell.disabled),
      disabled: cell.disabled,
      ...(cell.focused ? { tabindex: "0" } : { tabindex: "-1" }),
    },
  };
}
