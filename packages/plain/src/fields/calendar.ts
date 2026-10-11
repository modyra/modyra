/**
 * The calendar body shared by the datepicker and the daterange.
 *
 * Names come from `buildDateLocale` (Intl), never from a table in this package.
 *
 * Its anatomy is the contract's: `__grid` holds a weekday header row and one `__row` per week,
 * each row holding seven `__cell`s. That nesting is not decoration — the shipped themes lay out
 * the seven columns on the row, so a flat list of cells renders as a single column.
 */
import { buildMonthGrid, calendarYearRange, isMonthOutOfRange, isYearOutOfRange, type CalendarCell, type CalendarDate, type MdyDateLocale } from "@modyra/core/datetime";
import {
  MDY_WIDGET_CONTRACTS, calendarDayId, calendarViewOnZoom, keyBindingFor, partClasses, projectCalendarPeriodCellA11y,
  projectCalendarViewA11y, type MdyCalendarViewA11yOptions, type MdyCalendarViewMode, type MdyWidgetKind,
} from "@modyra/widgets";
import { applyPart, el, setText } from "../dom.js";

export interface CalendarBody {
  readonly grid: HTMLDivElement;
  /** Every rendered day cell, by ISO date, in document order. */
  readonly cells: ReadonlyMap<string, HTMLButtonElement>;
}

function classesOf(kind: MdyWidgetKind, part: string): string {
  const parts = MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, { classes: readonly string[] }>>;
  return (parts[part]?.classes ?? []).join(" ");
}

/** Builds an empty grid element; `fillCalendar` renders a month into it. */
export function buildCalendarGrid(kind: MdyWidgetKind): HTMLDivElement {
  const grid = el("div", classesOf(kind, "grid")) as HTMLDivElement;
  grid.setAttribute("role", "grid");
  return grid;
}

/** Renders one month, replacing whatever the grid held. Returns the day cells by ISO date. */
export function fillCalendar(
  grid: HTMLDivElement,
  kind: MdyWidgetKind,
  year: number,
  month: number,
  locale: MdyDateLocale,
  onPick: (cell: CalendarCell) => void,
  /**
   * The widget these days belong to, so each cell carries the id the contract names for it.
   *
   * A day is what `aria-activedescendant` points at and what a document writes down to reach one
   * cell; without an id there is nothing to point at and nothing to name.
   */
  widgetId?: string,
): ReadonlyMap<string, HTMLButtonElement> {
  const firstDayOfWeek = locale.firstDayOfWeek;
  grid.replaceChildren();

  const weekdays = el("div", classesOf(kind, "weekdays")) as HTMLDivElement;
  weekdays.setAttribute("role", "row");
  for (let index = 0; index < 7; index += 1) {
    // Sunday-first tables rotated by the locale's own first day — both come from Intl via
    // `buildDateLocale`, so a plain-rendered calendar reads in the user's language.
    const day = (firstDayOfWeek + index) % 7;
    const weekday = el("span", classesOf(kind, "weekday"));
    weekday.setAttribute("role", "columnheader");
    weekday.setAttribute("aria-label", locale.dayNamesShort[day]);
    setText(weekday, locale.dayNamesNarrow[day]);
    weekdays.appendChild(weekday);
  }
  grid.appendChild(weekdays);

  const cells = new Map<string, HTMLButtonElement>();
  const month6 = buildMonthGrid(year, month, firstDayOfWeek);
  for (let start = 0; start < month6.length; start += 7) {
    const row = el("div", classesOf(kind, "row")) as HTMLDivElement;
    row.setAttribute("role", "row");
    for (const cell of month6.slice(start, start + 7)) {
      const button = el("button", classesOf(kind, "gridcell")) as HTMLButtonElement;
      button.type = "button";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", cell.iso);
      if (widgetId !== undefined && widgetId !== "") button.id = calendarDayId(widgetId, cell.iso);
      if (!cell.inMonth) button.classList.add("mdy-datepicker__cell--outside");
      setText(button, String(cell.date.day));
      button.addEventListener("click", () => onPick(cell));
      row.appendChild(button);
      cells.set(cell.iso, button);
    }
    grid.appendChild(row);
  }
  return cells;
}

/** The two views a calendar's header switches to, replacing the day grid rather than sitting beside it. */
export interface PeriodViews {
  readonly monthPicker: HTMLDivElement;
  readonly yearPicker: HTMLDivElement;
  /**
   * Shows the view `mode` names and hides the other; the days are the caller's. The shown view is
   * drawn from the year and month on screen, so choosing in it lands where the person was looking.
   */
  render(mode: MdyCalendarViewMode, year: number, month: number): void;
}

/** What choosing in a period view asks of the controller: both calendar kinds answer these two. */
export type PeriodPick = { readonly type: "select-month"; readonly month: number } | { readonly type: "select-year"; readonly year: number };

/**
 * Builds the month and year views for a calendar of `kind`, drawn from the contract's projection:
 * which cells there are, which is chosen, which the bounds refuse and what each announces are its
 * answers, not the renderer's.
 *
 * Both views exist from the start, hidden: an element that only gains its classes when it is shown
 * is an element no test and no theme can name while it is not.
 */
export function buildPeriodViews(
  kind: MdyCalendarViewA11yOptions["kind"],
  widgetId: string,
  locale: MdyDateLocale,
  /** Read at each render rather than once: the bounds a field is given can move after it mounts. */
  bounds: () => { readonly min: CalendarDate | null; readonly max: CalendarDate | null },
  onPick: (pick: PeriodPick) => void,
): PeriodViews {
  const monthPicker = el("div") as HTMLDivElement;
  const yearPicker = el("div") as HTMLDivElement;
  applyPart(monthPicker, projectCalendarViewA11y("months", { kind, widgetId })!);
  applyPart(yearPicker, projectCalendarViewA11y("years", { kind, widgetId })!);
  monthPicker.hidden = true;
  yearPicker.hidden = true;

  function render(mode: MdyCalendarViewMode, year: number, month: number): void {
    const { min, max } = bounds();
    for (const [host, own] of [[monthPicker, "months"], [yearPicker, "years"]] as const) {
      host.hidden = mode !== own;
      if (mode !== own) continue;
      const values = own === "months"
        ? Array.from({ length: 12 }, (_, index) => index + 1)
        : [...calendarYearRange(year, min, max)];
      const current = own === "months" ? month : year;
      host.replaceChildren(...values.map((value) => {
        const button = el("button") as HTMLButtonElement;
        button.type = "button";
        setText(button, own === "months" ? (locale.monthNamesShort[value - 1] ?? String(value)) : String(value));
        applyPart(button, projectCalendarPeriodCellA11y(own, {
          value,
          label: button.textContent ?? String(value),
          selected: value === current,
          disabled: own === "months" ? isMonthOutOfRange(year, value, min, max) : isYearOutOfRange(value, min, max),
        }, { kind, widgetId }));
        button.addEventListener("click", () =>
          onPick(own === "months" ? { type: "select-month", month: value } : { type: "select-year", year: value }));
        return button;
      }));
      if (own === "years") {
        // Guarded: a document without layout has no `scrollIntoView`, and a picker that throws
        // there takes the whole effect down with it.
        host
          .querySelector<HTMLElement>(`.${partClasses(kind, "yearCell", { selected: true }).join(".")}`)
          ?.scrollIntoView?.({ block: "center" });
      }
    }
  }

  return { monthPicker, yearPicker, render };
}

/**
 * Wires the gesture the kind declares for stepping between views — the platform's accelerator held
 * with a vertical arrow — on every element a press inside the calendar reaches.
 *
 * Handled once per press: a press inside the panel reaches each of `listeners`, and a second reading
 * of the same event would step twice. The keys follow the eye: the view a step came from is hidden,
 * so focus left there would sit on an element in no accessibility tree at all, and the landing is
 * the chosen cell of the view reached, or its first choosable one.
 */
export function bindViewZoom(
  kind: MdyCalendarViewA11yOptions["kind"],
  listeners: readonly HTMLElement[],
  hosts: { readonly days: HTMLElement; readonly months: HTMLElement; readonly years: HTMLElement },
  state: () => { readonly open: boolean; readonly viewMode: MdyCalendarViewMode },
  onZoom: (mode: MdyCalendarViewMode) => void,
): void {
  const zoomed = new WeakSet<KeyboardEvent>();
  const onZoomView = (event: KeyboardEvent): void => {
    const current = state();
    if (!current.open || zoomed.has(event)) return;
    const binding = keyBindingFor(kind, event, current.open);
    if (binding?.intent !== "view" || binding.by === undefined) return;
    event.preventDefault();
    zoomed.add(event);
    const reached = calendarViewOnZoom(current.viewMode, binding.by);
    if (reached === current.viewMode) return;
    onZoom(reached);
    queueMicrotask(() => {
      const host = hosts[reached];
      const landing = host.querySelector<HTMLElement>('[aria-selected="true"], [tabindex="0"]')
        ?? host.querySelector<HTMLElement>("button:not([disabled])");
      landing?.focus();
    });
  };
  for (const element of listeners) element.addEventListener("keydown", onZoomView);
}
