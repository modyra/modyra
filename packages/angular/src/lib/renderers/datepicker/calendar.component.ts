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
  CalendarDate,
  daysInMonth,
  isDateInRange,
  today,
} from "@modyra/core/date-utils";
import { calendarKeyboardTarget } from "@modyra/core/keyboard";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyCalendarGridComponent } from "./calendar-grid.component";
import { MdyCalendarHeaderComponent } from "./calendar-header.component";
import { MdyMonthPickerComponent } from "./month-picker.component";
import { MdyYearPickerComponent } from "./year-picker.component";

type CalendarView = "calendar" | "month" | "year";
import { moveCalendarMonth } from "../renderer-projection";

@Component({
  selector: "mdy-calendar",
  standalone: true,
  imports: [
    MdyCalendarHeaderComponent,
    MdyCalendarGridComponent,
    MdyMonthPickerComponent,
    MdyYearPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-datepicker__calendar",
    // No static aria-modal: modal semantics are supplied by the overlay panel
    // only when a backdrop is present.
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
      <mdy-calendar-grid
        [gridId]="gridId()"
        [year]="viewYear()"
        [month]="viewMonth()"
        [selectedDate]="selectedDate()"
        [focusedDate]="focusedDate()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        (datePicked)="onDatePicked($event)"
      />
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
export class MdyCalendarComponent {
  /** Threaded to the grid so the opener can name it. */
  readonly gridId = input<string>("");
  readonly selectedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);

  protected readonly view = signal<CalendarView>("calendar");

  private readonly grid = viewChild(MdyCalendarGridComponent);
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
  readonly ariaLabel = input<string>("");
  private readonly i18n = inject(MDY_I18N_MESSAGES);
  protected readonly effectiveAriaLabel = computed(
    () => this.ariaLabel() || this.i18n.datepickerChooseDate,
  );

  readonly datePicked = output<CalendarDate>();
  readonly closed = output<void>();

  protected readonly viewYear = signal(today().year);
  protected readonly viewMonth = signal(today().month);
  protected readonly focusedDate = signal<CalendarDate>(today());

  syncView(date: CalendarDate | null): void {
    const d = date ?? today();
    this.viewYear.set(d.year);
    this.viewMonth.set(d.month);
    this.focusedDate.set(d);
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
    const moved = moveCalendarMonth(this.viewYear(), this.viewMonth(), this.focusedDate(), delta);
    this.viewYear.set(moved.year);
    this.viewMonth.set(moved.month);
    this.focusedDate.set(moved.focused);
  }

  protected onDatePicked(date: CalendarDate): void {
    this.focusedDate.set(date);
    this.datePicked.emit(date);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.view() !== "calendar") {
      if (event.key === "Escape") {
        event.preventDefault();
        this.view.set("calendar");
      }
      return;
    }
    const focused = this.focusedDate();

    switch (event.key) {
      case "Enter":
      case " ":
        if (isDateInRange(focused, this.minDate(), this.maxDate())) {
          event.preventDefault();
          this.onDatePicked(focused);
        }
        return;
      case "Escape":
        event.preventDefault();
        this.closed.emit();
        return;
    }

    const next = calendarKeyboardTarget(event.key, focused, event.shiftKey);
    if (!next) return; // Don't prevent default for unhandled keys

    if (next) {
      event.preventDefault();
      this.focusedDate.set(next);
      if (next.year !== this.viewYear() || next.month !== this.viewMonth()) {
        this.viewYear.set(next.year);
        this.viewMonth.set(next.month);
      }
    }
  }
}
