/**
 * Renders the "datepicker" kind via createDatepickerFieldController — a
 * trigger button that opens a real calendar grid popup (prev/next month,
 * arrow-key navigation via the shared calendarKeyboardTarget the
 * controller already wires up).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import { buildDateLocale, formatIsoDate, parseLocalizedDate } from "@modyra/core/datetime";
import type { MdyDynamicDateField } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, createDatepickerFieldController, overlayAnchoringFor, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon } from "../dom.js";
import { buildFieldShell, insertControl, errorsToShow } from "../field-shell.js";
import { buildCalendarGrid, fillCalendar } from "./calendar.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, setOverlayOpen, trackOverlay } from "../overlay.js";

export function renderDatepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity: MdyReactivity = vanillaReactivity(),
  options: { readonly minDate?: string | null; readonly maxDate?: string | null; readonly locale?: string; readonly firstDayOfWeek?: number } = {},
  widgetId: string = f.name,
): () => void {
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
  toggle.setAttribute("aria-label", "Open the calendar");
  // The popup, its header and the day cells carry the class names the shipped themes already
  // style (`mdy-datepicker__popup` positions and frames the panel, `__header` lays out the
  // month nav) — the controller only names the trigger and the grid.
  const popup = el("div", `${MDY_WIDGET_CONTRACTS.datepicker.parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const header = el("div", "mdy-datepicker__header") as HTMLDivElement;
  const prevButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  prevButton.type = "button";
  setIcon(prevButton, "CHEVRON_LEFT");
  prevButton.setAttribute("aria-label", "Previous month");
  const monthLabel = el("span", "mdy-datepicker__header-label");
  const nextButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  nextButton.type = "button";
  setIcon(nextButton, "CHEVRON_RIGHT");
  nextButton.setAttribute("aria-label", "Next month");
  header.append(prevButton, monthLabel, nextButton);
  const grid = buildCalendarGrid("datepicker");
  // The calendar frames the month inside the popup. The popup positions and the calendar lays out:
  // the themes give this element the column flow the header and grid sit in, so a popup holding them
  // directly is a picker the shipped themes cannot arrange.
  const calendar = el("div", MDY_WIDGET_CONTRACTS.datepicker.parts.calendar.classes.join(" "));
  calendar.append(header, grid);
  popup.append(calendar);

  const wrapper = el("div", "mdy-datepicker mdy-plain-datepicker");
  wrapper.append(control, toggle, popup);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

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
    setErrors(shell.errorList, errorsToShow(handle).map((e) => e.message));
    shell.syncState({
      touched: handle.touched(), disabled: handle.disabled(),
      hasError: !handle.valid(), filled: state.selectedDate !== "", required: handle.required(),
    });

    // The input mirrors the committed value; while it has focus the user's own text wins.
    const display = state.selectedDate || "";
    if (!typing && control.value !== display) control.value = display;
    setOverlayOpen(popup, state.open);
    // Anchored by the contract, like every other overlay: the placement, the size and the
    // coordinates are `anchorOverlay`'s, and this only measures and applies them.
    if (state.open) positionOverlay(popup, shell.wrapper, anchoring);
    else releaseOverlayPlacement(popup);
    setText(monthLabel, `${dateLocale.monthNamesLong[state.viewMonth - 1]} ${state.viewYear}`);

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

  return () => {
    untrack();
    undismiss();
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
