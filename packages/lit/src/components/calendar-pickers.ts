/**
 * The month and year views, drawn once for both calendars.
 *
 * The range picker is the date picker copied, and these two templates were where the copy showed:
 * identical but for the kind whose classes they name. What each view *is* — a grid, its cells,
 * which one is chosen, which the bounds refuse — comes from `@modyra/widgets`; this is the lit-html
 * that renders the answer.
 */
import { html, type TemplateResult } from "lit";
import {
  projectCalendarPeriodCellA11y,
  projectCalendarViewA11y,
  type MdyCalendarViewMode,
} from "@modyra/widgets";
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
