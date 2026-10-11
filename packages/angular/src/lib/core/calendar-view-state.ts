import { computed, signal, type Signal } from "@angular/core";
import { calendarViewOnToggle, type MdyCalendarViewMode } from "@modyra/widgets";
import { CalendarDate, daysInMonth, parseIsoDate, today } from "@modyra/core/datetime";
import { moveCalendarMonth } from "../renderers/renderer-projection";

/** What a calendar reads while it is showing something, whoever decided it. */
export interface MdyCalendarViewState {
  readonly mode: Signal<MdyCalendarViewMode>;
  readonly year: Signal<number>;
  readonly month: Signal<number>;
  readonly focused: Signal<CalendarDate>;
  toggleView(): void;
  selectMonth(month: number): void;
  selectYear(year: number): void;
  navigate(delta: number): void;
  /** Point the calendar at a date, for a host that opens it on the value it holds. */
  reset(date: CalendarDate | null): void;
  focus(date: CalendarDate): void;
}

/** The half a controller answers: which view, which month, which cell has the keyboard. */
interface CalendarViewSource {
  state(): {
    readonly viewMode: MdyCalendarViewMode;
    readonly viewYear: number;
    readonly viewMonth: number;
    readonly focusedDate: string;
  };
  dispatch(intent: {
    readonly type: "set-view-mode" | "select-month" | "select-year" | "navigate-month";
    readonly mode?: MdyCalendarViewMode;
    readonly month?: number;
    readonly year?: number;
    readonly delta?: number;
  }): unknown;
}

/**
 * The view state of a calendar, from its controller where there is one and from signals where there
 * is not.
 *
 * Both calendars in this package are public and mountable without a form, so both need the second
 * half — and written in each of them the two were identical, which the similarity gate said the
 * moment the single calendar adopted its controller. What differs between a date picker and a range
 * picker is what a *pick* means, never which month is on screen.
 */
export function calendarViewState(source: () => CalendarViewSource | undefined): MdyCalendarViewState {
  const localMode = signal<MdyCalendarViewMode>("days");
  const localYear = signal(today().year);
  const localMonth = signal(today().month);
  const localFocused = signal<CalendarDate>(today());

  const mode = computed(() => source()?.state().viewMode ?? localMode());
  const year = computed(() => source()?.state().viewYear ?? localYear());
  const month = computed(() => source()?.state().viewMonth ?? localMonth());
  const focused = computed(
    () => parseIsoDate(source()?.state().focusedDate ?? "") ?? localFocused(),
  );

  return {
    mode,
    year,
    month,
    focused,
    toggleView(): void {
      const next = calendarViewOnToggle(mode());
      const controller = source();
      if (controller) controller.dispatch({ type: "set-view-mode", mode: next });
      else localMode.set(next);
    },
    selectMonth(nextMonth: number): void {
      const controller = source();
      if (controller) {
        controller.dispatch({ type: "select-month", month: nextMonth });
        return;
      }
      localMonth.set(nextMonth);
      localMode.set("days");
      const current = focused();
      localFocused.set({
        ...current,
        month: nextMonth,
        day: Math.min(current.day, daysInMonth(current.year, nextMonth)),
      });
    },
    selectYear(nextYear: number): void {
      const controller = source();
      if (controller) {
        controller.dispatch({ type: "select-year", year: nextYear });
        return;
      }
      localYear.set(nextYear);
      localMode.set("months");
      const current = focused();
      localFocused.set({
        ...current,
        year: nextYear,
        day: Math.min(current.day, daysInMonth(nextYear, current.month)),
      });
    },
    navigate(delta: number): void {
      const controller = source();
      if (controller) {
        controller.dispatch({ type: "navigate-month", delta });
        return;
      }
      const moved = moveCalendarMonth(year(), month(), focused(), delta);
      localYear.set(moved.year);
      localMonth.set(moved.month);
      localFocused.set(moved.focused);
    },
    reset(date: CalendarDate | null): void {
      // With a controller, opening is an intent it answers and this would be a second hand on it.
      if (source()) return;
      const d = date ?? today();
      localYear.set(d.year);
      localMonth.set(d.month);
      localFocused.set(d);
      localMode.set("days");
    },
    focus(date: CalendarDate): void {
      if (source()) return;
      localFocused.set(date);
      if (date.year !== year() || date.month !== month()) {
        localYear.set(date.year);
        localMonth.set(date.month);
      }
    },
  };
}

/**
 * Puts the keyboard on the days a calendar has just shown again: the grid's tab stop, or its first
 * choosable cell when the grid has none.
 *
 * The controller keeps the focused day inside the shown month, so the stop is normally there; the
 * fallback keeps the keyboard off a view that has gone if a render ever shows a grid without one.
 */
export function landOnTheDays(host: HTMLElement): void {
  const landing = host.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')
    ?? host.querySelector<HTMLElement>('[role="gridcell"]:not([disabled]):not([aria-disabled="true"])');
  landing?.focus();
}

/**
 * Whether a control of this calendar other than its days holds the keyboard, and is still showing.
 *
 * Paging moves the day under the header's buttons too, and the keyboard stays on the button that
 * paged: taken into the grid, the next press of Next would pick a day instead. A control the render
 * has hidden holds nothing, so the days may take the keyboard from it.
 */
export function heldOffTheDays(host: HTMLElement): boolean {
  const active = document.activeElement;
  const grid = host.querySelector('[role="grid"]');
  return active instanceof HTMLElement && host.contains(active) && !(grid?.contains(active) ?? false)
    && active.getClientRects().length > 0;
}

/**
 * Whether a key was pressed on the days, rather than elsewhere in the calendar.
 *
 * The calendar's day keys include Enter and Space, which are also every header button's click: read
 * from a button, they pick the focused day instead of doing what the button says.
 */
export function withinTheGrid(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof Element && target.closest('[role="grid"]') !== null;
}

/**
 * Puts the keyboard on the months a chosen year has just narrowed to: the shown month, or the first
 * the bounds allow.
 *
 * The year view is taken away by the render that shows the months, so focus left on the pressed
 * year falls to the document and the next key goes nowhere in the calendar.
 */
export function landOnTheMonths(host: HTMLElement): void {
  const months = host.querySelector<HTMLElement>('[id$="__months"]');
  const landing = months?.querySelector<HTMLElement>('[aria-selected="true"]:not([disabled])')
    ?? months?.querySelector<HTMLElement>("button:not([disabled])");
  landing?.focus();
}
