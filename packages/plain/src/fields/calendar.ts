/**
 * The calendar body shared by the datepicker and the daterange.
 *
 * Names come from `buildDateLocale` (Intl), never from a table in this package.
 *
 * Its anatomy is the contract's: `__grid` holds a weekday header row and one `__row` per week,
 * each row holding seven `__cell`s. That nesting is not decoration — the shipped themes lay out
 * the seven columns on the row, so a flat list of cells renders as a single column.
 */
import { buildMonthGrid, type CalendarCell, type MdyDateLocale } from "@modyra/core/datetime";
import { MDY_WIDGET_CONTRACTS, calendarDayId, type MdyWidgetKind } from "@modyra/widgets";
import { el, setText } from "../dom.js";

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
