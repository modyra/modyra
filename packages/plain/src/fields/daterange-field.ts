/**
 * Renders the "daterange" kind: two endpoints in one wrapper, a toggle, and a calendar popup that
 * edits a draft and commits on confirm.
 *
 * There is no daterange controller in `@modyra/widgets` — the widget is the range *policy*
 * (`dateRangeValueTransition`, `dateRangeDraftTransition`) plus the shared field anatomy, so this
 * renderer owns only DOM and events. Anything that decides what a range means lives in widgets.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicDaterangeField } from "@modyra/core";
import { addMonths, buildDateLocale, formatIsoDate, parseIsoDate, parseLocalizedDate, today } from "@modyra/core/datetime";
import {
  dateRangeDraftTransition,
  MDY_WIDGET_CONTRACTS,
  type MdyDateRangeDraftState,
  type MdyDateRangeValue,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, trackOverlay } from "../overlay.js";
import { buildCalendarGrid, fillCalendar } from "./calendar.js";

const EMPTY: MdyDateRangeValue = { start: null, end: null };

function asRange(value: unknown): MdyDateRangeValue {
  if (!value || typeof value !== "object") return EMPTY;
  const candidate = value as Partial<MdyDateRangeValue>;
  return { start: candidate.start ?? null, end: candidate.end ?? null };
}

export function renderDaterangeField(
  container: HTMLElement,
  f: MdyDynamicDaterangeField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
  options: { readonly minDate?: string | null; readonly maxDate?: string | null; readonly locale?: string; readonly firstDayOfWeek?: number } = {},
): () => void {
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = MDY_WIDGET_CONTRACTS.daterange.capabilities.anchoring;
  const definition = MDY_WIDGET_CONTRACTS.daterange;
  const bounds = { minIso: options.minDate ?? null, maxIso: options.maxDate ?? null };
  // Month and weekday names, and which day starts the week, all come from Intl through
  // `buildDateLocale` — the same bundle the Angular renderer is given by DI.
  const dateLocale = buildDateLocale(options.locale ?? (typeof navigator === "undefined" ? "en-US" : navigator.language), options.firstDayOfWeek);

  const draft = reactivity.signal<MdyDateRangeDraftState>({
    committed: asRange(handle.value()), draft: asRange(handle.value()), open: false,
  });
  const view = reactivity.signal(today());

  const shell = buildFieldShell(f.label, "daterange");
  const wrapper = el("div", "mdy-datepicker mdy-plain-daterange");
  const startInput = el("input", "mdy-datepicker__input mdy-daterange__input") as HTMLInputElement;
  startInput.type = "text";
  startInput.autocomplete = "off";
  startInput.setAttribute("aria-label", `${f.label ?? "Range"} — start`);
  startInput.placeholder = f.placeholder ?? "Start";
  const separator = el("span", "mdy-daterange__sep");
  separator.setAttribute("aria-hidden", "true");
  setText(separator, "–");
  const endInput = el("input", "mdy-datepicker__input mdy-daterange__input") as HTMLInputElement;
  endInput.type = "text";
  endInput.autocomplete = "off";
  endInput.setAttribute("aria-label", `${f.label ?? "Range"} — end`);
  endInput.placeholder = "End";
  const toggle = el("button", "mdy-datepicker__toggle") as HTMLButtonElement;
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open the calendar");
  toggle.setAttribute("aria-haspopup", "dialog");

  const popup = el("div", `${MDY_WIDGET_CONTRACTS.daterange.parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const header = el("div", "mdy-datepicker__header") as HTMLDivElement;
  const prevButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  prevButton.type = "button";
  prevButton.setAttribute("aria-label", "Previous month");
  setText(prevButton, "‹");
  const monthLabel = el("span", "mdy-datepicker__header-label");
  const nextButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  nextButton.type = "button";
  nextButton.setAttribute("aria-label", "Next month");
  setText(nextButton, "›");
  header.append(prevButton, monthLabel, nextButton);
  const grid = buildCalendarGrid("daterange");
  const actions = el("div", "mdy-datepicker__actions") as HTMLDivElement;
  const cancelButton = el("button", "mdy-datepicker__action-btn") as HTMLButtonElement;
  cancelButton.type = "button";
  setText(cancelButton, "Cancel");
  const applyButton = el("button", "mdy-datepicker__action-btn mdy-datepicker__action-btn--primary") as HTMLButtonElement;
  applyButton.type = "button";
  setText(applyButton, "Apply");
  actions.append(cancelButton, applyButton);
  popup.append(header, grid, actions);

  wrapper.append(startInput, separator, endInput, toggle, popup);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  function dispatch(intent: Parameters<typeof dateRangeDraftTransition>[1]): void {
    const transition = dateRangeDraftTransition(draft(), intent, bounds);
    draft.set(transition.state);
    if (transition.commit) {
      handle.set(transition.commit);
      handle.markAsDirty();
    }
    if (transition.restoreFocus) startInput.focus();
  }

  /** Clicking a day extends the draft: a complete range restarts, an open one closes. */
  function pickDate(iso: string): void {
    const current = draft().draft;
    const completing = current.start !== null && current.end === null;
    const next = completing ? { start: current.start, end: iso } : { start: iso, end: null };
    dispatch({ type: "select", value: next });
    // Choosing the second endpoint answers the question the overlay asked: commit and close,
    // rather than leaving the calendar open over a finished selection.
    if (completing) dispatch({ type: "confirm" });
  }

  function commitTyped(): void {
    const parse = (raw: string): string | null => {
      const parsed = parseLocalizedDate(raw, dateLocale.locale);
      return parsed ? formatIsoDate(parsed) : null;
    };
    dispatch({ type: "select", value: { start: parse(startInput.value), end: parse(endInput.value) } });
    dispatch({ type: "confirm" });
  }

  // Committing from the calendar restores focus to the start input, so the endpoints are synced
  // unless the user is mid-edit.
  let typing = false;
  const openPopup = () => {
    dispatch({ type: "open", committed: asRange(handle.value()) });
    const anchor = parseIsoDate(draft().draft.start) ?? today();
    view.set(anchor);
  };
  toggle.addEventListener("click", () => (draft().open ? dispatch({ type: "cancel" }) : openPopup()));
  for (const input of [startInput, endInput]) {
    input.addEventListener("input", () => { typing = true; });
    input.addEventListener("change", () => { typing = false; commitTyped(); });
    input.addEventListener("blur", () => { typing = false; handle.markAsTouched(); });
  }
  prevButton.addEventListener("click", () => view.set(addMonths(view(), -1)));
  nextButton.addEventListener("click", () => view.set(addMonths(view(), 1)));
  cancelButton.addEventListener("click", () => dispatch({ type: "cancel" }));
  applyButton.addEventListener("click", () => dispatch({ type: "confirm" }));
  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dispatch({ type: "cancel" });
  });

  const undismiss = dismissOnOutsidePointer([wrapper], () => draft().open, () => dispatch({ type: "cancel" }));

  let cellEls: ReadonlyMap<string, HTMLButtonElement> = new Map();
  let renderedMonth = "";

  const untrack = trackOverlay(popup, shell.wrapper, () => draft().open, anchoring);

  const effectRef = reactivity.effect(() => {
    const state = draft();
    const anchor = view();
    const value = state.open ? state.draft : asRange(handle.value());

    applyPart(shell.root, definition.parts.root);
    applyPart(startInput, definition.parts.startControl);
    applyPart(endInput, definition.parts.endControl);
    for (const [input, iso] of [[startInput, value.start], [endInput, value.end]] as const) {
      if (!typing) input.value = iso ?? "";
      input.disabled = handle.disabled();
    }
    toggle.disabled = handle.disabled();
    toggle.setAttribute("aria-expanded", String(state.open));
    popup.hidden = !state.open;
    // Anchored by the contract, like every other overlay: the placement, the size and the
    // coordinates are `anchorOverlay`'s, and this only measures and applies them.
    if (state.open) positionOverlay(popup, shell.wrapper, anchoring);
    else releaseOverlayPlacement(popup);
    setErrors(shell.errorList, handle.errors().map((error) => error.message));
    shell.syncState({
      touched: handle.touched(), disabled: handle.disabled(),
      hasError: !handle.valid(), filled: value.start !== null, required: handle.required(),
    });

    const monthKey = `${anchor.year}-${anchor.month}`;
    setText(monthLabel, `${dateLocale.monthNamesLong[anchor.month - 1]} ${anchor.year}`);
    if (renderedMonth !== monthKey) {
      cellEls = fillCalendar(grid, "daterange", anchor.year, anchor.month, dateLocale, (cell) => pickDate(cell.iso));
      renderedMonth = monthKey;
    }
    // Range state is drawn from the draft, so the highlight follows the pointer selection before
    // anything is committed.
    for (const [iso, button] of cellEls) {
      const isStart = iso === value.start;
      const isEnd = iso === value.end;
      const inRange = value.start !== null && value.end !== null && iso > value.start && iso < value.end;
      button.classList.toggle("mdy-datepicker__cell--range-start", isStart);
      button.classList.toggle("mdy-datepicker__cell--range-end", isEnd);
      button.classList.toggle("mdy-datepicker__cell--in-range", inRange);
      button.classList.toggle("mdy-datepicker__cell--selected", isStart || isEnd);
      button.setAttribute("aria-selected", String(isStart || isEnd));
    }
  });

  return () => {
    untrack();
    undismiss();
    effectRef.destroy();
    shell.root.remove();
  };
}
