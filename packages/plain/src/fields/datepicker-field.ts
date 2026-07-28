/**
 * Renders the "datepicker" kind via createDatepickerFieldController — a
 * trigger button that opens a real calendar grid popup (prev/next month,
 * arrow-key navigation via the shared calendarKeyboardTarget the
 * controller already wires up).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import { buildDateLocale, formatIsoDate, parseLocalizedDate } from "@modyra/core/datetime";
import type { MdyDynamicDateField } from "@modyra/core";
import { createDatepickerFieldController, MDY_WIDGET_CONTRACTS, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { buildCalendarGrid, fillCalendar } from "./calendar.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer } from "../overlay.js";

export function renderDatepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity: MdyReactivity = vanillaReactivity(),
  options: { readonly minDate?: string | null; readonly maxDate?: string | null; readonly locale?: string; readonly firstDayOfWeek?: number } = {},
): () => void {
  const controller = createDatepickerFieldController({ widgetId: f.name, handle, ...options }, reactivity);
  // Month and weekday names, and the first day of the week, come from Intl via `buildDateLocale`.
  const dateLocale = buildDateLocale(options.locale ?? (typeof navigator === "undefined" ? "en-US" : navigator.language), options.firstDayOfWeek);

  const shell = buildFieldShell(f.label, "datepicker");
  // Same anatomy as the Angular renderer: a typeable input plus a toggle button that opens the
  // calendar, rather than one button doing both jobs.
  const control = el("input", "mdy-datepicker__input") as HTMLInputElement;
  control.type = "text";
  if (f.placeholder) control.placeholder = f.placeholder;
  const toggle = el("button", "mdy-datepicker__toggle") as HTMLButtonElement;
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open the calendar");
  // The popup, its header and the day cells carry the class names the shipped themes already
  // style (`mdy-datepicker__popup` positions and frames the panel, `__header` lays out the
  // month nav) — the controller only names the trigger and the grid.
  const popup = el("div", MDY_WIDGET_CONTRACTS.datepicker.parts.popup.classes.join(" ")) as HTMLDivElement;
  const header = el("div", "mdy-datepicker__header") as HTMLDivElement;
  const prevButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  prevButton.type = "button";
  setText(prevButton, "‹");
  prevButton.setAttribute("aria-label", "Previous month");
  const monthLabel = el("span", "mdy-datepicker__header-label");
  const nextButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  nextButton.type = "button";
  setText(nextButton, "›");
  nextButton.setAttribute("aria-label", "Next month");
  header.append(prevButton, monthLabel, nextButton);
  const grid = buildCalendarGrid("datepicker");
  popup.append(header, grid);

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
  control.addEventListener("click", toggleOverlay);
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

  const undismiss = dismissOnOutsidePointer(
    [wrapper],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(control, view.parts.trigger);
    toggle.disabled = state.disabled;
    applyPart(grid, view.parts.grid);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    // The input mirrors the committed value; while it has focus the user's own text wins.
    const display = state.selectedDate || "";
    if (!typing && control.value !== display) control.value = display;
    popup.hidden = !state.open;
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
    undismiss();
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
