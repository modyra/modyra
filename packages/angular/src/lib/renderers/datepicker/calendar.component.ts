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
  addMonths,
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

/**
 * Calendar container — orchestrates header navigation, grid rendering,
 * keyboard navigation, and date selection.
 *
 * This component owns the "current view" state (year/month) and the
 * focused-date for roving keyboard navigation. It does **not** manage
 * the form field value — that responsibility stays in the renderer.
 *
 * ```html
 * <mdy-calendar
 *   [selectedDate]="selected"
 *   [minDate]="min"
 *   [maxDate]="max"
 *   (datePicked)="onPick($event)"
 * />
 * ```
 */
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
    // No static aria-modal: the docked popup does not block the page — the
    // overlay panel adds modal semantics only when a backdrop exists (R17).
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
  readonly selectedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);

  protected readonly view = signal<CalendarView>("calendar");

  private readonly grid = viewChild(MdyCalendarGridComponent);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      const date = this.focusedDate();
      // We use a small timeout to ensure the grid has rendered the new date
      // before we try to focus it.
      afterNextRender(() => this.grid()?.focusDate(date), { injector: this.injector });
    });
  }

  /** Manually focuses the currently focused date cell. */
  focusFocusedDate(): void {
    const focused = this.focusedDate();
    this.grid()?.focusDate(focused);
  }
  /** Accessible label for the dialog. Falls back to the i18n default. */
  readonly ariaLabel = input<string>("");
  private readonly i18n = inject(MDY_I18N_MESSAGES);
  protected readonly effectiveAriaLabel = computed(
    () => this.ariaLabel() || this.i18n.datepickerChooseDate,
  );

  /** Emits when the user confirms a date. */
  readonly datePicked = output<CalendarDate>();
  /** Emits on Escape — parent must close the popup. */
  readonly closed = output<void>();

  // ── View state ──────────────────────────────────────────────────────────────

  /** Year currently displayed. */
  protected readonly viewYear = signal(today().year);
  /** Month (1-based) currently displayed. */
  protected readonly viewMonth = signal(today().month);
  /** Date that has keyboard focus (roving tabindex). */
  protected readonly focusedDate = signal<CalendarDate>(today());

  /**
   * Sync the view to the selected date when the popup opens.
   * Called by the parent renderer after opening.
   * Resets view to 'calendar'.
   */
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
    // Update focused date to same day in new month, clamped to its length
    // (Jan 31 → Feb 28/29, not an invalid "Feb 31").
    const focused = this.focusedDate();
    const day = Math.min(focused.day, daysInMonth(focused.year, month));
    this.focusedDate.set({ ...focused, month, day });
  }

  protected onYearSelected(year: number): void {
    this.viewYear.set(year);
    this.view.set("month");
    // Update focused date to same day in new year, clamped (Feb 29 on leap years)
    const focused = this.focusedDate();
    const day = Math.min(focused.day, daysInMonth(year, focused.month));
    this.focusedDate.set({ ...focused, year, day });
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

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
    // Move focus to same day (clamped) in new month
    const focused = this.focusedDate();
    const newFocused = addMonths(focused, delta);
    this.focusedDate.set(newFocused);
  }

  // ── Date picked ─────────────────────────────────────────────────────────────

  protected onDatePicked(date: CalendarDate): void {
    this.focusedDate.set(date);
    this.datePicked.emit(date);
  }

  // ── Keyboard navigation (M3 spec) ──────────────────────────────────────────

  protected onKeydown(event: KeyboardEvent): void {
    // Date navigation only applies to the day grid — arrows/PageUp in the
    // month/year pickers must not move the focused date behind them (R7).
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

    // Grid navigation (arrows, PageUp/Down, Home/End) is a pure decision
    // shared with every adapter — @modyra/core/keyboard.
    const next = calendarKeyboardTarget(event.key, focused, event.shiftKey);
    if (!next) return; // Don't prevent default for unhandled keys

    if (next) {
      event.preventDefault();
      this.focusedDate.set(next);
      // Ensure the view follows the focused date
      if (next.year !== this.viewYear() || next.month !== this.viewMonth()) {
        this.viewYear.set(next.year);
        this.viewMonth.set(next.month);
      }
    }
  }
}
