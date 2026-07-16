import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChildren,
} from "@angular/core";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import {
  buildMonthGrid,
  CalendarCell,
  CalendarDate,
  isDateBetween,
  formatIsoDate,
  isDateInRange,
  isSameDay,
  orderDates,
  today,
} from "../../core/date-utils";

/**
 * Range-aware month grid — renders a 7-column × 6-row calendar body
 * with visual highlighting for the selected date range.
 *
 * Each cell can be: range-start, range-end, in-range, or none.
 * A hover date is used to show a preview range while the user
 * picks the second endpoint.
 *
 * ```html
 * <mdy-range-calendar-grid
 *   [year]="2026"
 *   [month]="3"
 *   [rangeStart]="start"
 *   [rangeEnd]="end"
 *   [hoverDate]="hover"
 *   [focusedDate]="focused"
 *   [minDate]="min"
 *   [maxDate]="max"
 *   (datePicked)="onPick($event)"
 *   (dateHovered)="onHover($event)"
 * />
 * ```
 */
@Component({
  selector: "mdy-range-calendar-grid",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-datepicker__grid" },
  template: `
    <div class="mdy-datepicker__weekdays" role="row">
      @for (dayName of orderedDayNames(); track $index) {
        <span
          class="mdy-datepicker__weekday"
          role="columnheader"
          [attr.aria-label]="orderedDayNamesShort()[$index]"
        >
          {{ dayName }}
        </span>
      }
    </div>
    @for (row of rows(); track $index) {
      <div class="mdy-datepicker__row" role="row">
        @for (cell of row; track cell.iso) {
          <button
            #cellBtn
            type="button"
            class="mdy-datepicker__cell"
            [class.mdy-datepicker__cell--outside]="!cell.inMonth"
            [class.mdy-datepicker__cell--today]="isCellToday(cell)"
            [class.mdy-datepicker__cell--selected]="isCellRangeEndpoint(cell)"
            [class.mdy-datepicker__cell--range-start]="isCellRangeStart(cell)"
            [class.mdy-datepicker__cell--range-end]="isCellRangeEnd(cell)"
            [class.mdy-datepicker__cell--in-range]="isCellInRange(cell)"
            [class.mdy-datepicker__cell--focused]="isCellFocused(cell)"
            [class.mdy-datepicker__cell--disabled]="isCellDisabled(cell)"
            role="gridcell"
            [attr.aria-selected]="isCellRangeEndpoint(cell)"
            [attr.aria-disabled]="isCellDisabled(cell)"
            [attr.aria-current]="isCellToday(cell) ? 'date' : null"
            [attr.tabindex]="isCellFocused(cell) ? 0 : -1"
            [disabled]="isCellDisabled(cell)"
            (click)="onCellClick(cell)"
            (mouseenter)="dateHovered.emit(cell.date)"
          >
            {{ cell.date.day }}
          </button>
        }
      </div>
    }
  `,
})
export class MdyRangeCalendarGridComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly rangeStart = input<CalendarDate | null>(null);
  readonly rangeEnd = input<CalendarDate | null>(null);
  /** Hover date used to preview the range before second click. */
  readonly hoverDate = input<CalendarDate | null>(null);
  readonly focusedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);
  readonly dateFilter = input<((date: string) => boolean) | null>(null);

  /** Emits the date the user picked (clicked or pressed Enter/Space). */
  readonly datePicked = output<CalendarDate>();
  /** Emits when the user hovers over a cell. */
  readonly dateHovered = output<CalendarDate>();

  private readonly cellBtns = viewChildren("cellBtn", { read: ElementRef });

  /** Focuses the grid cell corresponding to the given date. */
  focusDate(date: CalendarDate): void {
    const allCells = this.cells();
    const index = allCells.findIndex((c) => isSameDay(c.date, date));
    if (index >= 0) {
      const btns = this.cellBtns() as readonly ElementRef<HTMLElement>[];
      btns[index]?.nativeElement.focus();
    }
  }

  private readonly locale = inject(MDY_DATE_LOCALE);
  private readonly todayDate = today();

  /** 42 cells for the month grid. */
  private readonly cells = computed((): readonly CalendarCell[] =>
    buildMonthGrid(this.year(), this.month(), this.locale.firstDayOfWeek),
  );

  /** Cells split into 6 rows of 7. */
  protected readonly rows = computed(
    (): readonly (readonly CalendarCell[])[] => {
      const all = this.cells();
      const result: CalendarCell[][] = [];
      for (let i = 0; i < 42; i += 7) {
        result.push(all.slice(i, i + 7));
      }
      return result;
    },
  );

  /** Day-of-week header names ordered by firstDayOfWeek. */
  protected readonly orderedDayNames = computed((): readonly string[] => {
    const names = this.locale.dayNamesNarrow;
    const start = this.locale.firstDayOfWeek;
    return [...names.slice(start), ...names.slice(0, start)];
  });

  /** Short day names for aria-label on weekday headers. */
  protected readonly orderedDayNamesShort = computed((): readonly string[] => {
    const names = this.locale.dayNamesShort;
    const start = this.locale.firstDayOfWeek;
    return [...names.slice(start), ...names.slice(0, start)];
  });

  /**
   * Effective range, computed from rangeStart + (rangeEnd or hoverDate).
   * Always normalised so `[0] <= [1]`.
   */
  private readonly effectiveRange = computed(
    (): readonly [CalendarDate | null, CalendarDate | null] => {
      const start = this.rangeStart();
      const end = this.rangeEnd() ?? this.hoverDate();
      return orderDates(start, end);
    },
  );

  // ── Cell state predicates ──────────────────────────────────────────────────

  protected isCellToday(cell: CalendarCell): boolean {
    return isSameDay(cell.date, this.todayDate);
  }

  protected isCellFocused(cell: CalendarCell): boolean {
    const foc = this.focusedDate();
    return foc !== null && isSameDay(cell.date, foc);
  }

  protected isCellDisabled(cell: CalendarCell): boolean {
    if (!isDateInRange(cell.date, this.minDate(), this.maxDate())) return true;
    const filter = this.dateFilter();
    return filter !== null ? !filter(formatIsoDate(cell.date)) : false;
  }

  /** True for either range endpoint. */
  protected isCellRangeEndpoint(cell: CalendarCell): boolean {
    const [s, e] = this.effectiveRange();
    return (
      (s !== null && isSameDay(cell.date, s)) ||
      (e !== null && isSameDay(cell.date, e))
    );
  }

  /** True for the range start date specifically. */
  protected isCellRangeStart(cell: CalendarCell): boolean {
    const [s] = this.effectiveRange();
    return s !== null && isSameDay(cell.date, s);
  }

  /** True for the range end date specifically. */
  protected isCellRangeEnd(cell: CalendarCell): boolean {
    const [, e] = this.effectiveRange();
    return e !== null && isSameDay(cell.date, e);
  }

  /** True for dates strictly between start and end. */
  protected isCellInRange(cell: CalendarCell): boolean {
    const [s, e] = this.effectiveRange();
    return isDateBetween(cell.date, s, e);
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  protected onCellClick(cell: CalendarCell): void {
    if (!this.isCellDisabled(cell)) {
      this.datePicked.emit(cell.date);
    }
  }
}
