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
  /** The id this widget's opener names through `aria-controls`. */
  readonly gridId = input<string>("");
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
