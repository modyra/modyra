import { calendarDayId } from "../ids.js";
import { staysOpen } from "../transitions.js";
import { engageValue, fieldCanBeInvalid } from "./verdict.js";
/**
 * Headless datepicker field controller.
 *
 * The field value is an ISO date string. Which month the calendar is showing and which cell the
 * keyboard is on are view state, held separately: paging to another month does not change the value,
 * and moving focus across the grid does not select. `calendarKeyboardTarget` (`@modyra/widgets`)
 * answers where an arrow key lands, including across a month boundary.
 *
 * The grid uses a roving tabindex — one cell is reachable by Tab and the arrows move which one — so
 * a calendar is one stop in the page's tab order rather than thirty-odd.
 *
 * No draft state here: selecting commits. A host wanting confirm/cancel holds its own ISO string and
 * calls `setValue` on confirm. Month and year drill-down views are likewise the host's, built on the
 * same grid and keyboard behaviour.
 */
import { keyBindingFor } from "../transitions.js";
import { blocksValueChange } from "../interactivity.js";
import { closeOverlayWhenOutOfPlay } from "./leaving-play.js";
import { moveCalendarFocus } from "./calendar-view.js";
import { closePickerPanel } from "./picker-close.js";
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
import { projectCalendarDayCellA11y } from "./calendar-view-a11y.js";
import { calendarKeyboardTarget } from "../keyboard.js";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectDatepickerFieldA11y } from "./datepicker-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
import { calendarViewAfterPick, type MdyCalendarViewMode } from "./calendar-view.js";
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

  // Which of the three views the popup is showing. State, so a renderer asks rather than deciding:
  // two of them had grown their own and could disagree about where choosing a year lands.
  const viewMode = reactivity.signal<MdyCalendarViewMode>("days");

  const readonly = reactivity.signal(initialReadonly);
  const open = reactivity.signal(false);
  // A field taken out of play does not keep an overlay open over it: the popup looked live, said
  // `aria-expanded="true"` to a screen reader, and answered nothing.
  const stopWatchingPlay = closeOverlayWhenOutOfPlay(reactivity, () => handle.interactivity(), open);

  // What the person typed while it is not a date. Held here rather than in a renderer, because the
  // failure this closes is that neither renderer held it: an unparseable entry committed nothing, a
  // sync effect then rewrote the control from the value, and the text went with no one deciding it
  // should. Two renderers, one absence.
  const entryText = reactivity.signal<string | null>(null);

  const initialFocus = parseIsoDate(handle.value()) ?? today();
  const viewYear = reactivity.signal(initialFocus.year);
  const viewMonth = reactivity.signal(initialFocus.month);
  const focusedDate = reactivity.signal(formatIsoDate(initialFocus));

  function moveFocus(target: CalendarDate): void {
    moveCalendarFocus({ focusedDate, viewYear, viewMonth }, target);
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
      viewMode: viewMode(),
      viewYear: year,
      viewMonth: month,
      focusedDate: focused,
      cells,
      open: staysOpen(open(), handle.disabled()),
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
      entryText: entryText(),
      // The text is only outstanding while it is not a date: every path that produces a value clears
      // it, so holding one is the same fact as it being unreadable. Stated as its own member because
      // a control asks the two different questions — what to show, and whether to explain.
      entryUnreadable: entryText() !== null,
    };
  });

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectDatepickerFieldA11y(currentState, handle.errors(), {
      widgetId,
      // The error container is reserved under any field that can fail a rule, which is a fact about
      // the field and not about the renderer — so the description names one element that never
      // changes, in every renderer, without each deciding it again.
      // Asked defensively: a handle is not obliged to offer either, and a controller that reads
      // both unguarded stops working for one that offers neither — which is a crash where the honest
      // answer is "this field declares no rule I can see".
      errorsReserved: fieldCanBeInvalid({
        required: handle.required?.() ?? false,
        constraints: handle.constraints?.() ?? null,
        disabled: handle.disabled?.() ?? false,
      }),
    });
    // A null prototype, because these keys are data: an option valued `__proto__` assigned into a
    // plain object sets that object's prototype instead of adding a member, so the part vanished and
    // the renderer was handed `undefined` — the control disappeared from the page mid-draw.
    const parts: Record<string, ReturnType<typeof a11yCell>> = Object.create(null);
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
    // The classes and the semantics from the one door, so a renderer applying this part and one
    // building its own cell answer alike. Written out here, it said nothing about today — `today` is
    // a state this part declares and nothing was emitting it, so the day a calendar is always asked
    // about was marked in no renderer that reads this and painted in none either.
    return {
      ...projectCalendarDayCellA11y(
        {
          selected: cell.selected,
          disabled: cell.disabled,
          today: cell.iso === formatIsoDate(today()),
          focused: cell.focused,
          outside: !cell.inMonth,
        },
        { kind: "datepicker", widgetId },
      ),
      id: calendarDayId(widgetId, cell.iso),
    };
  }

  /**
   * A typed entry, judged.
   *
   * Empty clears the field, as leaving a control empty always has. Readable commits through the same
   * door the calendar uses, so a typed date and a picked one are the same event. Unreadable keeps
   * the text and empties the value: a field showing `14:30` while holding a date it never took says
   * "that worked" and is wrong, which is the failure the verdict half exists for.
   */
  function takeEntry(text: string): readonly MdyUiCommand[] {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      entryText.set(null);
      return clearDate();
    }
    const iso = options.parseEntry?.(trimmed) ?? null;
    if (iso !== null) {
      entryText.set(null);
      return commitDate(iso);
    }
    entryText.set(text);
    handle.set(null);
    engageValue(handle);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function commitDate(iso: string): readonly MdyUiCommand[] {
    const parsed = parseIsoDate(iso);
    if (!parsed || !isDateInRange(parsed, minDate(), maxDate())) return [];
    // A date arriving from anywhere answers the outstanding entry: what was on screen has been
    // replaced by something the field can hold, so there is nothing left unread.
    entryText.set(null);
    handle.set(iso);
    engageValue(handle);
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
    viewMode.set("days");
    open.set(true);
    return [{ type: "open-overlay", anchor: { part: "trigger" } }];
  }

  function closePicker(restoreFocus: boolean): readonly MdyUiCommand[] {
    return closePickerPanel({ open, handle }, restoreFocus);
  }

  function dispatch(intent: MdyDatepickerFieldIntent): readonly MdyUiCommand[] {
    // A leaving is not an answer. Focus arriving and going is an act on attention: Tab is how a
    // person reads a form, and a form that treats reading as declining moves false news onto the
    // fields somebody was about to fill in. What makes this field answerable is a change to its
    // value, which `engageValue` records. ADR 0167.
    if (intent.type === "blur") return [];
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
      case "set-view-mode": {
        viewMode.set(intent.mode);
        return [];
      }
      case "select-month": {
        viewMonth.set(intent.month);
        // Choosing narrows: a month lands on its days, so the funnel ends where the picking is.
        viewMode.set(calendarViewAfterPick("months"));
        return [];
      }
      case "select-year": {
        viewYear.set(intent.year);
        viewMode.set(calendarViewAfterPick("years"));
        return [];
      }
      case "keydown": {
        // What survives a held accelerator is read from the catalogue, not decided here. A binding
        // that declares no modifier is bare-only, because opening and committing *add* something the
        // press may not have been aimed at; a dismissal declares `"any"`, because refusing one leaves
        // somebody inside a panel with the way out shut. Naming `Escape` in this line would be a
        // second copy of that rule, and the copy is what stops moving when the declaration does.
        const declared = keyBindingFor("datepicker", {
          key: intent.key,
          ctrlKey: intent.ctrlKey,
          metaKey: intent.metaKey,
          shiftKey: intent.shiftKey,
        }, true);
        // Held at all, whatever the catalogue answers. The condition used to be "held *and* nothing
        // is declared", which held only while no binding claimed a held arrow: the moment one did,
        // the press stopped being refused here and fell through to the movement below, which reads
        // the key name and never the modifier — so the accelerator moved a day as well as changing
        // the view. What a held arrow means is decided where the binding is read, and none of this
        // calendar's movement keys is declared with a modifier. `cancel` is answered first, because
        // a dismissal declares that it survives anything held with it.
        const acceleratorHeld = intent.ctrlKey === true || intent.metaKey === true;
        if (declared?.intent === "cancel") return closePicker(true);
        if (acceleratorHeld) return [];
        if (intent.key === "Enter" || intent.key === " ") return commitDate(focusedDate());
        const focused = parseIsoDate(focusedDate()) ?? today();
        const target = calendarKeyboardTarget(intent.key, focused, intent.shiftKey ?? false);
        if (target) moveFocus(target);
        return [];
      }
      case "select-date":
        return commitDate(intent.iso);
      case "type":
        return takeEntry(intent.text);
      case "clear":
        return clearDate();
    }
  }

  function clearDate(): readonly MdyUiCommand[] {
    entryText.set(null);
    handle.set(null);
    engageValue(handle);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function setValue(iso: string | null): void {
    entryText.set(null);
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
    stopWatchingPlay();
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return { state, view, dispatch, setValue, setReadonly, setBounds, destroy };
}
