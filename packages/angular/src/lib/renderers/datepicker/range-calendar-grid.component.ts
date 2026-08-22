import { calendarDayId, defaultWidgetIdFactory } from "@modyra/widgets";
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
import {
  buildMonthGrid,
  CalendarCell,
  CalendarDate,
  formatIsoDate,
  isDateBetween,
  isDateInRange,
  isSameDay,
  orderDates,
  today,
} from "@modyra/core/datetime";
import { MDY_DATE_LOCALE } from "../../core/date-locale";

@Component({
  selector: "mdy-range-calendar-grid",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-datepicker__grid",
    // The rows below say `role="row"`, which ARIA requires to sit inside a grid, table or rowgroup.
    // Nothing said so, so every row in every calendar was an orphan — axe reports it as a critical
    // required-parent violation. It went unseen because the a11y suite never opened a popup: axe
    // skips hidden subtrees, and a closed overlay panel is hidden.
    // A grid is one of the roles ARIA requires to be named, and the name a calendar takes is the
    // field's own label: it is the words the person read to know what date they are choosing. Left
    // off, a screen reader announces a grid of forty-two cells belonging to nothing.
    "[attr.aria-labelledby]": "labelledBy() || null",
    role: "grid",
  },
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
    <!-- The rows, only while the popup is showing. The grid element itself stays: it is what the
         opener names, and a reference to an element that comes and goes is a reference that dangles
         half the time. What must not stay is forty-two cells a screen reader can walk behind a
         closed panel. -->
    @if (showCells()) {
    @for (row of rows(); track $index) {
      <div class="mdy-datepicker__row" role="row">
        @for (cell of row; track cell.iso) {
          <button
            [attr.id]="dayId(cell.iso)"
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
    }
  `,
})
export class MdyRangeCalendarGridComponent {
  /** The widget these cells belong to, which is what their ids are built from. */
  readonly widgetId = input<string>("");

  /** Whether the popup holding this grid is showing. A closed calendar draws no cells. */
  readonly showCells = input<boolean>(true);

  /** The label naming this grid — the field's own, which is the name the projections point at. */
  protected readonly labelledBy = computed(() =>
    this.widgetId() ? defaultWidgetIdFactory.part(this.widgetId(), "label") : "",
  );


  /** The id the projection gives one day cell, asked for rather than rebuilt. */
  protected dayId(iso: string): string {
    return this.widgetId() ? calendarDayId(this.widgetId(), iso) : "";
  }

  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly rangeStart = input<CalendarDate | null>(null);
  readonly rangeEnd = input<CalendarDate | null>(null);
  readonly hoverDate = input<CalendarDate | null>(null);
  readonly focusedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);
  readonly dateFilter = input<((date: string) => boolean) | null>(null);

  readonly datePicked = output<CalendarDate>();
  readonly dateHovered = output<CalendarDate>();

  private readonly cellBtns = viewChildren("cellBtn", { read: ElementRef });

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

  private readonly cells = computed((): readonly CalendarCell[] =>
    buildMonthGrid(this.year(), this.month(), this.locale.firstDayOfWeek),
  );

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

  protected readonly orderedDayNames = computed((): readonly string[] => {
    const names = this.locale.dayNamesNarrow;
    const start = this.locale.firstDayOfWeek;
    return [...names.slice(start), ...names.slice(0, start)];
  });

  protected readonly orderedDayNamesShort = computed((): readonly string[] => {
    const names = this.locale.dayNamesShort;
    const start = this.locale.firstDayOfWeek;
    return [...names.slice(start), ...names.slice(0, start)];
  });

  private readonly effectiveRange = computed(
    (): readonly [CalendarDate | null, CalendarDate | null] => {
      const start = this.rangeStart();
      const end = this.rangeEnd() ?? this.hoverDate();
      return orderDates(start, end);
    },
  );

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

  protected isCellRangeEndpoint(cell: CalendarCell): boolean {
    const [s, e] = this.effectiveRange();
    return (
      (s !== null && isSameDay(cell.date, s)) ||
      (e !== null && isSameDay(cell.date, e))
    );
  }

  protected isCellRangeStart(cell: CalendarCell): boolean {
    const [s] = this.effectiveRange();
    return s !== null && isSameDay(cell.date, s);
  }

  protected isCellRangeEnd(cell: CalendarCell): boolean {
    const [, e] = this.effectiveRange();
    return e !== null && isSameDay(cell.date, e);
  }

  protected isCellInRange(cell: CalendarCell): boolean {
    const [s, e] = this.effectiveRange();
    return isDateBetween(cell.date, s, e);
  }

  protected onCellClick(cell: CalendarCell): void {
    if (!this.isCellDisabled(cell)) {
      this.datePicked.emit(cell.date);
    }
  }
}
