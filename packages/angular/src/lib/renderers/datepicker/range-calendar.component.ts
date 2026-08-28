import { type MdyDaterangeFieldController } from "@modyra/widgets";
import { calendarViewState } from "../../core/calendar-view-state";
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
  compareDates,
  formatIsoDate,
  isDateInRange,
  parseIsoDate } from "@modyra/core/datetime";
import { calendarKeyboardTarget } from "@modyra/widgets";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyCalendarHeaderComponent } from "./calendar-header.component";
import { MdyMonthPickerComponent } from "./month-picker.component";
import { MdyRangeCalendarGridComponent } from "./range-calendar-grid.component";
import { MdyYearPickerComponent } from "./year-picker.component";

type RangePhase = "pick-start" | "pick-end";


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
      <mdy-range-calendar-grid
        [showCells]="showCells()"
        [widgetId]="widgetId()"
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
export class MdyRangeCalendarComponent {
  /**
   * The controller for the kind, when there is a field behind this calendar.
   *
   * What a range means — which pick opens it, which closes it, which cells fall between, what the
   * bounds refuse — is its answer. The signals below are the standalone case: this component is
   * public and mountable without a form, and that caller has no controller to ask.
   */
  /** The widget these cells belong to, which is what their ids are built from. */
  readonly widgetId = input<string>("");

  /** Whether the popup holding this calendar is showing; a closed one draws no cells. */
  readonly showCells = input<boolean>(true);

  readonly controller = input<MdyDaterangeFieldController | undefined>(undefined);

  readonly rangeStart = input<CalendarDate | null>(null);
  readonly rangeEnd = input<CalendarDate | null>(null);
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);
  readonly dateFilter = input<((date: string) => boolean) | null>(null);
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

  private readonly viewState = calendarViewState(() => this.controller() as never);
  protected readonly view = this.viewState.mode;
  protected readonly viewYear = this.viewState.year;
  protected readonly viewMonth = this.viewState.month;
  protected readonly focusedDate = this.viewState.focused;
  private readonly _hoverDate = signal<CalendarDate | null>(null);
  protected readonly hoverDate = computed(() => this._hoverDate());

  private readonly _phase = signal<RangePhase>("pick-start");
  private readonly _pendingStart = signal<CalendarDate | null>(null);
  private readonly _pendingEnd = signal<CalendarDate | null>(null);
  protected readonly phase = computed((): RangePhase => {
    const state = this.controller()?.state();
    return state ? (state.picking === "start" ? "pick-start" : "pick-end") : this._phase();
  });
  // What the grid paints is the *previewed* range: the highlight follows the pointer before
  // anything is decided, which is the distinction the controller keeps.
  protected readonly pendingStart = computed(
    () => parseIsoDate(this.controller()?.state().previewed.start ?? "") ?? this._pendingStart(),
  );
  protected readonly pendingEnd = computed(
    () => parseIsoDate(this.controller()?.state().previewed.end ?? "") ?? this._pendingEnd(),
  );

  protected readonly phaseHint = computed((): string =>
    this.phase() === "pick-start"
      ? this.i18n.daterangePickStartHint
      : this.i18n.daterangePickEndHint,
  );

  syncView(start: CalendarDate | null, end: CalendarDate | null): void {
    this.viewState.reset(start);
    if (this.controller()) return;
    this._pendingStart.set(start);
    this._pendingEnd.set(end);
    this._phase.set(start && !end ? "pick-end" : "pick-start");
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
    const controller = this.controller();
    if (controller) {
      // The emit stays: it is this framework's output and nothing the contract knows about.
      const before = controller.state().value;
      controller.dispatch({ type: "select-date", iso: formatIsoDate(date) });
      const after = controller.state().value;
      if (after !== before && after.start && after.end) {
        const s = parseIsoDate(after.start);
        const e = parseIsoDate(after.end);
        if (s && e) this.rangePicked.emit({ start: s, end: e });
      }
      return;
    }
    this.viewState.focus(date);

    if (this.phase() === "pick-start") {
      this._pendingStart.set(date);
      this._pendingEnd.set(null);
      this._phase.set("pick-end");
    } else {
      const start = this.pendingStart();
      if (!start) {
        this._pendingStart.set(date);
        this._phase.set("pick-end");
        return;
      }
      const [s, e] =
        compareDates(start, date) <= 0 ? [start, date] : [date, start];
      this._pendingStart.set(s);
      this._pendingEnd.set(e);
      this.rangePicked.emit({ start: s, end: e });
    }
  }

  protected onDateHovered(date: CalendarDate): void {
    const controller = this.controller();
    if (controller) {
      controller.dispatch({ type: "preview", iso: formatIsoDate(date) });
      return;
    }
    if (this.phase() === "pick-end") this._hoverDate.set(date);
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
    const next: CalendarDate | null = calendarKeyboardTarget(
      event.key,
      focused,
      event.shiftKey,
    );

    switch (event.key) {
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
    }

    if (next) {
      event.preventDefault();
      const controller = this.controller();
      // Moving the focus, paging the month it crosses into and following it with the preview were
      // three writes and are one intent.
      if (controller) {
        controller.dispatch({ type: "keydown", key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
        return;
      }
      this.viewState.focus(next);
      if (this.phase() === "pick-end") this._hoverDate.set(next);
    }
  }
}
