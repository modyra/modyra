/**
 * The month and year views, drawn once for both calendars.
 *
 * The range picker is the date picker copied, and these two templates were where the copy showed:
 * identical but for the kind whose classes they name. What each view *is* — a grid, its cells,
 * which one is chosen, which the bounds refuse — comes from `@modyra/widgets`; this is the lit-html
 * that renders the answer.
 */
import { html, type TemplateResult } from "lit";
import { buildMonthGrid, type CalendarCell } from "@modyra/core/datetime";
import {
  projectCalendarPeriodCellA11y,
  projectCalendarViewA11y,
  keyMeans,
  type MdyCalendarViewMode } from "@modyra/widgets";
import { mdyPart } from "../mdy-part.js";

/** Which calendar is asking: its catalogue entry names the classes. */
export type CalendarPickerKind = "datepicker" | "daterange";

export interface CalendarPickerOptions {
  readonly kind: CalendarPickerKind;
  readonly widgetId: string;
  /** The month (1–12) or year currently in view, which the cells mark as chosen. */
  readonly current: number;
  readonly disabled: (value: number) => boolean;
  readonly pick: (value: number) => void;
}

function periodGrid(
  mode: Exclude<MdyCalendarViewMode, "days">,
  values: readonly number[],
  label: (value: number) => string,
  options: CalendarPickerOptions,
  wrap: (cells: TemplateResult) => TemplateResult,
): TemplateResult {
  const view = projectCalendarViewA11y(mode, { kind: options.kind, widgetId: options.widgetId })!;
  const cells = html`${values.map(
    (value) => html`
      <button
        type="button"
        ${mdyPart(
          projectCalendarPeriodCellA11y(
            mode,
            {
              value,
              label: label(value),
              selected: value === options.current,
              disabled: options.disabled(value),
            },
            { kind: options.kind, widgetId: options.widgetId },
          ),
        )}
        @click=${() => options.pick(value)}
      >
        ${label(value)}
      </button>
    `,
  )}`;
  return html`<div ${mdyPart(view)}>${wrap(cells)}</div>`;
}

/** The twelve months of the year in view. */
export function renderMonthPicker(
  monthNames: readonly string[],
  options: CalendarPickerOptions,
): TemplateResult {
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  return periodGrid("months", months, (month) => monthNames[month - 1] ?? String(month), options, (cells) => cells);
}

/** The years on offer. The extra wrapper is what the themes scroll. */
export function renderYearPicker(
  years: readonly number[],
  options: CalendarPickerOptions,
): TemplateResult {
  return periodGrid(
    "years",
    years,
    (year) => String(year),
    options,
    (cells) => html`<div class="mdy-datepicker__year-grid">${cells}</div>`,
  );
}

/**
 * The month grid as rows of seven.
 *
 * `buildMonthGrid` gives a flat run of cells because a grid's shape is the renderer's business; a
 * week is seven, and both calendars in this package were chunking it themselves in the same four
 * lines.
 */
export function calendarRows(year: number, month: number, weekStart: number): CalendarCell[][] {
  const cells = buildMonthGrid(year, month, weekStart);
  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7) as CalendarCell[]);
  return rows;
}

/**
 * What a key does inside the grid, for a calendar whose state a controller holds.
 *
 * `Escape` leaves the view it is in — a month or year picker closes back to the days, the days close
 * the popup — and everything else is the contract's `keydown`. Both calendars answered it the same
 * way once they stopped keeping their own view state, which is the moment two identical bodies stop
 * being a coincidence.
 */
export function calendarGridKey(
  event: KeyboardEvent,
  /** Whose grid this is, so the dismissal is read from that kind's declaration rather than named. */
  kind: "datepicker" | "daterange",
  viewMode: MdyCalendarViewMode,
  send: (intent: { readonly type: "set-view-mode"; readonly mode: MdyCalendarViewMode }
    | { readonly type: "keydown"; readonly key: string; readonly shiftKey: boolean;
        readonly ctrlKey?: boolean; readonly metaKey?: boolean }) => void,
  close: () => void,
): void {
  // Asked of the catalogue. The binding declares that a dismissal answers whatever is held with it,
  // and a condition naming the key is a second copy of that rule — the copy is what keeps answering
  // after the declaration changes, which is how every renderer stayed correct for its own reasons.
  // ADR 0168.
  if (keyMeans(kind, event, "cancel", true)) {
    event.preventDefault();
    if (viewMode !== "days") send({ type: "set-view-mode", mode: "days" });
    else close();
    return;
  }
  if (viewMode !== "days") return;
  event.preventDefault();
  send({ type: "keydown", key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
}
