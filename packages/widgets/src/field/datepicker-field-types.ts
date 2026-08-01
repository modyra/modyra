/**
 * Datepicker field widget types.
 *
 * The committed value is an ISO `YYYY-MM-DD` string or `null`. Which month is on screen
 * (`{viewYear, viewMonth}`) and which cell the keyboard is on (`focusedDate`) are view state kept
 * apart from it, so paging and moving focus change what is shown without selecting anything.
 * Keyboard navigation resolves through `calendarKeyboardTarget` (`@modyra/core/keyboard`).
 *
 * Month and year drill-down views, and a confirm/cancel draft, belong to the host — see
 * datepicker-field-controller.ts.
 */
import type { MdyInteractivity } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";

export interface MdyDatepickerFieldControllerOptions {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle; value is an ISO `YYYY-MM-DD` string or null. */
  readonly handle: MdyFieldHandle<string | null>;
  /** Inclusive lower bound, ISO `YYYY-MM-DD`. */
  readonly minDate?: string | null;
  /** Inclusive upper bound, ISO `YYYY-MM-DD`. */
  readonly maxDate?: string | null;
  /** 0 = Sunday (default), 1 = Monday, … — pass `locale.firstDayOfWeek` from `@modyra/core/date-locale` for a real locale. */
  readonly firstDayOfWeek?: number;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
}

/** One rendered calendar cell — same shape `buildMonthGrid` already produces, so the controller can hand it straight to the host. */
export interface MdyDatepickerFieldCell {
  readonly iso: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly selected: boolean;
  readonly focused: boolean;
  readonly disabled: boolean;
}

/** Semantic state of a datepicker field widget. */
export interface MdyDatepickerFieldState {
  readonly selectedDate: string | null;
  readonly viewYear: number;
  readonly viewMonth: number;
  readonly focusedDate: string;
  readonly cells: ReadonlyArray<MdyDatepickerFieldCell>;
  readonly open: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  /**
   * What the user may do. Ask it through `blocksValueChange`/`blocksFocus` rather than comparing
   * strings — the point of the union is that no call site invents its own combination again.
   */
  readonly interactivity: MdyInteractivity;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

/** User/host intent for a datepicker field widget. */
export type MdyDatepickerFieldIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "navigate-month"; readonly delta: number }
  | { readonly type: "keydown"; readonly key: string; readonly shiftKey?: boolean }
  | { readonly type: "select-date"; readonly iso: string }
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
