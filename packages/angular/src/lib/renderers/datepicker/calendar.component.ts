import { type MdyDatepickerFieldController } from "@modyra/widgets";
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
  viewChild,
} from "@angular/core";
import {
  CalendarDate,
  isDateInRange,
} from "@modyra/core/datetime";
import { calendarKeyboardTarget } from "@modyra/widgets";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyCalendarGridComponent } from "./calendar-grid.component";
import { MdyCalendarHeaderComponent } from "./calendar-header.component";
import { MdyMonthPickerComponent } from "./month-picker.component";
import { MdyYearPickerComponent } from "./year-picker.component";

import { calendarViewState } from "../../core/calendar-view-state";

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

    @if (view() === "days") {
      <mdy-calendar-grid
        [gridId]="gridId()"
        [widgetId]="widgetId()"
        [year]="viewYear()"
        [month]="viewMonth()"
        [selectedDate]="selectedDate()"
        [focusedDate]="focusedDate()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        (datePicked)="onDatePicked($event)"
      />
    } @else if (view() === "months") {
      <mdy-month-picker
        [widgetId]="widgetId()"
        [viewYear]="viewYear()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [currentMonth]="viewMonth()"
        (monthSelected)="onMonthSelected($event)"
      />
    } @else if (view() === "years") {
      <mdy-year-picker
        [widgetId]="widgetId()"
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
  /** The widget these cells belong to, which is what their ids are built from. */
  readonly widgetId = input<string>("");
  readonly selectedDate = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);

  /**
   * The controller for the kind, when there is a field behind this calendar.
   *
   * Which month is on screen, which cell has the keyboard and which of the three views is showing
   * are its answers. Without one — this component is public and mountable without a form — the same
   * questions are answered by signals, and both halves live in `calendarViewState` because the range
   * calendar needs exactly the same pair.
   */
  readonly controller = input<MdyDatepickerFieldController | undefined>(undefined);

  private readonly viewState = calendarViewState(() => this.controller() as never);
  protected readonly view = this.viewState.mode;

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

  protected readonly viewYear = this.viewState.year;
  protected readonly viewMonth = this.viewState.month;
  protected readonly focusedDate = this.viewState.focused;

  syncView(date: CalendarDate | null): void {
    this.viewState.reset(date);
  }

  /** Where the header goes, answered by the contract rather than by a branch here. */
  protected onToggleView(): void {
    this.viewState.toggleView();
  }

  protected onMonthSelected(month: number): void {
    this.viewState.selectMonth(month);
  }

  protected onYearSelected(year: number): void {
    this.viewState.selectYear(year);
  }

  protected goToPreviousMonth(): void {
    this.navigateMonth(-1);
  }

  protected goToNextMonth(): void {
    this.navigateMonth(1);
  }

  private navigateMonth(delta: number): void {
    this.viewState.navigate(delta);
  }

  protected onDatePicked(date: CalendarDate): void {
    // The emit stays: it is this framework's output and nothing the contract knows about.
    this.viewState.focus(date);
    this.datePicked.emit(date);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.view() !== "days") {
      if (event.key === "Escape") {
        event.preventDefault();
        const controller = this.controller();
        if (controller) controller.dispatch({ type: "set-view-mode", mode: "days" });
        else this.viewState.reset(this.focusedDate());
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
      const controller = this.controller();
      // Moving the focus and paging the month it crosses into were two writes and are one intent.
      if (controller) controller.dispatch({ type: "keydown", key: event.key, shiftKey: event.shiftKey });
      else this.viewState.focus(next);
    }
  }
}
