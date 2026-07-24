/**
 * Headless datepicker field controller. Modeled on Angular's real, working
 * `MdyDatePickerComponent`/`MdyCalendarComponent`
 * (packages/angular/src/lib/renderers/datepicker) — same ISO-string field
 * value, same `{viewYear, viewMonth}` + roving-tabindex `focusedDate` view
 * state, and the *exact* `calendarKeyboardTarget` pure function Angular's
 * own calendar already delegates to (`@modyra/core/keyboard` — nothing
 * reinvented, only wired into this package's `MdyFieldHandle`-driven
 * controller shape, same as option-field-controller.ts).
 *
 * Deliberately not ported in this first cut: the "modal" variant's
 * separate confirm/cancel draft state, and the month/year drill-down
 * sub-views — both are UI affordances layered on top of the same
 * cell-grid/keyboard-nav core this controller already provides, not a
 * distinct semantic contract; a host can still build them by holding its
 * own draft ISO string and only calling `setValue`/`select-date` on
 * confirm.
 */
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  addMonths,
  buildMonthGrid,
  formatIsoDate,
  isDateInRange,
  parseIsoDate,
  today,
  type CalendarDate,
} from "@modyra/core/date-utils";
import { calendarKeyboardTarget } from "@modyra/core/keyboard";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectDatepickerFieldA11y } from "./datepicker-field-a11y.js";
import type {
  MdyDatepickerFieldCell,
  MdyDatepickerFieldControllerOptions,
  MdyDatepickerFieldIntent,
  MdyDatepickerFieldState,
} from "./datepicker-field-types.js";

export interface MdyDatepickerFieldController
  extends MdyWidgetController<MdyDatepickerFieldState, MdyDatepickerFieldIntent> {
  /** Set the selected date (ISO `YYYY-MM-DD` or null) programmatically without producing a command. */
  setValue(iso: string | null): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
}

export function createDatepickerFieldController(
  options: MdyDatepickerFieldControllerOptions,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyDatepickerFieldController {
  const { widgetId, handle, firstDayOfWeek = 0, readonly: initialReadonly = false } = options;

  const minDate = (): CalendarDate | null => parseIsoDate(options.minDate ?? null);
  const maxDate = (): CalendarDate | null => parseIsoDate(options.maxDate ?? null);

  const readonly = reactivity.signal(initialReadonly);
  const open = reactivity.signal(false);

  const initialFocus = parseIsoDate(handle.value()) ?? today();
  const viewYear = reactivity.signal(initialFocus.year);
  const viewMonth = reactivity.signal(initialFocus.month);
  const focusedDate = reactivity.signal(formatIsoDate(initialFocus));

  function moveFocus(target: CalendarDate): void {
    focusedDate.set(formatIsoDate(target));
    if (target.year !== viewYear() || target.month !== viewMonth()) {
      viewYear.set(target.year);
      viewMonth.set(target.month);
    }
  }

  const state: MdySignal<MdyDatepickerFieldState> = reactivity.computed(() => {
    const selectedDate = handle.value();
    const year = viewYear();
    const month = viewMonth();
    const focused = focusedDate();
    const min = minDate();
    const max = maxDate();
    const cells: MdyDatepickerFieldCell[] = buildMonthGrid(year, month, firstDayOfWeek).map((cell) => ({
      iso: cell.iso,
      day: cell.date.day,
      inMonth: cell.inMonth,
      selected: cell.iso === selectedDate,
      focused: cell.iso === focused,
      disabled: !isDateInRange(cell.date, min, max),
    }));
    return {
      selectedDate,
      viewYear: year,
      viewMonth: month,
      focusedDate: focused,
      cells,
      open: open(),
      invalid: !handle.valid(),
      disabled: handle.disabled(),
      readonly: readonly(),
      required: handle.required(),
      touched: handle.touched(),
      dirty: handle.dirty(),
      pending: handle.pending(),
    };
  });

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectDatepickerFieldA11y(currentState, handle.errors(), { widgetId });
    const parts: Record<string, ReturnType<typeof a11yCell>> = {};
    for (const cell of currentState.cells) parts[cell.iso] = a11yCell(cell);
    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        trigger: a11y.trigger,
        grid: a11y.grid,
        description: a11y.description,
        error: a11y.error,
        ...parts,
      },
    };
  });

  function a11yCell(cell: MdyDatepickerFieldCell) {
    return {
      id: `${widgetId}__day__${cell.iso}`,
      classes: [
        "mdy-datepicker__cell",
        ...(cell.inMonth ? [] : ["mdy-datepicker__cell--outside"]),
        ...(cell.selected ? ["mdy-datepicker__cell--selected"] : []),
        ...(cell.focused ? ["mdy-datepicker__cell--focused"] : []),
        ...(cell.disabled ? ["mdy-datepicker__cell--disabled"] : []),
      ],
      attributes: {
        role: "gridcell",
        "aria-selected": cell.selected,
        "aria-disabled": cell.disabled,
        tabindex: cell.focused ? 0 : -1,
      },
    };
  }

  function commitDate(iso: string): readonly MdyUiCommand[] {
    const parsed = parseIsoDate(iso);
    if (!parsed || !isDateInRange(parsed, minDate(), maxDate())) return [];
    handle.set(iso);
    handle.markAsDirty();
    handle.markAsTouched();
    moveFocus(parsed);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function openPicker(): readonly MdyUiCommand[] {
    const current = parseIsoDate(handle.value()) ?? parseIsoDate(focusedDate()) ?? today();
    moveFocus(current);
    open.set(true);
    return [{ type: "open-overlay", anchor: { part: "trigger" } }];
  }

  function closePicker(restoreFocus: boolean): readonly MdyUiCommand[] {
    open.set(false);
    return restoreFocus
      ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
      : [{ type: "close-overlay" }];
  }

  function dispatch(intent: MdyDatepickerFieldIntent): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }
    if (intent.type === "focus") return [];

    if (state().disabled || state().readonly) return [];

    switch (intent.type) {
      case "open":
        return openPicker();
      case "close":
        return closePicker(intent.restoreFocus ?? false);
      case "navigate-month": {
        const next = addMonths({ year: viewYear(), month: viewMonth(), day: 1 }, intent.delta);
        viewYear.set(next.year);
        viewMonth.set(next.month);
        return [];
      }
      case "keydown": {
        if (intent.key === "Escape") return closePicker(true);
        if (intent.key === "Enter" || intent.key === " ") return commitDate(focusedDate());
        const focused = parseIsoDate(focusedDate()) ?? today();
        const target = calendarKeyboardTarget(intent.key, focused, intent.shiftKey ?? false);
        if (target) moveFocus(target);
        return [];
      }
      case "select-date":
        return commitDate(intent.iso);
      case "clear": {
        handle.set(null);
        handle.markAsDirty();
        handle.markAsTouched();
        return [{ type: "mark-dirty" }, { type: "mark-touched" }];
      }
    }
  }

  function setValue(iso: string | null): void {
    handle.set(iso);
    moveFocus(parseIsoDate(iso) ?? today());
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return { state, view, dispatch, setValue, setReadonly, destroy };
}
