import { calendarDayId } from "../ids.js";
import { engageValue, fieldCanBeInvalid } from "./verdict.js";
/**
 * Date-range field controller.
 *
 * The kind that did not have one, and the cost was measurable: each renderer built its range picker
 * by copying its own datepicker — twenty-one duplicated bodies across three packages, seventeen of
 * them byte-identical, none of which the cross-package check could see. The three questions every
 * copy answered separately are answered here: **is this cell the start, is it the end, is it
 * between them** — and one of the three renderers answered the last by comparing ISO strings where
 * the others compared dates.
 *
 * What a range adds over a single date is the draft. The first pick opens a range and the second
 * closes it, so until the second one lands there is nothing to commit and closing keeps what was
 * there. The preview — the cell under the pointer standing in for the end that does not exist yet —
 * is view state and never reaches the form.
 */
import { addMonths, buildMonthGrid, formatIsoDate, isDateInRange, parseIsoDate, today, type CalendarDate } from "@modyra/core/datetime";
import { closeOverlayWhenOutOfPlay } from "./leaving-play.js";
import { calendarKeyboardTarget } from "../keyboard.js";
import { observerFor, type MdyReactivity, type MdySignal } from "@modyra/core";
import { dateRangeValueTransition, type MdyDateRangeValue } from "../behavior.js";
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { keyBindingFor } from "../transitions.js";
import { blocksValueChange } from "../interactivity.js";
import { projectDaterangeFieldA11y } from "./daterange-field-a11y.js";
import type {
  MdyDaterangeFieldCell,
  MdyDaterangeFieldControllerOptions,
  MdyDaterangeFieldIntent,
  MdyDaterangeFieldState,
} from "./daterange-field-types.js";
import { showsAsInvalid } from "./verdict.js";
import { calendarViewAfterPick, type MdyCalendarViewMode } from "./calendar-view.js";

export interface MdyDaterangeFieldController
  extends MdyWidgetController<MdyDaterangeFieldState, MdyDaterangeFieldIntent> {
  /** Set the range programmatically without producing a command. */
  setValue(value: MdyDateRangeValue): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
  /**
   * Replace the range of dates on offer, ISO `YYYY-MM-DD` or null for open-ended.
   *
   * A host whose bounds move — a return date that cannot precede a departure — tells the controller
   * rather than building a new one, which would forget the month on screen and which end the next
   * pick closes.
   */
  setBounds(minDate: string | null, maxDate: string | null): void;
}

const EMPTY: MdyDateRangeValue = { start: null, end: null };

/** A range read in the order a calendar paints it, whichever end was picked first. */
function ordered(a: string | null, b: string | null): MdyDateRangeValue {
  if (a === null || b === null) return { start: a, end: b };
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export function createDaterangeFieldController(
  options: MdyDaterangeFieldControllerOptions,
  reactivity?: MdyReactivity,
): MdyDaterangeFieldController {
  reactivity = observerFor(options.handle, reactivity);
  const { widgetId, handle, firstDayOfWeek = 0, readonly: initialReadonly = false } = options;

  // Signals, because the grid, what a key may reach and what a cell refuses are all derived from
  // them: bounds that move have to move every answer with them, not only the next one asked for.
  const minIso = reactivity.signal<string | null>(options.minDate ?? null);
  const maxIso = reactivity.signal<string | null>(options.maxDate ?? null);
  const bounds = () => ({ minIso: minIso(), maxIso: maxIso() });
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
  const draft = reactivity.signal<MdyDateRangeValue>(handle.value() ?? EMPTY);
  /** The cell under the pointer while the end is still open. Never committed. */
  const preview = reactivity.signal<string | null>(null);

  const anchor = parseIsoDate((handle.value() ?? EMPTY).start) ?? today();
  const viewYear = reactivity.signal(anchor.year);
  const viewMonth = reactivity.signal(anchor.month);
  const focusedDate = reactivity.signal(formatIsoDate(anchor));

  function moveFocus(target: CalendarDate): void {
    focusedDate.set(formatIsoDate(target));
    if (target.year !== viewYear() || target.month !== viewMonth()) {
      viewYear.set(target.year);
      viewMonth.set(target.month);
    }
  }

  /** Whether the next pick opens a range or closes one. */
  const picking = (): "start" | "end" => {
    const current = draft();
    return current.start === null || current.end !== null ? "start" : "end";
  };

  /**
   * The range as it looks right now.
   *
   * While the end is open the previewed cell stands in for it, ordered — a person dragging backwards
   * from their start is picking a range that ends where they began, not an empty one.
   */
  const previewed = (): MdyDateRangeValue => {
    const current = draft();
    if (current.start !== null && current.end === null && preview() !== null) {
      return ordered(current.start, preview());
    }
    return current;
  };

  const state: MdySignal<MdyDaterangeFieldState> = reactivity.computed(() => {
    const committed = handle.value() ?? EMPTY;
    const shown = previewed();
    const year = viewYear();
    const month = viewMonth();
    const focused = focusedDate();
    const min = minDate();
    const max = maxDate();

    const cells: MdyDaterangeFieldCell[] = buildMonthGrid(year, month, firstDayOfWeek).map((cell) => ({
      iso: cell.iso,
      day: cell.date.day,
      inMonth: cell.inMonth,
      // The three questions, answered once. Compared as ISO strings on purpose: a `YYYY-MM-DD` is
      // ordered lexicographically exactly as it is chronologically, and going through a Date to say
      // so is a timezone waiting to shift a day.
      rangeStart: shown.start !== null && cell.iso === shown.start,
      rangeEnd: shown.end !== null && cell.iso === shown.end,
      inRange: shown.start !== null && shown.end !== null
        && cell.iso > shown.start && cell.iso < shown.end,
      focused: cell.iso === focused,
      disabled: !isDateInRange(cell.date, min, max),
    }));

    return {
      value: committed,
      draft: draft(),
      previewed: shown,
      viewMode: viewMode(),
      viewYear: year,
      viewMonth: month,
      focusedDate: focused,
      cells,
      open: open(),
      picking: picking(),
      entryText: { start: startEntry(), end: endEntry() },
      // Out of play, no verdict: a disabled field is not validated by the form, so painting it as
      // failing would show a verdict the form itself ignores. See verdict.ts.
      invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
      disabled: handle.disabled(),
      readonly: handle.readonly() || readonly(),
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
    const a11y = projectDaterangeFieldA11y(currentState, handle.errors(), {
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

      // The key each end submits under, taken from the handle: it is what knows the field's place in
      // the form, and a renderer passing it separately could pass a different one.
      submitName: handle.path,
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
        startControl: a11y.startControl,
        endControl: a11y.endControl,
        toggle: a11y.toggle,
        grid: a11y.grid,
        description: a11y.description,
        error: a11y.error,
        ...parts,
      },
    };
  });

  function a11yCell(cell: MdyDaterangeFieldCell) {
    return {
      id: calendarDayId(widgetId, cell.iso),
      classes: [
        "mdy-datepicker__cell",
        ...(cell.inMonth ? [] : ["mdy-datepicker__cell--outside"]),
        ...(cell.rangeStart ? ["mdy-datepicker__cell--range-start"] : []),
        ...(cell.rangeEnd ? ["mdy-datepicker__cell--range-end"] : []),
        ...(cell.inRange ? ["mdy-datepicker__cell--in-range"] : []),
        ...(cell.focused ? ["mdy-datepicker__cell--focused"] : []),
        ...(cell.disabled ? ["mdy-datepicker__cell--disabled"] : []),
      ],
      attributes: {
        role: "gridcell",
        "aria-selected": String(cell.rangeStart || cell.rangeEnd),
        "aria-disabled": String(cell.disabled),
        tabindex: cell.focused ? 0 : -1,
      },
    };
  }

  /**
   * What was typed into each end and could not be read.
   *
   * Kept rather than parsed away: a range typed into two boxes is written one end at a time, and a
   * renderer that only committed a whole readable range erased a half-written one on the way out of
   * the field. Text that reads cleanly leaves nothing behind here.
   */
  const startEntry = reactivity.signal<string | null>(null);
  const endEntry = reactivity.signal<string | null>(null);

  /** One end, as it was typed. Commits what reads, keeps what does not, and never loses the other. */
  function takeEntry(which: "start" | "end", text: string): readonly MdyUiCommand[] {
    const entry = which === "start" ? startEntry : endEntry;
    const trimmed = text.trim();
    const held = handle.value() ?? EMPTY;
    if (trimmed.length === 0) {
      entry.set(null);
      const next = dateRangeValueTransition({ ...held, [which]: null } as MdyDateRangeValue, bounds());
      draft.set(next);
      // Empty to empty is nothing happening. Leaving the field commits whatever is in the box, so a
      // person who tabbed through an untouched range arrives here with an empty string for an end
      // that was already empty — and marking that as an act is how a traversal came to be read as a
      // decision. ADR 0167.
      if (next.start === held.start && next.end === held.end) return [];
      handle.set(next);
      engageValue(handle);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    }
    const iso = options.parseEntry?.(trimmed) ?? null;
    if (iso === null) {
      // Unreadable: the text stays on screen and this end holds nothing, which is the pair that says
      // "not taken" rather than a field showing one date and holding another.
      entry.set(text);
      const next = dateRangeValueTransition({ ...held, [which]: null } as MdyDateRangeValue, bounds());
      draft.set(next);
      handle.set(next);
      engageValue(handle);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    }
    entry.set(null);
    const parsed = parseIsoDate(iso);
    if (!parsed || !isDateInRange(parsed, minDate(), maxDate())) return [];
    // A half-written range is a range: the other end keeps whatever it held, including nothing.
    const next = dateRangeValueTransition({ ...held, [which]: iso } as MdyDateRangeValue, bounds());
    draft.set(next);
    handle.set(next);
    engageValue(handle);
    moveFocus(parsed);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function pick(iso: string): readonly MdyUiCommand[] {
    const parsed = parseIsoDate(iso);
    if (!parsed || !isDateInRange(parsed, minDate(), maxDate())) return [];
    // A date arriving from the calendar answers whatever was outstanding in the boxes.
    startEntry.set(null);
    endEntry.set(null);
    moveFocus(parsed);
    preview.set(null);

    if (picking() === "start") {
      draft.set({ start: iso, end: null });
      return [];
    }
    // The second pick closes the range and commits it: a range whose ends are both known is an
    // answer, and holding it back behind a confirm button asks the same question twice.
    const next = dateRangeValueTransition(ordered(draft().start, iso), bounds());
    draft.set(next);
    handle.set(next);
    engageValue(handle);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }, ...closePicker(true)];
  }

  function openPicker(): readonly MdyUiCommand[] {
    const committed = handle.value() ?? EMPTY;
    draft.set(committed);
    preview.set(null);
    moveFocus(parseIsoDate(committed.start) ?? parseIsoDate(focusedDate()) ?? today());
    viewMode.set("days");
    open.set(true);
    return [{ type: "open-overlay", anchor: { part: "toggle" } }];
  }

  function closePicker(restoreFocus: boolean): readonly MdyUiCommand[] {
    open.set(false);
    preview.set(null);
    // Opening the panel and closing it is an act on the value — the panel's version of typing and
    // deleting: the person saw what was on offer and took none of it. Touched and not dirty, because
    // nothing about the value changed. ADR 0167.
    handle.markAsTouched();
    return restoreFocus
      ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "toggle" } }]
      : [{ type: "close-overlay" }];
  }

  function dispatch(intent: MdyDaterangeFieldIntent): readonly MdyUiCommand[] {
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
      case "cancel":
        // An unfinished range is not a range. Closing keeps what the form already had, which is why
        // the draft is separate from the value in the first place.
        draft.set(handle.value() ?? EMPTY);
        return closePicker(intent.restoreFocus ?? true);
      case "confirm": {
        const current = draft();
        if (current.start === null || current.end === null) return closePicker(true);
        const next = dateRangeValueTransition(current, bounds());
        handle.set(next);
        engageValue(handle);
        return [{ type: "mark-dirty" }, { type: "mark-touched" }, ...closePicker(true)];
      }
      case "navigate-month": {
        const next = addMonths({ year: viewYear(), month: viewMonth(), day: 1 }, intent.delta);
        viewYear.set(next.year);
        viewMonth.set(next.month);
        return [];
      }
      case "preview":
        preview.set(intent.iso);
        return [];
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
        const declared = keyBindingFor("daterange", {
          key: intent.key,
          ctrlKey: intent.ctrlKey,
          metaKey: intent.metaKey,
          shiftKey: intent.shiftKey,
        }, true);
        const acceleratorHeld = (intent.ctrlKey === true || intent.metaKey === true) && declared === null;
        if (declared?.intent === "cancel") {
          draft.set(handle.value() ?? EMPTY);
          return closePicker(true);
        }
        if (acceleratorHeld) return [];
        if (intent.key === "Enter" || intent.key === " ") return pick(focusedDate());
        const focused = parseIsoDate(focusedDate()) ?? today();
        const target = calendarKeyboardTarget(intent.key, focused, intent.shiftKey ?? false);
        if (target) {
          moveFocus(target);
          // Moving the keyboard through the grid previews the same way the pointer does, or a
          // keyboard user picks the second end without ever seeing the range they are making.
          if (picking() === "end") preview.set(formatIsoDate(target));
        }
        return [];
      }
      case "select-date":
        return pick(intent.iso);
      case "type":
        return takeEntry(intent.end, intent.text);
      case "clear": {
        startEntry.set(null);
        endEntry.set(null);
        draft.set(EMPTY);
        preview.set(null);
        handle.set(EMPTY);
        engageValue(handle);
        return [{ type: "mark-dirty" }, { type: "mark-touched" }];
      }
    }
  }

  function setValue(value: MdyDateRangeValue): void {
    const next = dateRangeValueTransition(value, bounds());
    handle.set(next);
    draft.set(next);
    moveFocus(parseIsoDate(next.start) ?? today());
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
    open.set(false);
    preview.set(null);
  }

  return { state, view, dispatch, setValue, setReadonly, setBounds, destroy };
}
