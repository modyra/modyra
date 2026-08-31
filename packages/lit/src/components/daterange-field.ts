import { mdyPart } from "../mdy-part.js";
import { capabilityOf, keyMeans, defaultWidgetIdFactory,
  overlayControlledId, partClasses, calendarViewOnToggle,
  createDaterangeFieldController,
  projectDaterangeFieldA11y,
  subscribeController,
  type MdyDaterangeFieldController,
  type MdyDaterangeFieldIntent,
  type MdyDaterangeFieldState,
} from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyDateRange, type MdyFieldHandle, observerFor } from "@modyra/core";
import { buildDateLocale, calendarYearRange, type MdyDateLocale, isMonthOutOfRange, isYearOutOfRange, type CalendarCell, type CalendarDate, compareDates, formatIsoDate, formatLocalizedDate, isDateBetween, isDateInRange, orderDates, parseIsoDate, parseLocalizedDate, today } from "@modyra/core/datetime";
import { applyWidgetCommands, bindOutsidePointer, closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { calendarGridKey, calendarRows, renderMonthPicker, renderYearPicker } from "./calendar-pickers.js";
import {
  MdyLitOverlayController,
  POPUP_ANCHOR_STYLE,
  renderOverlayPanel,
} from "./popup-styles.js";

// ─── Date range ──────────────────────────────────────────────────────────────

/** Which view the calendar shows — the contract's vocabulary, not a second set of three strings. */

/**
 * Date range picker renderer — compact two-input calendar picker for selecting
 * a start and end date. Matches the structure, classes and interaction of the
 * the catalogue's `daterange` anatomy.
 */
/**
 * What the component shows before a handle reaches it — a calendar on this month, nothing picked.
 *
 * A resting shape rather than a nullable state everywhere: every read below would otherwise carry
 * the same `?.` and the same fallback, written slightly differently each time.
 */
const RESTING: MdyDaterangeFieldState = Object.freeze({
  value: { start: null, end: null },
  draft: { start: null, end: null },
  previewed: { start: null, end: null },
  viewMode: "days",
  viewYear: today().year,
  viewMonth: today().month,
  focusedDate: formatIsoDate(today()),
  cells: [],
  open: false,
  picking: "start",
  entryText: { start: null, end: null },
  invalid: false,
  disabled: false,
  interactivity: "enabled",
  readonly: false,
  required: false,
  touched: false,
  dirty: false,
  pending: false,
});

export class MdyDaterangeFieldElement extends MdyFieldElement<MdyDateRange | null> {
  static override properties: PropertyDeclarations = {
    min: { type: String },
    max: { type: String },
    // The names the contract uses. A document declares `minDate` and `maxDate`
    // (MdyDynamicCalendarOptions), the other two adapters read them under those names, and this
    // element read only `min`/`max` — so a host forwarding what the document said set a property
    // this element does not declare, and the calendar offered every day as an ordinary choice.
    // `min`/`max` stay: a consumer writing lit by hand has been using them.
    minDate: { type: String, attribute: "min-date" },
    maxDate: { type: String, attribute: "max-date" },
    startPlaceholder: { type: String, attribute: "start-placeholder" },
    endPlaceholder: { type: String, attribute: "end-placeholder" },
    firstDayOfWeek: { type: Number, attribute: "first-day-of-week" },
    dateFilter: { attribute: false },
    variant: { type: String },
    _open: { state: true },
  };
  declare min?: string;
  declare max?: string;
  declare minDate?: string;
  declare maxDate?: string;
  declare startPlaceholder: string;
  declare endPlaceholder: string;
  /**
   * 0 = Sunday, 1 = Monday. Unset follows the locale, which is what a calendar owes its user: a
   * week does not begin on the same day everywhere, and a fixed default renders one locale's
   * calendar to all of them.
   */
  declare firstDayOfWeek?: number;
  declare dateFilter?: (date: string) => boolean;
  /** `"docked"` (default) opens inline; `"modal"` shows a header and Cancel/OK actions. */
  /**
   * Where the popup sits: hung off the control, or covering the viewport.
   *
   * Presentation and nothing else. It used to mean "modal *and* confirm before committing", which
   * contradicted this kind's own value contract (`commit: "live"`).
   */
  declare variant: "docked" | "modal";

  /** Read by the overlay controller, which carries it to the contract. */
  protected forceModalPlacement(): boolean {
    return this.variant === "modal";
  }
  declare _open: boolean;

  /**
   * Everything a range picker decides, decided by the controller for the kind.
   *
   * The draft, the preview that follows the pointer, which pick opens the range and which closes
   * it, which month is on screen, which cell has the keyboard, and which of the three views is
   * showing: all of it lived here in nine reactive properties, and the range picker of every other
   * renderer decided the same things for itself. `_open` stays, because the overlay host is this
   * package's and drives the popover; the controller is told, and its commands are applied.
   */
  private controller?: MdyDaterangeFieldController;
  private unsubscribe?: () => void;
  private unbindOutside?: () => void;
  protected override readonly widgetKind = "daterange" as const;
  private readonly overlay = new MdyLitOverlayController(
    this,
    // The control, not the whole field: anchoring on the host measures the label and the
    // supporting text too, which opened the popup a row low and a couple of hundred pixels off.
    () => this.querySelector<HTMLElement>(".mdy-input-wrapper") ?? this,
    {
    widthMode: "auto-content",
  });

  constructor() {
    super();
    this.startPlaceholder = "Start";
    this.endPlaceholder = "End";
    this.variant = "docked";
    this._open = false;
  }

  /** What the controller is holding, or the resting shape before a handle exists. */
  private get view(): MdyDaterangeFieldState {
    return this.controller?.state() ?? RESTING;
  }

  /** Carries out what the controller asks of the DOM, which is the only half this renderer owns. */
  private send(intent: MdyDaterangeFieldIntent): void {
    const handle = this.field;
    if (!this.controller || !handle) return;
    applyWidgetCommands(this, this.controller.dispatch(intent), {
      open: () => this.overlay.open(),
      close: () => this.overlay.close(),
      disabled: handle.disabled(),
      control: ".mdy-daterange__input",
    });
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (handle && !this.controller) {
      this.controller = createDaterangeFieldController({
        widgetId: this.fieldId,
        handle: handle as never,
        minDate: this.earliest ?? null,
        maxDate: this.latest ?? null,
        firstDayOfWeek: this.weekStart,
      });
      // Lit repaints on its own reactive properties, and the controller's state is not one of them.
      // `subscribeController` is the contract's answer to exactly that, and had no consumer.
      this.unsubscribe = subscribeController(
        this.controller as never,
        observerFor(handle),
        () => this.requestUpdate(),
      );
    }
    this.unbindOutside = bindOutsidePointer(this, () => {
      const handle = this.field;
      if (handle) this.closePopup(handle);
    });
    this.classList.add("mdy-renderer--datepicker");
  }

  /** The host's choice if it made one, the locale's otherwise. */
  private get weekStart(): number {
    return this.firstDayOfWeek ?? buildDateLocale(this.resolvedLocale).firstDayOfWeek;
  }

  private get startInputId(): string {
    // Through the factory: every id this library publishes is `scope__part`, and a consumer that
    // knows the scope composes a part name the same way. A hyphen still yields a unique id and still
    // works — and is unreachable by anybody who builds the name instead of reading it off the element.
    return defaultWidgetIdFactory.part(this.fieldId, "start");
  }

  protected override get labelForId(): string {
    return this.startInputId;
  }

  /** Date-range inputs always look filled because the two inputs are present. */
  protected override isFilled(_handle: MdyFieldHandle<MdyDateRange | null>): boolean {
    return true;
  }

  /**
   * The calendar's own vocabulary, from the contract: which months and years the bounds allow, the
   * years a picker offers, and the names for both. Written here it was written twice — the range
   * picker is this component copied — and the two could answer differently.
   */
  private get calendar(): MdyDateLocale {
    return buildDateLocale(this.resolvedLocale, this.firstDayOfWeek);
  }

  private weekdayNames(): readonly string[] {
    const names = this.calendar.dayNamesNarrow;
    return Array.from({ length: 7 }, (_, i) => names[(this.weekStart + i) % 7] as string);
  }

  private monthNamesShort(): readonly string[] {
    return this.calendar.monthNamesShort;
  }

  private isMonthDisabled(month: number): boolean {
    return isMonthOutOfRange(this.view.viewYear, month, this.parseMin(), this.parseMax());
  }

  private isYearDisabled(year: number): boolean {
    return isYearOutOfRange(year, this.parseMin(), this.parseMax());
  }

  private yearRange(): readonly number[] {
    return calendarYearRange(this.view.viewYear, this.parseMin(), this.parseMax());
  }

  /**
   * The bounds, under either name.
   *
   * One accessor, because a bound read in four places under one name and set under another is how a
   * calendar came to offer days its own limit refused: every reader here asks the same question.
   */
  protected get earliest(): string | undefined { return this.minDate ?? this.min; }

  protected get latest(): string | undefined { return this.maxDate ?? this.max; }

  private parseMin(): CalendarDate | null {
    return this.earliest ? parseIsoDate(this.earliest) : null;
  }

  private parseMax(): CalendarDate | null {
    return this.latest ? parseIsoDate(this.latest) : null;
  }

  private isWithinBounds(iso: string): boolean {
    const min = this.parseMin();
    const max = this.parseMax();
    if (min && iso < formatIsoDate(min)) return false;
    if (max && iso > formatIsoDate(max)) return false;
    return true;
  }

  private isDateFilterAllowed(iso: string): boolean {
    return this.dateFilter ? this.dateFilter(iso) : true;
  }

  private rows(): CalendarCell[][] {
    return calendarRows(this.view.viewYear, this.view.viewMonth, this.weekStart);
  }

  private openPopup(_handle: MdyFieldHandle<MdyDateRange | null>, event?: Event): void {
    void event;
    this.send({ type: "open" });
  }

  private closePopup(_handle: MdyFieldHandle<MdyDateRange | null>, refocus = true): void {
    if (!this._open) return;
    this.send({ type: "close", restoreFocus: refocus });
  }

  private navigateMonths(delta: number): void {
    this.send({ type: "navigate-month", delta });
  }

  private onDatePicked(_handle: MdyFieldHandle<MdyDateRange | null>, date: CalendarDate): void {
    this.send({ type: "select-date", iso: formatIsoDate(date) });
  }

  private onDateHovered(date: CalendarDate): void {
    this.send({ type: "preview", iso: formatIsoDate(date) });
  }

  /** Where the header goes, answered by the contract rather than by a branch here. */
  private onToggleView(): void {
    this.send({ type: "set-view-mode", mode: calendarViewOnToggle(this.view.viewMode) });
  }

  private onMonthSelected(month: number): void {
    this.send({ type: "select-month", month });
  }

  private onYearSelected(year: number): void {
    this.send({ type: "select-year", year });
  }

  /**
   * A date a person typed, in this field's own locale or as an ISO string.
   *
   * Reading only ISO is why a well-formed date typed the way the placeholder shows it was thrown
   * away: nothing could parse it, so the value was set to nothing and the box was rewritten from
   * that nothing. What still cannot be read is kept on screen, where it can be corrected.
   */
  private readTyped(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    const parsed = parseLocalizedDate(trimmed, this.resolvedLocale) ?? parseIsoDate(trimmed);
    return parsed ? formatIsoDate(parsed) : null;
  }

  private commitRange(
    handle: MdyFieldHandle<MdyDateRange | null>,
    start: string | null,
    end: string | null,
  ): void {
    let finalStart = start;
    let finalEnd = end;

    if (finalStart !== null && (!this.isWithinBounds(finalStart) || !this.isDateFilterAllowed(finalStart))) {
      finalStart = null;
    }
    if (finalEnd !== null && (!this.isWithinBounds(finalEnd) || !this.isDateFilterAllowed(finalEnd))) {
      finalEnd = null;
    }

    const s = parseIsoDate(finalStart);
    const e = parseIsoDate(finalEnd);
    if (s && e && compareDates(e, s) < 0) {
      finalEnd = finalStart;
    }

    handle.set({ start: finalStart, end: finalEnd });
    handle.markAsDirty();
  }

  /**
   * The calendar keyboard, which the controller answers.
   *
   * Moving the focus, following it with the preview and paging the month when it crosses a boundary
   * were three writes here and are one intent now — `keydown` — so a key means the same thing in
   * every renderer that asks.
   */
  private onGridKeydown(e: KeyboardEvent, handle: MdyFieldHandle<MdyDateRange | null>): void {
    calendarGridKey(e, "daterange", this.view.viewMode, (intent) => this.send(intent), () => this.closePopup(handle));
  }

  protected override updated(changed: Map<string, unknown>): void {
    // The base names the control and reports an id this page already carries; skipping it left both
    // to whichever kinds happened to call up.
    super.updated(changed);
    if (this._open) {
      if (this.view.viewMode === "days") {
        this.querySelector<HTMLElement>(".mdy-datepicker__cell--focused")?.focus();
      } else if (this.view.viewMode === "years") {
        this.querySelector<HTMLElement>(
          `.${partClasses("daterange", "yearCell", { selected: true }).join(".")}`,
        )?.scrollIntoView?.({
          block: "center",
          behavior: "instant",
        });
      }
    }
  }

  /**
   * Tab out of an open popup closes it, which is what the keyboard table declares for this kind.
   *
   * Not `preventDefault`: Tab is already carrying the keyboard onward and pulling it back would trap
   * a person in the field they just left.
   */
  protected override tabbedAway(): void {
    if (!this._open) return;
    if (!keyMeans("daterange", "Tab", "cancel", true)) return;
    const handle = this.field;
    if (handle) this.closePopup(handle, false);
  }

  /** Closed when the keyboard moves on, which this kind's contract asks for. */
  protected override focusLeft(): void {
    if (!this._open) return;
    if (!capabilityOf("daterange", "dismissOnFocusOutside")) return;
    const handle = this.field;
    if (handle) this.closePopup(handle, false);
  }

  override disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.controller = undefined;
    this.unbindOutside?.();
    this.overlay.close();
    super.disconnectedCallback();
  }

  private effectiveRange(): readonly [CalendarDate | null, CalendarDate | null] {
    // What the calendar paints is the previewed range: the highlight follows the pointer before
    // anything is decided, which is the distinction `previewed` exists for.
    const start = parseIsoDate(this.view.previewed.start);
    const end = parseIsoDate(this.view.previewed.end);
    return orderDates(start, end);
  }

  private isCellDisabled(cell: CalendarCell): boolean {
    if (!isDateInRange(cell.date, this.parseMin(), this.parseMax())) return true;
    return !this.isDateFilterAllowed(cell.iso);
  }

  private isCellRangeEndpoint(cell: CalendarCell): boolean {
    const [s, e] = this.effectiveRange();
    return (
      (s !== null && isSameDay(cell.date, s)) ||
      (e !== null && isSameDay(cell.date, e))
    );
  }

  private isCellRangeStart(cell: CalendarCell): boolean {
    const [s] = this.effectiveRange();
    return s !== null && isSameDay(cell.date, s);
  }

  private isCellRangeEnd(cell: CalendarCell): boolean {
    const [, e] = this.effectiveRange();
    return e !== null && isSameDay(cell.date, e);
  }

  private isCellInRange(cell: CalendarCell): boolean {
    const [s, e] = this.effectiveRange();
    return isDateBetween(cell.date, s, e);
  }

  private isCellFocused(cell: CalendarCell): boolean {
    const focused = parseIsoDate(this.view.focusedDate);
    return focused !== null && isSameDay(cell.date, focused);
  }

  private isCellToday(cell: CalendarCell): boolean {
    return isSameDay(cell.date, today());
  }

  private renderMonthPicker(): unknown {
    return renderMonthPicker(this.monthNamesShort(), {
      kind: "daterange",
      widgetId: this.fieldId,
      current: this.view.viewMonth,
      disabled: (month) => this.isMonthDisabled(month),
      pick: (month) => this.onMonthSelected(month),
    });
  }

  private renderYearPicker(): unknown {
    return renderYearPicker(this.yearRange(), {
      kind: "daterange",
      widgetId: this.fieldId,
      current: this.view.viewYear,
      disabled: (year) => this.isYearDisabled(year),
      pick: (year) => this.onYearSelected(year),
    });
  }

  private renderCalendarGrid(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    return html`
      <div class="mdy-datepicker__weekdays" role="row">
        ${this.weekdayNames().map(
          (name) => html`<span class="mdy-datepicker__weekday" role="columnheader">${name}</span>`,
        )}
      </div>
      ${this.rows().map(
        (row) => html`<div class="mdy-datepicker__row" role="row">
          ${row.map((cell) => {
            const disabled = this.isCellDisabled(cell);
            const rangeEndpoint = this.isCellRangeEndpoint(cell);
            const classes = [
              "mdy-datepicker__cell",
              cell.inMonth ? "" : "mdy-datepicker__cell--outside",
              this.isCellToday(cell) ? "mdy-datepicker__cell--today" : "",
              rangeEndpoint ? "mdy-datepicker__cell--selected" : "",
              this.isCellRangeStart(cell) ? "mdy-datepicker__cell--range-start" : "",
              this.isCellRangeEnd(cell) ? "mdy-datepicker__cell--range-end" : "",
              this.isCellInRange(cell) ? "mdy-datepicker__cell--in-range" : "",
              this.isCellFocused(cell) ? "mdy-datepicker__cell--focused" : "",
              disabled ? "mdy-datepicker__cell--disabled" : "",
            ].join(" ");
            return html`<button
              type="button"
              id=${this.controller?.view().parts[cell.iso]?.id ?? nothing}
              class=${classes}
              role="gridcell"
              tabindex=${this.isCellFocused(cell) ? "0" : "-1"}
              aria-selected=${rangeEndpoint ? "true" : "false"}
              aria-current=${this.isCellToday(cell) ? "date" : nothing}
              ?disabled=${disabled}
              @click=${() => this.onDatePicked(handle, cell.date)}
              @mouseenter=${() => this.onDateHovered(cell.date)}
            >
              ${cell.date.day}
            </button>`;
          })}
        </div>`,
      )}
    `;
  }

  private modalDisplayValue(): string {
    const start = parseIsoDate(this.view.draft.start);
    const end = parseIsoDate(this.view.draft.end);
    if (!start) return this.label || this.messages.daterangeSelectFallback;
    const fmt = (d: CalendarDate): string => {
      try {
        return new Intl.DateTimeFormat(this.resolvedLocale, { month: "short", day: "numeric" }).format(
          new Date(d.year, d.month - 1, d.day),
        );
      } catch {
        return formatIsoDate(d);
      }
    };
    const startStr = fmt(start);
    if (!end) return `${startStr} – …`;
    return `${startStr} – ${fmt(end)}`;
  }

  private renderPopup(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    const monthLabel = new Intl.DateTimeFormat(this.resolvedLocale, { month: "long" }).format(
      new Date(Date.UTC(this.view.viewYear, this.view.viewMonth - 1, 1)),
    );
    const hint = this.view.picking === "start" ? "Select start date" : "Select end date";
    const modalHeader =
      this.overlay.state.position === "overlay"
        ? html`
            <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">${this.label || this.messages.daterangeSelectFallback}</span>
              <span class="mdy-datepicker__modal-value">${this.modalDisplayValue()}</span>
            </div>
          `
        : nothing;
    const actions = nothing;
    return html`
      <div
        class="mdy-datepicker__calendar"
        role="dialog"
        aria-label=${this.label || this.messages.daterangeChooseRange}
        @keydown=${(e: KeyboardEvent) => this.onGridKeydown(e, handle)}
      >
        ${modalHeader}
        <div class="mdy-datepicker__header">
          <div class="mdy-datepicker__header-label">
            <button
              type="button"
              class="mdy-datepicker__view-toggle"
              aria-label=${this.messages.datepickerChangeView(`${monthLabel} ${this.view.viewYear}`)}
              @click=${this.onToggleView}
            >
              <span class="mdy-datepicker__title">${monthLabel} ${this.view.viewYear}</span>
              ${mdyIcon("CHEVRON_DOWN", "mdy-datepicker__view-icon")}
            </button>
          </div>
          <div class="mdy-datepicker__header-nav">
            <button
              type="button"
              class="mdy-datepicker__nav-btn"
              aria-label=${this.messages.datepickerPreviousMonth}
              ?disabled=${this.view.viewMode !== "days"}
              @click=${() => this.navigateMonths(-1)}
            >
              ${mdyIcon("CHEVRON_LEFT", "")}
            </button>
            <button
              type="button"
              class="mdy-datepicker__nav-btn"
              aria-label=${this.messages.datepickerNextMonth}
              ?disabled=${this.view.viewMode !== "days"}
              @click=${() => this.navigateMonths(1)}
            >
              ${mdyIcon("CHEVRON_RIGHT", "")}
            </button>
          </div>
        </div>
        ${this.view.viewMode === "days"
          ? html`<div
              class="mdy-datepicker__grid"
              role="grid"
              aria-label="${monthLabel} ${this.view.viewYear}"
            >
              ${this.renderCalendarGrid(handle)}
            </div>
            <div class="mdy-daterange__hint" aria-live="polite">${hint}</div>`
          : this.view.viewMode === "months"
            ? this.renderMonthPicker()
            : this.renderYearPicker()}
        ${actions}
      </div>
    `;
  }

  /**
   * This kind draws its own field box.
   *
   * The base wraps a control in one, and this element renders another inside it — two elements
   * answering to `inputWrapper`, one inside the other, which is the ambiguity ADR 0143 forbids: a
   * selector returns the outer, a measurement may take either, and a reading cannot say which it
   * meant. The kind draws its own affixes too, so nothing is lost by declining the base's.
   */
  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    const range = handle.value() ?? { start: null, end: null };
    return html`
      <div class="mdy-datepicker">
        <div
          class="${this.wrapperClass(handle)} mdy-daterange__group"
          role="group"
          aria-label=${this.label || nothing}
        >
          <span
            class="mdy-daterange__input-sizer"
            data-value=${range.start ?? this.startPlaceholder}
          >
            <input
              id=${this.startInputId}
              type="text"
              class="${partClasses("daterange", "startControl").join(" ")}"
              placeholder=${this.startPlaceholder}
              .value=${formatLocalizedDate(range.start, this.resolvedLocale)}
              ?disabled=${handle.disabled()}
              ?readonly=${handle.readonly()}
              ${mdyPart(this.endPart(handle, "startControl"))}
              autocomplete="off"
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                const raw = input.value.trim();
                const current = handle.value() ?? { start: null, end: null };
                const iso = this.readTyped(raw);
                this.commitRange(handle, iso, current.end);
                // Text nothing could read stays where it was typed: erasing it leaves an empty box
                // and no way to learn that anything was wrong with what was in it.
                // The echo: what was understood, in the reader's spelling. Somebody who typed
                // 04/03 sees which of the two numbers was taken as the month, at the moment they
                // typed it, rather than discovering it on a confirmation page.
                if (iso !== null || raw.length === 0) {
                  input.value = formatLocalizedDate(iso, this.resolvedLocale);
                }
              }}
            />
          </span>
          <span class="mdy-daterange__sep" aria-hidden="true">–</span>
          <span
            class="mdy-daterange__input-sizer"
            data-value=${range.end ?? this.endPlaceholder}
          >
            <input
              type="text"
              class="${partClasses("daterange", "endControl").join(" ")}"
              aria-label=${this.nameOfPart("daterange.endControl")}
              placeholder=${this.endPlaceholder}
              .value=${formatLocalizedDate(range.end, this.resolvedLocale)}
              ?disabled=${handle.disabled()}
              ?readonly=${handle.readonly()}
              ${mdyPart(this.endPart(handle, "endControl"))}
              autocomplete="off"
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                const raw = input.value.trim();
                const current = handle.value() ?? { start: null, end: null };
                const iso = this.readTyped(raw);
                this.commitRange(handle, current.start, iso);
                // The echo: what was understood, in the reader's spelling. Somebody who typed
                // 04/03 sees which of the two numbers was taken as the month, at the moment they
                // typed it, rather than discovering it on a confirmation page.
                if (iso !== null || raw.length === 0) {
                  input.value = formatLocalizedDate(iso, this.resolvedLocale);
                }
              }}
            />
          </span>
          <div class="mdy-input-suffix">
            <button
              type="button"
              class="mdy-datepicker__toggle"
              ?disabled=${handle.disabled()}
              aria-label=${this.messages.daterangeChooseRange}
              aria-haspopup=${this.popupPromise}
              aria-expanded=${this._open ? "true" : "false"}
              aria-controls=${overlayControlledId("daterange", this.fieldId) ?? nothing}
              @click=${(e: Event) => (this._open ? this.closePopup(handle) : this.openPopup(handle, e))}
            >
              ${mdyIcon("CALENDAR", "mdy-datepicker__icon")}
            </button>
          </div>
        </div>
        ${renderOverlayPanel(
          // Wrapped in the contract's `popup` part: every overlay in the catalog is the same
          // container, and only its content differs. Without it these two pickers were the
          // only popups drawn straight into the panel, with a container of their own.
          html`<div
            class="${this.popupClass(this.overlay.state.position)} mdy-overlay"
            id=${overlayControlledId("daterange", this.fieldId) ?? nothing}
          >${this.renderPopup(handle)}</div>`,
          this._open,
          {
            closedId: overlayControlledId("daterange", this.fieldId) ?? undefined,
            position: this.overlay.state.position,
          alignment: this.overlay.state.alignment,
          modal: this.overlay.state.position === "overlay",
          panelStyle: this.overlay.state.panelStyle,
        })}
      </div>
    `;
  }

  /**
   * What one end carries: its own name and the states this kind knows, from the kind's projection.
   *
   * The shell answers what every field has and cannot say which of two boxes this is — it has no
   * word for an end, and none for a range a person may read and not write. The caption names the
   * group around the pair; each box names itself. ADR 0175.
   */
  private endPart(handle: MdyFieldHandle<MdyDateRange | null>, part: "startControl" | "endControl") {
    return projectDaterangeFieldA11y(this.view, handle.errors(), { widgetId: this.fieldId })[part];
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const base = super.render();
    return html`<div style=${POPUP_ANCHOR_STYLE}>${base}</div>`;
  }
}

function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
