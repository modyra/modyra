/**
 * Headless datepicker field controller.
 *
 * The field value is an ISO date string. Which month the calendar is showing and which cell the
 * keyboard is on are view state, held separately: paging to another month does not change the value,
 * and moving focus across the grid does not select. `calendarKeyboardTarget` (`@modyra/core/ui`)
 * answers where an arrow key lands, including across a month boundary.
 *
 * The grid uses a roving tabindex — one cell is reachable by Tab and the arrows move which one — so
 * a calendar is one stop in the page's tab order rather than thirty-odd.
 *
 * No draft state here: selecting commits. A host wanting confirm/cancel holds its own ISO string and
 * calls `setValue` on confirm. Month and year drill-down views are likewise the host's, built on the
 * same grid and keyboard behaviour.
 */
import { blocksValueChange } from "../interactivity.js";
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  addMonths,
  buildMonthGrid,
  formatIsoDate,
  isDateInRange,
  parseIsoDate,
  today,
  type CalendarDate,
} from "@modyra/core/datetime";
import { calendarKeyboardTarget } from "@modyra/core/ui";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectDatepickerFieldA11y } from "./datepicker-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
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
  /**
   * Replace the range of dates on offer, ISO `YYYY-MM-DD` or null for open-ended.
   *
   * A host whose bounds arrive later, or move — a departure date that cannot precede an arrival —
   * tells the controller rather than building a new one, which would forget the month on screen and
   * the cell holding focus.
   */
  setBounds(minDate: string | null, maxDate: string | null): void;
}

export function createDatepickerFieldController(
  options: MdyDatepickerFieldControllerOptions,
  reactivity?: MdyReactivity,
): MdyDatepickerFieldController {
  // Observed through the runtime that owns the handle. A caller that supplies one keeps it
  // and is told when it does not match — a fresh runtime over another form's handle is the
  // defect this registry was added for, and it fails by rendering nothing rather than by
  // raising.
  reactivity = observerFor(options.handle, reactivity);
  const { widgetId, handle, firstDayOfWeek = 0, readonly: initialReadonly = false } = options;

  // Signals, because the grid, what a key may reach and what a cell refuses are all derived from
  // them: bounds that move have to move every answer with them, not only the next one asked for.
  const minIso = reactivity.signal<string | null>(options.minDate ?? null);
  const maxIso = reactivity.signal<string | null>(options.maxDate ?? null);
  const minDate = (): CalendarDate | null => parseIsoDate(minIso());
  const maxDate = (): CalendarDate | null => parseIsoDate(maxIso());

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
      // Out of play, no verdict: a disabled field is not validated by the form, so painting it as
    // failing would show a verdict the form itself ignores. See verdict.ts.
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
      disabled: handle.disabled(),
      // The form owns this state; `setReadonly()` is an imperative override for a renderer with no
    // form behind it.
    readonly: handle.readonly() || readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    //
    // The imperative override can only ever narrow what is permitted: `setReadonly()` serves a
    // renderer with no form behind it, and must not re-enable a field the form disabled.
    interactivity: handle.interactivity() === "enabled" && readonly()
      ? ("readonly" as const)
      : handle.interactivity(),
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
        "aria-selected": String(cell.selected),
        "aria-disabled": String(cell.disabled),
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
    const commands: MdyUiCommand[] = [{ type: "mark-dirty" }, { type: "mark-touched" }];
    // Picking the value answers the question the overlay was opened to ask, so the overlay closes
    // and focus returns to the trigger — the same policy the select follows.
    if (open()) commands.push(...closePicker(true));
    return commands;
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

    if (blocksValueChange(state().interactivity)) return [];

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

  function setBounds(nextMin: string | null, nextMax: string | null): void {
    minIso.set(nextMin);
    maxIso.set(nextMax);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return { state, view, dispatch, setValue, setReadonly, setBounds, destroy };
}
