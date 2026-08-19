/**
 * Date-range field widget types.
 *
 * A range is two dates and a **draft**: the first click picks a start and the second an end, and
 * until the second one lands there is nothing to commit. So the committed value and the one being
 * picked are two separate things, and closing without finishing keeps the first.
 *
 * The third thing, and the one every renderer had to invent: while the end is still open, the cell
 * under the pointer stands in for it. That preview is what makes a range visible before it exists,
 * and it is view state — it never reaches the form.
 */
import type { MdyFieldHandle, MdyInteractivity } from "@modyra/core";
import type { MdyDateRangeValue } from "../behavior.js";
import type { MdyCalendarViewMode } from "./calendar-view.js";

export type { MdyDateRangeValue };

export interface MdyDaterangeFieldControllerOptions {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle; the value is `{ start, end }`, each an ISO `YYYY-MM-DD` or null. */
  readonly handle: MdyFieldHandle<MdyDateRangeValue>;
  /** Inclusive lower bound, ISO `YYYY-MM-DD`. */
  readonly minDate?: string | null;
  /** Inclusive upper bound, ISO `YYYY-MM-DD`. */
  readonly maxDate?: string | null;
  /** 0 = Sunday (default), 1 = Monday, … — pass `locale.firstDayOfWeek` for a real locale. */
  readonly firstDayOfWeek?: number;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
  /**
   * Reads a date a person typed, in whatever form the host offers them.
   *
   * The same door the datepicker has, for the same reason: a renderer parsing text itself and
   * dispatching only when it succeeds makes an unreadable entry vanish — nothing is dispatched, and
   * the next repaint rewrites the input from a value that never changed. Returns an ISO
   * `YYYY-MM-DD`, or `null` for text this locale cannot read.
   */
  readonly parseEntry?: (text: string) => string | null;
}

/**
 * One rendered calendar cell.
 *
 * `rangeStart`, `rangeEnd` and `inRange` are the three questions each renderer was answering for
 * itself — two of them with the same code, the third by comparing ISO strings where the others
 * compared dates. They are answered here, once, against the range being *previewed* rather than the
 * one committed, because that is what a person is looking at while they pick.
 */
export interface MdyDaterangeFieldCell {
  readonly iso: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly rangeStart: boolean;
  readonly rangeEnd: boolean;
  readonly inRange: boolean;
  readonly focused: boolean;
  readonly disabled: boolean;
}

/** Semantic state of a date-range field widget. */
export interface MdyDaterangeFieldState {
  /** What the form holds. */
  readonly value: MdyDateRangeValue;
  /** What is being picked, which equals the value while the overlay is closed. */
  readonly draft: MdyDateRangeValue;
  /**
   * The range as it looks right now, with the previewed end standing in for the missing one.
   *
   * What a renderer paints. Distinct from `draft`, which is what would be committed: a preview is
   * not a decision, and treating it as one commits a range on the first click.
   */
  readonly previewed: MdyDateRangeValue;
  /** Days, months or years — what the popup is showing. See {@link MdyCalendarViewMode}. */
  readonly viewMode: MdyCalendarViewMode;
  readonly viewYear: number;
  readonly viewMonth: number;
  readonly focusedDate: string;
  readonly cells: ReadonlyArray<MdyDaterangeFieldCell>;
  readonly open: boolean;
  /** Whether the next pick sets the start or closes the range. */
  readonly picking: "start" | "end";
  /**
   * What was typed into each end and could not be read, or `null` where there is nothing outstanding.
   *
   * A renderer paints these instead of the formatted value, so text the field could not take stays
   * where the person left it. Both are `null` for a range that was picked or read successfully.
   */
  readonly entryText: { readonly start: string | null; readonly end: string | null };
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

/** User/host intent for a date-range field widget. */
export type MdyDaterangeFieldIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "navigate-month"; readonly delta: number }
  | { readonly type: "set-view-mode"; readonly mode: MdyCalendarViewMode }
  /** Choose a month from the month view; narrows to its days. */
  | { readonly type: "select-month"; readonly month: number }
  /** Choose a year from the year view; narrows to its months. */
  | { readonly type: "select-year"; readonly year: number }
  | { readonly type: "keydown"; readonly key: string; readonly shiftKey?: boolean }
  | { readonly type: "select-date"; readonly iso: string }
  /** The cell under the pointer, or null when it leaves the grid. */
  | { readonly type: "preview"; readonly iso: string | null }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" }
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  /**
   * One end of the range, as the person typed it.
   *
   * Text rather than a parsed date, so the controller decides what happens to what it cannot read:
   * a half-written range is a range, and text nothing can read is kept on screen where it can be
   * corrected instead of being erased on the way out of the field.
   */
  | { readonly type: "type"; readonly end: "start" | "end"; readonly text: string }
  | { readonly type: "blur" };
