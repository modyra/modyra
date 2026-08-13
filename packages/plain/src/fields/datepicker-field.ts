/**
 * Renders the "datepicker" kind via createDatepickerFieldController — a
 * trigger button that opens a real calendar grid popup (prev/next month,
 * arrow-key navigation via the shared calendarKeyboardTarget the
 * controller already wires up).
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import { buildDateLocale, formatIsoDate, parseLocalizedDate, calendarYearRange, isMonthOutOfRange, isYearOutOfRange, parseIsoDate } from "@modyra/core/datetime";
import type { MdyDynamicDateField } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  createDatepickerFieldController,
  overlayAnchoringFor,
  shownErrorsOf,
  showsAsInvalid,
  type MdyElementLookup,
  partClasses,
  projectCalendarPeriodCellA11y,
  projectCalendarViewA11y,
  calendarViewOnToggle,
  type MdyCalendarViewMode,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { withControls, type MdyMountedField } from "../field-controls.js";
import { buildCalendarGrid, fillCalendar } from "./calendar.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, setOverlayOpen, trackOverlay } from "../overlay.js";

export function renderDatepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity?: MdyReactivity,
  options: { readonly minDate?: string | null; readonly maxDate?: string | null; readonly locale?: string; readonly firstDayOfWeek?: number } = {},
  widgetId: string = f.name,
  /**
   * The words this control shows. The engine has no opinion about them, so they arrive from the
   * widget contract's tables rather than being written here — three renderers each spelling
   * "open the calendar" is three answers to one question.
   */
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): MdyMountedField {
  reactivity = observerFor(handle, reactivity);
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("datepicker");
  const controller = createDatepickerFieldController({ widgetId: widgetId, handle, ...options }, reactivity);
  // Month and weekday names, and the first day of the week, come from Intl via `buildDateLocale`.
  const dateLocale = buildDateLocale(options.locale ?? (typeof navigator === "undefined" ? "en-US" : navigator.language), options.firstDayOfWeek);

  const shell = buildFieldShell(f.label, "datepicker", {}, f.ariaLabel);
  // The catalogue's datepicker anatomy: a typeable input plus a toggle button that opens the
  // calendar, rather than one button doing both jobs.
  const control = el("input", "mdy-datepicker__input") as HTMLInputElement;
  control.type = "text";
  if (f.placeholder) control.placeholder = f.placeholder;
  const toggle = el("button", "mdy-datepicker__toggle") as HTMLButtonElement;
  setIcon(toggle, "CALENDAR");
  toggle.type = "button";
  toggle.setAttribute("aria-label", messages.datepickerToggleLabel);
  // The popup, its header and the day cells carry the class names the shipped themes already
  // style (`mdy-datepicker__popup` positions and frames the panel, `__header` lays out the
  // month nav) — the controller only names the trigger and the grid.
  const popup = el("div", `${MDY_WIDGET_CONTRACTS.datepicker.parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const header = el("div", "mdy-datepicker__header") as HTMLDivElement;
  const prevButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  prevButton.type = "button";
  setIcon(prevButton, "CHEVRON_LEFT");
  prevButton.setAttribute("aria-label", messages.datepickerPreviousMonth);
  // The header label opens the month view, which opens the year view: paging a month at a time put
  // a birth date thirty clicks away, and the other two renderers had grown this and this one had
  // not. Nobody decided that — see the calendar view contract.
  const monthLabel = el("button", "mdy-datepicker__header-label") as HTMLButtonElement;
  monthLabel.type = "button";
  const nextButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  nextButton.type = "button";
  setIcon(nextButton, "CHEVRON_RIGHT");
  nextButton.setAttribute("aria-label", messages.datepickerNextMonth);
  header.append(prevButton, monthLabel, nextButton);
  const grid = buildCalendarGrid("datepicker");
  // The two views exist from the start, hidden: an element that only gains its classes when it is
  // shown is an element no test and no theme can name while it is not.
  const monthPicker = el("div") as HTMLDivElement;
  const yearPicker = el("div") as HTMLDivElement;
  applyPart(monthPicker, projectCalendarViewA11y("months", { kind: "datepicker", widgetId })!);
  applyPart(yearPicker, projectCalendarViewA11y("years", { kind: "datepicker", widgetId })!);
  monthPicker.hidden = true;
  yearPicker.hidden = true;
  // The calendar frames the month inside the popup. The popup positions and the calendar lays out:
  // the themes give this element the column flow the header and grid sit in, so a popup holding them
  // directly is a picker the shipped themes cannot arrange.
  const calendar = el("div", MDY_WIDGET_CONTRACTS.datepicker.parts.calendar.classes.join(" "));
  calendar.append(header, grid, monthPicker, yearPicker);
  popup.append(calendar);

  const wrapper = el("div", "mdy-datepicker mdy-plain-datepicker");
  wrapper.append(control, toggle, popup);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  /**
   * The month and year views, drawn from the contract's projection: which cells there are, which is
   * chosen, which the bounds refuse and what each announces are its answers, not this renderer's.
   */
  function renderPeriodView(mode: MdyCalendarViewMode, year: number, month: number): void {
    for (const [host, own] of [[monthPicker, "months"], [yearPicker, "years"]] as const) {
      host.hidden = mode !== own;
      if (mode !== own) continue;
      const values = own === "months"
        ? Array.from({ length: 12 }, (_, index) => index + 1)
        : [...calendarYearRange(year, parseIsoDate(options.minDate ?? null), parseIsoDate(options.maxDate ?? null))];
      const current = own === "months" ? month : year;
      host.replaceChildren(...values.map((value) => {
        const button = el("button") as HTMLButtonElement;
        button.type = "button";
        setText(button, own === "months" ? (dateLocale.monthNamesShort[value - 1] ?? String(value)) : String(value));
        applyPart(button, projectCalendarPeriodCellA11y(own, {
          value,
          label: button.textContent ?? String(value),
          selected: value === current,
          disabled: own === "months"
            ? isMonthOutOfRange(year, value, parseIsoDate(options.minDate ?? null), parseIsoDate(options.maxDate ?? null))
            : isYearOutOfRange(value, parseIsoDate(options.minDate ?? null), parseIsoDate(options.maxDate ?? null)),
        }, { kind: "datepicker", widgetId }));
        button.addEventListener("click", () =>
          dispatch(own === "months" ? { type: "select-month", month: value } : { type: "select-year", year: value }));
        return button;
      }));
      if (own === "years") {
        // Guarded: a document without layout has no `scrollIntoView`, and a picker that throws
        // there takes the whole effect down with it.
        host
          .querySelector<HTMLElement>(`.${partClasses("datepicker", "yearCell", { selected: true }).join(".")}`)
          ?.scrollIntoView?.({ block: "center" });
      }
    }
  }

  let cellEls: ReadonlyMap<string, HTMLButtonElement> = new Map();
  let renderedYear: number | null = null;
  let renderedMonth: number | null = null;

  const lookup: MdyElementLookup = (part) => (part === "trigger" ? control : undefined);
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    const commands = controller.dispatch(intent);
    runCommands(commands, lookup, {
      setOpen: () => undefined,
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  // Focus is not a safe "the user is editing" signal here: committing a date restores focus to the
  // input, so a focus-guarded sync would skip the very update that matters. Typing is the signal.
  let typing = false;
  const toggleOverlay = () => dispatch(controller.state().open ? { type: "close", restoreFocus: false } : { type: "open" });
  toggle.addEventListener("click", toggleOverlay);
  // The control opens the overlay and never closes it: it is the field the user types into, so a
  // click there is the caret being placed, not a switch being flipped. The toggle button is the
  // switch. `MDY_POPUP_OPENERS[kind].typeable` is where the contract says so.
  control.addEventListener("click", () => { if (!controller.state().open) dispatch({ type: "open" }); });
  control.addEventListener("input", () => { typing = true; });
  control.addEventListener("blur", () => { typing = false; dispatch({ type: "blur" }); });
  // A typed date commits through the same select-date intent the calendar uses, so parsing is the
  // only thing this renderer adds; an unparseable entry falls back to the current value.
  control.addEventListener("change", () => {
    typing = false;
    const parsed = parseLocalizedDate(control.value, dateLocale.locale);
    if (parsed) dispatch({ type: "select-date", iso: formatIsoDate(parsed) });
    else if (!control.value) dispatch({ type: "clear" });
  });
  prevButton.addEventListener("click", () => dispatch({ type: "navigate-month", delta: -1 }));
  nextButton.addEventListener("click", () => dispatch({ type: "navigate-month", delta: 1 }));
  grid.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) {
      event.preventDefault();
      dispatch({ type: "keydown", key: event.key, shiftKey: event.shiftKey });
    }
  });

  // Escape dismisses from wherever the user is. The grid handles it too, as one of the keys the
  // calendar navigates with, but this overlay does not take focus when it opens — so a user who
  // opened it from the toggle and pressed Escape was holding a dialog that answered nothing. It is
  // the one key an overlay must always answer, which is what makes reaching it from the toggle part
  // of the behaviour rather than a convenience.
  const onEscape = (event: KeyboardEvent): void => {
    if (!controller.state().open) return;
    if (event.key === "Escape") dispatch({ type: "close", restoreFocus: true });
    // Tab is already carrying focus somewhere; pulling it back would trap the user in the control
    // they were leaving.
    else if (event.key === "Tab") dispatch({ type: "close", restoreFocus: false });
  };
  wrapper.addEventListener("keydown", onEscape);
  popup.addEventListener("keydown", onEscape);

  // The header goes to the top of the funnel and choosing narrows back down. Which view it opens
  // is `calendarViewOnToggle`'s answer, not this renderer's: writing it here is how three renderers
  // came to disagree about what the same control does.
  monthLabel.addEventListener("click", () =>
    dispatch({ type: "set-view-mode", mode: calendarViewOnToggle(controller.state().viewMode) }),
  );

  const undismiss = dismissOnOutsidePointer(
    [wrapper],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );

  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(control, view.parts.trigger);
    toggle.disabled = state.disabled;
    applyPart(grid, view.parts.grid);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, shownErrorsOf(handle).map((e) => e.message));
    shell.syncState({
      touched: handle.touched(), disabled: handle.disabled(),
      hasError: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }), filled: state.selectedDate !== "", required: handle.required(),
    });

    // The input mirrors the committed value; while it has focus the user's own text wins.
    const display = state.selectedDate || "";
    if (!typing && control.value !== display) control.value = display;
    setOverlayOpen(popup, state.open);
    // Anchored by the contract, like every other overlay: the placement, the size and the
    // coordinates are `anchorOverlay`'s, and this only measures and applies them.
    if (state.open) positionOverlay(popup, shell.wrapper, anchoring);
    else releaseOverlayPlacement(popup);
    setText(
      monthLabel,
      state.viewMode === "years"
        ? String(state.viewYear)
        : state.viewMode === "months"
          ? String(state.viewYear)
          : `${dateLocale.monthNamesLong[state.viewMonth - 1]} ${state.viewYear}`,
    );
    monthLabel.setAttribute("aria-label", messages.datepickerChangeView(monthLabel.textContent ?? ""));
    // Paging belongs to the day view: in the other two the arrows would move a month nobody is
    // looking at.
    prevButton.hidden = state.viewMode !== "days";
    nextButton.hidden = state.viewMode !== "days";
    grid.hidden = state.viewMode !== "days";
    renderPeriodView(state.viewMode, state.viewYear, state.viewMonth);

    if (renderedYear !== state.viewYear || renderedMonth !== state.viewMonth) {
      // The controller owns which days exist and their state; the shared body owns the anatomy
      // (weekday header, one row per week) the themes lay out.
      cellEls = fillCalendar(grid, "datepicker", state.viewYear, state.viewMonth, dateLocale, (cell) => dispatch({ type: "select-date", iso: cell.iso }));
      renderedYear = state.viewYear;
      renderedMonth = state.viewMonth;
    }
    for (const cell of state.cells) {
      const button = cellEls.get(cell.iso);
      if (!button) continue;
      const part = view.parts[cell.iso];
      if (part) applyPart(button, part);
      button.disabled = cell.disabled;
      if (cell.focused && state.open && document.activeElement !== button) button.focus();
    }
  });

  return withControls(
    () => {
    untrack();
    undismiss();
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
    },
    // Bounds move when a sibling field is answered — a return date that cannot precede a
    // departure — and the controller is told rather than the field remounted, which would forget
    // the month on screen.
    { setBounds: (min, max) => controller.setBounds(min, max) },
  );
}
