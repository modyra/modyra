import { calendarDayId } from "@modyra/widgets";
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
} from "@modyra/core/datetime";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MdyCalendarCellComponent } from "./calendar-cell.component";

@Component({
  selector: "mdy-calendar-grid",
  standalone: true,
  imports: [MdyCalendarCellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-datepicker__grid",
    "[attr.id]": "gridId() || null",
    // The rows below say `role="row"`, which ARIA requires to sit inside a grid, table or rowgroup.
    // Nothing said so, so every row in every calendar was an orphan — axe reports it as a critical
    // required-parent violation. It went unseen because the a11y suite never opened a popup: axe
    // skips hidden subtrees, and a closed overlay panel is hidden.
    // A grid is one of the roles ARIA requires to be named, and the name a calendar takes is the
    // field's own label: it is the words the person read to know what date they are choosing. Left
    // off, a screen reader announces a grid of forty-two cells belonging to nothing.
    "[attr.aria-label]": "gridName()",
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
          <mdy-calendar-cell
            [cell]="cell"
            [cellId]="dayId(cell.iso)"
            [isSelected]="isCellSelected(cell)"
            [isToday]="isCellToday(cell)"
            [isFocused]="isCellFocused(cell)"
            [isDisabled]="isCellDisabled(cell)"
            (picked)="datePicked.emit($event)"
          />
        }
      </div>
    }
    }
  `,
})
export class MdyCalendarGridComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  /** The id this widget's opener names through `aria-controls`. */
  readonly gridId = input<string>("");
  /** The widget these cells belong to, which is what their ids are built from. */
  readonly widgetId = input<string>("");

  /** Whether the popup holding this grid is showing. A closed calendar draws no cells. */
  readonly showCells = input<boolean>(true);

  /**
   * The month on screen, which is what a calendar grid is called.
   *
   * The field's caption already names the dialog around it; naming the grid with the same words says
   * nothing a reader did not just hear, and says nothing about *which month they are in* — which is
   * the one thing that changes as they page. The published grid pattern names it this way, and one
   * renderer already did.
   */
  protected readonly gridName = computed(
    () => `${this.locale.monthNamesLong[this.month() - 1]} ${this.year()}`,
  );


  /** The id the projection gives one day cell, asked for rather than rebuilt. */
  protected dayId(iso: string): string {
    return this.widgetId() ? calendarDayId(this.widgetId(), iso) : "";
  }
  readonly selectedDate = input<CalendarDate | null>(null);
  readonly focusedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);

  readonly datePicked = output<CalendarDate>();

  private readonly cellsRef = viewChildren(MdyCalendarCellComponent);

  focusDate(date: CalendarDate): void {
    const cell = this.cellsRef().find((c) => isSameDay(c.cell().date, date));
    cell?.focus();
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
