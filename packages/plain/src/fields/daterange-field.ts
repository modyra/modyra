/**
 * Renders the "daterange" kind: two endpoints in one wrapper, a toggle, and a calendar popup that
 * edits a draft and writes it as soon as both ends are known.
 *
 * What a range means — which pick starts it, which closes it, which cells fall between, what the
 * bounds refuse — is `createDaterangeFieldController`'s. This renderer owns DOM and events, and
 * paints the cells the controller hands it.
 */
import { applyOpenerPromise } from "../opener-promise.js";
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicDaterangeField } from "@modyra/core";
import { buildDateLocale, formatIsoDate, parseLocalizedDate } from "@modyra/core/datetime";
import {
  MDY_WIDGET_CONTRACTS,
  createDaterangeFieldController,
  defaultWidgetIdFactory,
  overlayAnchoringFor,
  projectFieldShellA11y,
  shownErrorsOf,
  showsAsInvalid,
  type MdyDateRangeValue,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { withControls, type MdyMountedField } from "../field-controls.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, reflectOverlayOpen, trackOverlay } from "../overlay.js";
import { buildCalendarGrid, fillCalendar } from "./calendar.js";

export function renderDaterangeField(
  container: HTMLElement,
  f: MdyDynamicDaterangeField,
  handle: MdyFieldHandle<unknown>,
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
  const anchoring = overlayAnchoringFor("daterange");
  const definition = MDY_WIDGET_CONTRACTS.daterange;
  const bounds = { minIso: options.minDate ?? null, maxIso: options.maxDate ?? null };
  // Month and weekday names, and which day starts the week, all come from Intl through
  // `buildDateLocale` — the same bundle every renderer is given by DI.
  const dateLocale = buildDateLocale(options.locale ?? (typeof navigator === "undefined" ? "en-US" : navigator.language), options.firstDayOfWeek);

  const controller = createDaterangeFieldController(
    {
      widgetId,
      handle: handle as MdyFieldHandle<MdyDateRangeValue>,
      minDate: bounds.minIso,
      maxDate: bounds.maxIso,
      firstDayOfWeek: dateLocale.firstDayOfWeek,
      // The text goes to the controller as text, and the locale is what this renderer knows: a
      // renderer that parsed here and dispatched only on success made an unreadable entry vanish,
      // because nothing was dispatched and the repaint below rewrote the box from a value that had
      // not changed.
      parseEntry: (text) => {
        const parsed = parseLocalizedDate(text, dateLocale.locale);
        return parsed ? formatIsoDate(parsed) : null;
      },
    },
    reactivity,
  );

  const shell = buildFieldShell(f.label, "daterange", {}, f.ariaLabel, f.name, f.supportingText);
  const wrapper = el("div", "mdy-datepicker mdy-plain-daterange");
  const startInput = el("input", "mdy-datepicker__input mdy-daterange__input") as HTMLInputElement;
  startInput.type = "text";
  startInput.autocomplete = "off";
  startInput.setAttribute("aria-label", `${f.label ?? "Range"} — start`);
  startInput.placeholder = f.placeholder ?? "Start";
  const separator = el("span", definition.parts.separator.classes.join(" "));
  separator.setAttribute("aria-hidden", "true");
  setText(separator, "–");
  const endInput = el("input", "mdy-datepicker__input mdy-daterange__input") as HTMLInputElement;
  endInput.type = "text";
  endInput.autocomplete = "off";
  endInput.setAttribute("aria-label", `${f.label ?? "Range"} — end`);
  endInput.placeholder = messages.daterangeEndLabel;
  const toggle = el("button", definition.parts.toggle.classes.join(" ")) as HTMLButtonElement;
  setIcon(toggle, "CALENDAR");
  toggle.type = "button";
  toggle.setAttribute("aria-label", messages.daterangeChooseRange);
  // Asked of the contract rather than written here. The word is announced with the control, before
  // anything opens, and a person decides whether to open it from that word — so two renderers of one
  // widget saying different words is two different widgets as far as a screen reader is concerned.
  // Nineteen places wrote this attribute and one read the projection; this is the second.
  applyOpenerPromise(toggle, "daterange");

  const popup = el("div", `${MDY_WIDGET_CONTRACTS.daterange.parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  // The toggle said it had a dialog and whether it was open, and never said which one. Naming it
  // is what ties opener to popup for assistive technology — the relation select has always had.
  popup.id = defaultWidgetIdFactory.part(widgetId, "popup");
  toggle.setAttribute("aria-controls", popup.id);
  const header = el("div", definition.parts.dialogHeader.classes.join(" ")) as HTMLDivElement;
  const prevButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  prevButton.type = "button";
  prevButton.setAttribute("aria-label", messages.datepickerPreviousMonth);
  setIcon(prevButton, "CHEVRON_LEFT");
  const monthLabel = el("span", "mdy-datepicker__header-label");
  const nextButton = el("button", "mdy-datepicker__nav-btn") as HTMLButtonElement;
  nextButton.type = "button";
  nextButton.setAttribute("aria-label", messages.datepickerNextMonth);
  setIcon(nextButton, "CHEVRON_RIGHT");
  header.append(prevButton, monthLabel, nextButton);
  const grid = buildCalendarGrid("daterange");
  // Same frame as the single-date picker: the popup positions, the calendar lays out.
  const calendar = el("div", MDY_WIDGET_CONTRACTS.daterange.parts.calendar.classes.join(" "));
  calendar.append(header, grid);
  popup.append(calendar);

  // The start input is what the label names: a range has two controls and `for` can point at only
  // one. The other keeps the `aria-label` it already carried.
  startInput.id = `${widgetId}__start`;

  wrapper.append(startInput, separator, endInput, toggle, popup);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  /** Commands the controller asks for, carried out where the DOM is. */
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    for (const command of controller.dispatch(intent)) {
      if (command.type === "restore-focus") startInput.focus();
    }
  }

  // Committing from the calendar restores focus to the start input, so the endpoints are synced
  // unless the user is mid-edit.
  let typing = false;
  toggle.addEventListener("click", () =>
    dispatch(controller.state().open ? { type: "cancel" } : { type: "open" }),
  );
  for (const [input, which] of [[startInput, "start"], [endInput, "end"]] as const) {
    input.addEventListener("input", () => { typing = true; });
    // One end at a time, as text. A range is written one box at a time, and committing only a whole
    // readable range threw away a half-written one on the way out of the field.
    input.addEventListener("change", () => { typing = false; dispatch({ type: "type", end: which, text: input.value }); });
    input.addEventListener("blur", () => {
      typing = false;
      dispatch({ type: "type", end: which, text: input.value });
      handle.markAsTouched();
    });
  }
  prevButton.addEventListener("click", () => dispatch({ type: "navigate-month", delta: -1 }));
  nextButton.addEventListener("click", () => dispatch({ type: "navigate-month", delta: 1 }));
  // Escape dismisses from wherever the user is. This overlay does not take focus when it opens, so
  // listening on the popup alone meant the handler could only ever fire if the user had already
  // reached inside it — the keyboard could open the range and not close it.
  // Escape cancels and Tab lets go: an overlay whose focus has moved on to the next field is a
  // panel floating over a control the user has already left. Both dismiss, and they differ in where
  // focus lands — Escape hands it back to the opener, Tab leaves it where the key was taking it.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" || event.key === "Tab") dispatch({ type: "cancel" });
  };
  popup.addEventListener("keydown", onEscape);
  // Leaving the calendar ends the preview: the highlight belongs to where the pointer is, and a
  // pointer that has left is nowhere. The committed range comes back on its own, because it is what
  // `previewed` falls back to.
  grid.addEventListener("pointerleave", () => dispatch({ type: "preview", iso: null }));
  wrapper.addEventListener("keydown", onEscape);

  const undismiss = dismissOnOutsidePointer([wrapper], () => controller.state().open, () => dispatch({ type: "cancel" }));

  let cellEls: ReadonlyMap<string, HTMLButtonElement> = new Map();
  let renderedMonth = "";

  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  /**
   * The range a second pick would produce, while the pointer is still deciding.
   *
   * The contract has carried this since the kind existed: `{ type: "preview", iso }` is an intent,
   * the controller publishes `previewed`, and the `gridcell` part declares `inRange`, `rangeStart`
   * and `rangeEnd`. This renderer already painted all three — from `state.previewed` — and never
   * told the controller where the pointer was, so the highlight could only ever show a range that
   * was already committed.
   *
   * Rebound with the cells: `fillCalendar` replaces them on a month change, and a listener on a
   * button that is no longer in the document tells nobody anything.
   */
  function trackPreview(): void {
    for (const [iso, button] of cellEls) {
      button.addEventListener("pointerenter", () => dispatch({ type: "preview", iso }));
      // A keyboard moves the range the same way a pointer does: the focused cell is where the
      // person is deciding, whichever device put them there.
      button.addEventListener("focus", () => dispatch({ type: "preview", iso }));
    }
  }
  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const anchor = { year: state.viewYear, month: state.viewMonth, day: 1 };
    // What the calendar paints is the previewed range, not the committed one: the highlight has to
    // follow the pointer before anything is decided.
    const value = state.open ? state.previewed : state.value;

    // The state-driven half of the contract. `definition.parts` is static — classes and shape — so
    // on its own it never said the range was invalid, required, disabled or described by its errors.
    const a11y = projectFieldShellA11y(
      { disabled: handle.disabled(), required: handle.required() },
      shownErrorsOf(handle),
      { widgetId: widgetId, controlId: startInput.id },
    );

    applyPart(shell.root, definition.parts.root);
    applyPart(shell.label, a11y.label);
    applyPart(shell.description, a11y.description);
    applyPart(shell.errorList, a11y.error);
    // Merged, not applied twice: a second `applyPart` on the same element recomputes its classes
    // from the base it captured on the first call, which would silently drop the part's own.
    for (const [input, iso, part, outstanding] of [
      [startInput, value.start, definition.parts.startControl, state.entryText.start],
      [endInput, value.end, definition.parts.endControl, state.entryText.end],
    ] as const) {
      // What the field could not read stays where the person left it, so it can be corrected rather
      // than silently emptied.
      if (!typing) input.value = outstanding ?? (iso ?? "");
      // Both endpoints carry the state: a range half of which announces itself invalid is worse
      // than one that says nothing at all.
      applyPart(input, { ...part, attributes: { ...part.attributes, ...a11y.control.attributes } });
      input.disabled = handle.disabled();
      // A read-only range refuses the typed date and the calendar's choice alike; the native
      // attribute stops the typing and the ARIA says why.
      input.readOnly = handle.readonly();
      input.setAttribute("aria-readonly", String(handle.readonly()));
    }
    toggle.disabled = handle.disabled();
    toggle.setAttribute("aria-expanded", String(state.open));
    reflectOverlayOpen(popup, state.open, messages);
    // Anchored by the contract, like every other overlay: the placement, the size and the
    // coordinates are `anchorOverlay`'s, and this only measures and applies them.
    if (state.open) positionOverlay(popup, shell.wrapper, anchoring);
    else releaseOverlayPlacement(popup);
    setErrors(shell.errorList, shownErrorsOf(handle).map((error) => error.message));
    shell.syncState({
      open: state.open,
      touched: handle.touched(), disabled: handle.disabled(), readonly: handle.readonly(),
      hasError: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }), filled: value.start !== null, required: handle.required(),
    });

    const monthKey = `${anchor.year}-${anchor.month}`;
    setText(monthLabel, `${dateLocale.monthNamesLong[anchor.month - 1]} ${anchor.year}`);
    // Named by the month, not by the numbers inside it — which are gone while the calendar is closed.
    grid.setAttribute("aria-label", `${dateLocale.monthNamesLong[anchor.month - 1]} ${anchor.year}`);
    // A closed calendar holds no cells: the popup element stays, because it is built once and lives
    // as long as the field, and what is inside it is six weeks of buttons that a screen reader
    // counts and a Tab key walks through while nothing is open.
    if (!state.open) {
      if (renderedMonth !== "") {
        grid.replaceChildren();
        cellEls = new Map();
        renderedMonth = "";
      }
    } else if (renderedMonth !== monthKey) {
      // The second pick closes the range, writes it and shuts the popup — all the controller's,
      // because this kind's value contract says `live`.
      cellEls = fillCalendar(grid, "daterange", anchor.year, anchor.month, dateLocale, (cell) =>
        dispatch({ type: "select-date", iso: cell.iso }),
      );
      renderedMonth = monthKey;
      trackPreview();
    }
    // Which cell is an endpoint and which falls between them is the controller's answer. Comparing
    // ISO strings here was a fourth opinion, and it could not see a preview at all.
    const byIso = new Map(state.cells.map((cell) => [cell.iso, cell]));
    for (const [iso, button] of cellEls) {
      const cell = byIso.get(iso);
      if (!cell) continue;
      button.classList.toggle("mdy-datepicker__cell--range-start", cell.rangeStart);
      button.classList.toggle("mdy-datepicker__cell--range-end", cell.rangeEnd);
      button.classList.toggle("mdy-datepicker__cell--in-range", cell.inRange);
      button.classList.toggle("mdy-datepicker__cell--selected", cell.rangeStart || cell.rangeEnd);
      button.setAttribute("aria-selected", String(cell.rangeStart || cell.rangeEnd));
      button.disabled = cell.disabled;
    }

    // A calendar takes focus into its grid when it opens, which its own datepicker sibling already
    // did and this one did not: a grid the keyboard cannot reach is a grid only a mouse can use.
    // The start endpoint is where the range begins, so that is where the user is put; failing that,
    // the first day that can be picked.
    if (state.open && !popup.contains(document.activeElement)) {
      const target = (value.start ? cellEls.get(value.start) : undefined)
        ?? [...cellEls.values()].find((cell) => !cell.disabled);
      target?.focus();
    }
  });

  return withControls(
    () => {
    untrack();
    undismiss();
    controller.destroy();
    effectRef.destroy();
    shell.root.remove();
    },
    // Bounds move when a sibling field is answered — a return date that cannot precede a
    // departure — and the controller is told rather than the field remounted, which would forget
    // which end the next pick closes.
    { setBounds: (min, max) => controller.setBounds(min, max) },
  );
}
