import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import {
  addDays,
  addMonths,
  addYears,
  CalendarDate,
  compareDates,
  daysInMonth,
  formatIsoDate,
  isDateInRange,
  today,
} from "../../core/date-utils";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyCalendarHeaderComponent } from "./calendar-header.component";
import { MdyRangeCalendarGridComponent } from "./range-calendar-grid.component";
import { MdyMonthPickerComponent } from "./month-picker.component";
import { MdyYearPickerComponent } from "./year-picker.component";

/** Selection phase for range picking. */
type RangePhase = "pick-start" | "pick-end";

type CalendarView = "calendar" | "month" | "year";

/**
 * Range calendar container — orchestrates header navigation, grid rendering,
 * keyboard navigation, and two-step date range selection.
 */
@Component({
  selector: "mdy-range-calendar",
  standalone: true,
  imports: [
    MdyCalendarHeaderComponent,
    MdyRangeCalendarGridComponent,
    MdyMonthPickerComponent,
    MdyYearPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-datepicker__calendar",
    // No static aria-modal: modal semantics come from the overlay panel
    // only when a backdrop exists (R17).
    role: "dialog",
    "[attr.aria-label]": "effectiveAriaLabel()",
    "(keydown)": "onKeydown($event)",
  },
  template: `
    <mdy-calendar-header
      [year]="viewYear()"
      [month]="viewMonth()"
      (previousMonth)="goToPreviousMonth()"
      (nextMonth)="goToNextMonth()"
      (toggleView)="onToggleView()"
    />
    @if (view() === "calendar") {
      <mdy-range-calendar-grid
        [year]="viewYear()"
        [month]="viewMonth()"
        [rangeStart]="pendingStart()"
        [rangeEnd]="pendingEnd()"
        [hoverDate]="hoverDate()"
        [focusedDate]="focusedDate()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [dateFilter]="dateFilter()"
        (datePicked)="onDatePicked($event)"
        (dateHovered)="onDateHovered($event)"
      />
      <div class="mdy-daterange__hint" aria-live="polite">
        {{ phaseHint() }}
      </div>
    } @else if (view() === "month") {
      <mdy-month-picker
        [viewYear]="viewYear()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [currentMonth]="viewMonth()"
        (monthSelected)="onMonthSelected($event)"
      />
    } @else if (view() === "year") {
      <mdy-year-picker
        [currentYear]="viewYear()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        (yearSelected)="onYearSelected($event)"
      />
    }

  `,
})
export class MdyRangeCalendarComponent {
  readonly rangeStart = input<CalendarDate | null>(null);
  readonly rangeEnd = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);
  readonly dateFilter = input<((date: string) => boolean) | null>(null);
  /** Accessible label for the dialog. Falls back to the i18n default. */
  readonly ariaLabel = input<string>("");
  private readonly i18n = inject(MDY_I18N_MESSAGES);
  protected readonly effectiveAriaLabel = computed(
    () => this.ariaLabel() || this.i18n.daterangeChooseRange,
  );

  readonly rangePicked = output<{
    readonly start: CalendarDate;
    readonly end: CalendarDate;
  }>();
  readonly closed = output<void>();

  private readonly grid = viewChild(MdyRangeCalendarGridComponent);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      const date = this.focusedDate();
      afterNextRender(() => this.grid()?.focusDate(date), { injector: this.injector });
    });
  }

  focusFocusedDate(): void {
    const focused = this.focusedDate();
    this.grid()?.focusDate(focused);
  }

  // ── View state ───────────────────────────────────────────────────────────────

  protected readonly view = signal<CalendarView>("calendar");
  protected readonly viewYear = signal(today().year);
  protected readonly viewMonth = signal(today().month);
  protected readonly focusedDate = signal<CalendarDate>(today());
  protected readonly hoverDate = signal<CalendarDate | null>(null);

  private readonly phase = signal<RangePhase>("pick-start");
  protected readonly pendingStart = signal<CalendarDate | null>(null);
  protected readonly pendingEnd = signal<CalendarDate | null>(null);

  protected readonly phaseHint = computed((): string =>
    this.phase() === "pick-start"
      ? this.i18n.daterangePickStartHint
      : this.i18n.daterangePickEndHint,
  );

  syncView(start: CalendarDate | null, end: CalendarDate | null): void {
    const d = start ?? today();
    this.viewYear.set(d.year);
    this.viewMonth.set(d.month);
    this.focusedDate.set(d);
    this.pendingStart.set(start);
    this.pendingEnd.set(end);
    this.phase.set(start && !end ? "pick-end" : "pick-start");
    this.view.set("calendar");
  }

  protected onToggleView(): void {
    const current = this.view();
    if (current === "calendar") {
      this.view.set("year");
    } else {
      this.view.set("calendar");
    }
  }

  protected onMonthSelected(month: number): void {
    this.viewMonth.set(month);
    this.view.set("calendar");
    // Clamp the day to the target month's length (Jan 31 → Feb 28/29).
    const focused = this.focusedDate();
    const day = Math.min(focused.day, daysInMonth(focused.year, month));
    this.focusedDate.set({ ...focused, month, day });
  }

  protected onYearSelected(year: number): void {
    this.viewYear.set(year);
    this.view.set("month");
    const focused = this.focusedDate();
    const day = Math.min(focused.day, daysInMonth(year, focused.month));
    this.focusedDate.set({ ...focused, year, day });
  }

  protected goToPreviousMonth(): void {
    this.navigateMonth(-1);
  }

  protected goToNextMonth(): void {
    this.navigateMonth(1);
  }

  private navigateMonth(delta: number): void {
    const moved = addMonths(
      { year: this.viewYear(), month: this.viewMonth(), day: 1 },
      delta,
    );
    this.viewYear.set(moved.year);
    this.viewMonth.set(moved.month);
    const newFocused = addMonths(this.focusedDate(), delta);
    this.focusedDate.set(newFocused);
  }

  protected onDatePicked(date: CalendarDate): void {
    this.focusedDate.set(date);

    if (this.phase() === "pick-start") {
      this.pendingStart.set(date);
      this.pendingEnd.set(null);
      this.phase.set("pick-end");
    } else {
      const start = this.pendingStart();
      if (!start) {
        this.pendingStart.set(date);
        this.phase.set("pick-end");
        return;
      }
      const [s, e] =
        compareDates(start, date) <= 0 ? [start, date] : [date, start];
      this.pendingStart.set(s);
      this.pendingEnd.set(e);
      this.rangePicked.emit({ start: s, end: e });
    }
  }

  protected onDateHovered(date: CalendarDate): void {
    if (this.phase() === "pick-end") {
      this.hoverDate.set(date);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Date navigation only applies to the day grid (R7).
    if (this.view() !== "calendar") {
      if (event.key === "Escape") {
        event.preventDefault();
        this.view.set("calendar");
      }
      return;
    }
    const focused = this.focusedDate();
    let next: CalendarDate | null = null;

    switch (event.key) {
      case "ArrowLeft":
        next = addDays(focused, -1);
        break;
      case "ArrowRight":
        next = addDays(focused, 1);
        break;
      case "ArrowUp":
        next = addDays(focused, -7);
        break;
      case "ArrowDown":
        next = addDays(focused, 7);
        break;
      case "PageUp":
        // Clamp the day so Feb 29 → Feb 28 on non-leap years (R6).
        next = event.shiftKey ? addYears(focused, -1) : addMonths(focused, -1);
        break;
      case "PageDown":
        next = event.shiftKey ? addYears(focused, 1) : addMonths(focused, 1);
        break;
      case "Home":
        next = { year: focused.year, month: focused.month, day: 1 };
        break;
      case "End": {
        const lastDay = daysInMonth(focused.year, focused.month);
        next = { year: focused.year, month: focused.month, day: lastDay };
        break;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (!isDateInRange(focused, this.minDate(), this.maxDate())) return;
        {
          const filter = this.dateFilter();
          if (filter !== null && !filter(formatIsoDate(focused))) return;
        }
        this.onDatePicked(focused);
        return;
      case "Escape":
        event.preventDefault();
        this.closed.emit();
        return;
      default:
        return;
    }

    if (next) {
      event.preventDefault();
      this.focusedDate.set(next);
      if (next.year !== this.viewYear() || next.month !== this.viewMonth()) {
        this.viewYear.set(next.year);
        this.viewMonth.set(next.month);
      }
      if (this.phase() === "pick-end") {
        this.hoverDate.set(next);
      }
    }
  }
}
