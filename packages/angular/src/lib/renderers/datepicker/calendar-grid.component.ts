import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChildren,
} from "@angular/core";
import {
  buildMonthGrid,
  CalendarCell,
  CalendarDate,
  isDateInRange,
  isSameDay,
  today,
} from "@modyra/core/date-utils";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MdyCalendarCellComponent } from "./calendar-cell.component";

/**
 * Month grid component — renders the 7-column × 6-row calendar body.
 *
 * Receives the currently displayed year/month, selected date, focused date,
 * and min/max bounds. Emits when a date is picked or focus changes via
 * keyboard navigation.
 *
 * ```html
 * <mdy-calendar-grid
 *   [year]="2026"
 *   [month]="3"
 *   [selectedDate]="selected"
 *   [focusedDate]="focused"
 *   [minDate]="min"
 *   [maxDate]="max"
 *   (datePicked)="onPick($event)"
 * />
 * ```
 */
@Component({
  selector: "mdy-calendar-grid",
  standalone: true,
  imports: [MdyCalendarCellComponent],
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
          <mdy-calendar-cell
            [cell]="cell"
            [isSelected]="isCellSelected(cell)"
            [isToday]="isCellToday(cell)"
            [isFocused]="isCellFocused(cell)"
            [isDisabled]="isCellDisabled(cell)"
            (picked)="datePicked.emit($event)"
          />
        }
      </div>
    }
  `,
})
export class MdyCalendarGridComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly selectedDate = input<CalendarDate | null>(null);
  readonly focusedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);

  /** Emits the date the user picked (clicked or pressed Enter/Space). */
  readonly datePicked = output<CalendarDate>();

  private readonly cellsRef = viewChildren(MdyCalendarCellComponent);

  /** Focuses the cell corresponding to the given date. */
  focusDate(date: CalendarDate): void {
    const cell = this.cellsRef().find((c) => isSameDay(c.cell().date, date));
    cell?.focus();
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

  // ── Cell state predicates (called from template per-cell) ──────────────────

  protected isCellSelected(cell: CalendarCell): boolean {
    const sel = this.selectedDate();
    return sel !== null && isSameDay(cell.date, sel);
  }

  protected isCellToday(cell: CalendarCell): boolean {
    return isSameDay(cell.date, this.todayDate);
  }

  protected isCellFocused(cell: CalendarCell): boolean {
    const foc = this.focusedDate();
    return foc !== null && isSameDay(cell.date, foc);
  }

  protected isCellDisabled(cell: CalendarCell): boolean {
    return !isDateInRange(cell.date, this.minDate(), this.maxDate());
  }
}
