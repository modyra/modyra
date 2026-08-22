import { mdyPart } from "../mdy-part.js";
import {
  createDatepickerFieldController,
  overlayControlledId,
  type MdyDatepickerFieldController,
  type MdyDatepickerFieldIntent,
  type MdyDatepickerFieldState,
  partClasses,
  calendarViewOnToggle,
  subscribeController,
  keyBindingFor,
} from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { observerFor, type MdyFieldHandle } from "@modyra/core";
import { buildDateLocale, calendarYearRange, type MdyDateLocale, isMonthOutOfRange, isYearOutOfRange, type CalendarCell, type CalendarDate, formatIsoDate, parseIsoDate, parseLocalizedDate, today } from "@modyra/core/datetime";
import { applyWidgetCommands, bindOutsidePointer, closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { calendarGridKey, calendarRows, renderMonthPicker, renderYearPicker } from "./calendar-pickers.js";
import {
  MdyLitOverlayController,
  POPUP_ANCHOR_STYLE,
  renderOverlayPanel,
} from "./popup-styles.js";

// ─── Date & time ─────────────────────────────────────────────────────────────

/** Which view the calendar shows — the contract's vocabulary, not a second set of three strings. */

/**
 * ISO `yyyy-MM-dd` value model — identical to the engine's convention.
 * Styled text input (typed dates parsed in the page locale or as ISO) with
 * a calendar toggle opening a full keyboard-navigable month grid — the
 * structure and classes the themes style.
 */
/** What the component shows before a handle reaches it — a calendar on this month, nothing picked. */
const RESTING: MdyDatepickerFieldState = Object.freeze({
  selectedDate: null,
  viewMode: "days",
  viewYear: today().year,
  viewMonth: today().month,
  focusedDate: formatIsoDate(today()),
  cells: [],
  open: false,
  invalid: false,
  disabled: false,
  interactivity: "enabled",
  readonly: false,
  required: false,
  touched: false,
  dirty: false,
  pending: false,
  entryText: null,
  entryUnreadable: false,
});

export class MdyDatepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    min: { type: String },
    max: { type: String },
    placeholder: { type: String },
    firstDayOfWeek: { type: Number, attribute: "first-day-of-week" },
    variant: { type: String },
    _open: { state: true },
  };
  declare min?: string;
  declare max?: string;
  declare placeholder: string;
  /**
   * 0 = Sunday, 1 = Monday. Unset follows the locale, which is what a calendar owes its user: a
   * week does not begin on the same day everywhere, and a fixed default renders one locale's
   * calendar to all of them.
   */
  declare firstDayOfWeek?: number;
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

  /** Temporary value used while the modal variant is open. */

  protected override readonly widgetKind = "datepicker" as const;
  private readonly overlay = new MdyLitOverlayController(
    this,
    // The control, not the whole field: anchoring on the host measures the label and the
    // supporting text too, which opened the popup a row low and a couple of hundred pixels off.
    () => this.querySelector<HTMLElement>(".mdy-input-wrapper") ?? this,
    {
    widthMode: "auto-content",
  });
  private unbindOutside?: () => void;

  constructor() {
    super();
    this.placeholder = "";
    this.variant = "docked";
    this._open = false;
  }

  /** The host's choice if it made one, the locale's otherwise. */
  private get weekStart(): number {
    return this.firstDayOfWeek ?? buildDateLocale(this.resolvedLocale).firstDayOfWeek;
  }

  private parse(raw: string): string | null {
    if (!raw) return null;
    const parsed = parseLocalizedDate(raw, this.resolvedLocale) ?? parseIsoDate(raw);
    return parsed ? formatIsoDate(parsed) : null;
  }

  private rows(): CalendarCell[][] {
    return calendarRows(this.view.viewYear, this.view.viewMonth, this.weekStart);
  }

  private openPopup(_handle: MdyFieldHandle<string | null>, event?: Event): void {
    void event;
    this.send({ type: "open" });
  }

  private closePopup(_handle: MdyFieldHandle<string | null>, refocus = true): void {
    if (!this._open) return;
    this.send({ type: "close", restoreFocus: refocus });
  }

  private navigateMonths(delta: number): void {
    this.send({ type: "navigate-month", delta });
  }

  /** Choosing a day writes it: this kind's value contract says `live`, whatever the placement. */
  private pick(handle: MdyFieldHandle<string | null>, iso: string): void {
    this.commitDate(iso);
    this.closePopup(handle);
  }

  /** Where the header goes, answered by the contract rather than by a branch here. */
  private onToggleView(): void {
    this.send({ type: "set-view-mode", mode: calendarViewOnToggle(this.view.viewMode) });
  }

  private onMonthSelected(_handle: MdyFieldHandle<string | null>, month: number): void {
    this.send({ type: "select-month", month });
  }

  private onYearSelected(year: number): void {
    this.send({ type: "select-year", year });
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

  private parseMin(): CalendarDate | null {
    return this.min ? parseIsoDate(this.min) : null;
  }

  private parseMax(): CalendarDate | null {
    return this.max ? parseIsoDate(this.max) : null;
  }

  /** The calendar keyboard, which the controller answers — moving, paging and picking alike. */
  private onGridKeydown(e: KeyboardEvent, handle: MdyFieldHandle<string | null>): void {
    calendarGridKey(e, this.view.viewMode, (intent) => this.send(intent), () => this.closePopup(handle));
  }

  protected override updated(): void {
    if (this._open) {
      if (this.view.viewMode === "days") {
        this.querySelector<HTMLElement>(".mdy-datepicker__cell--focused")?.focus();
      } else if (this.view.viewMode === "years") {
        this.querySelector<HTMLElement>(
          `.${partClasses("datepicker", "yearCell", { selected: true }).join(".")}`,
        )?.scrollIntoView?.({
          block: "center",
          behavior: "instant",
        });
      }
    }
  }

  private fieldController?: MdyDatepickerFieldController;
  private unsubscribe?: () => void;

  /** What the controller is holding, or the resting shape before a handle exists. */
  private get view(): MdyDatepickerFieldState {
    return this.fieldController?.state() ?? RESTING;
  }

  /** Carries out what the controller asks of the DOM, which is the only half this renderer owns. */
  private send(intent: MdyDatepickerFieldIntent): void {
    const handle = this.field;
    if (!this.fieldController || !handle) return;
    applyWidgetCommands(this, this.fieldController.dispatch(intent), {
      open: () => this.overlay.open(),
      close: () => this.overlay.close(),
      disabled: handle.disabled(),
      control: ".mdy-datepicker__input",
    });
    // Said to the form rather than kept here: an entry this control could not read leaves the form
    // holding nothing while the person looks at text they believe was taken, and a message the
    // element painted on its own escaped every rule the form applies to its errors — it was still
    // announced after the field went out of play, and never marked the control as invalid.
    handle.reportEntry(this.view.entryUnreadable ? this.messages.entryUnreadable : null);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (handle && !this.fieldController) {
      this.fieldController = createDatepickerFieldController({
        widgetId: this.fieldId,
        handle,
        minDate: this.min ?? null,
        maxDate: this.max ?? null,
        firstDayOfWeek: this.weekStart,
        // The reading is this element's — it knows the locale on screen; the judgement is the
        // controller's, which is what stops this renderer and the next answering differently.
        parseEntry: (text) => this.parse(text),
      });
      // Lit repaints on its own reactive properties, and the controller's state is not one of them.
      // `subscribeController` is the contract's answer to exactly that.
      this.unsubscribe = subscribeController(
        this.fieldController as never,
        observerFor(handle),
        () => this.requestUpdate(),
      );
    }
    this.unbindOutside = bindOutsidePointer(this, () => {
      const handle = this.field;
      this.overlay.close();
      if (handle) handle.markAsTouched();
    });
  }

  override disconnectedCallback(): void {
    this.unbindOutside?.();
    this.overlay.close();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
    // The ends of the range are properties and can move; the controller is told rather than
    // rebuilt, which would forget the month on screen.
    if (changed.has("min") || changed.has("max")) {
      this.fieldController?.setBounds(this.min ?? null, this.max ?? null);
    }
  }

  /**
   * One committed date, decided by the controller for this kind.
   *
   * What the range refuses was decided here for the grid and nowhere for the text input: a date
   * typed outside the bounds was accepted, which the other renderers refuse. The controller answers
   * for both.
   */
  private commitDate(iso: string | null): void {
    if (this.fieldController) {
      this.fieldController.dispatch(iso === null ? { type: "clear" } : { type: "select-date", iso });
      return;
    }
    const handle = this.field;
    if (!handle) return;
    handle.set(iso);
    handle.markAsDirty();
  }

  /**
   * What the opener names while the popup is open, which is whichever view is on screen.
   *
   * The day grid is one of three: choosing the month or the year replaces it, and an
   * `aria-controls` fixed on the grid then named an element that had been taken away. A reference
   * that goes stale on a view change is the same defect as one that was never right.
   */
  private controlledViewId(): string | typeof nothing {
    if (this.view.viewMode === "months") return `${this.fieldId}__months`;
    if (this.view.viewMode === "years") return `${this.fieldId}__years`;
    return overlayControlledId("datepicker", this.fieldId) ?? nothing;
  }

  private renderMonthPicker(handle: MdyFieldHandle<string | null>): unknown {
    return renderMonthPicker(this.monthNamesShort(), {
      kind: "datepicker",
      widgetId: this.fieldId,
      current: this.view.viewMonth,
      disabled: (month) => this.isMonthDisabled(month),
      pick: (month) => this.onMonthSelected(handle, month),
    });
  }

  private renderYearPicker(): unknown {
    return renderYearPicker(this.yearRange(), {
      kind: "datepicker",
      widgetId: this.fieldId,
      current: this.view.viewYear,
      disabled: (year) => this.isYearDisabled(year),
      pick: (year) => this.onYearSelected(year),
    });
  }

  private renderCalendarGrid(handle: MdyFieldHandle<string | null>): unknown {
    const selectedIso = handle.value();
    const todayIso = formatIsoDate(today());
    const inRange = (iso: string): boolean =>
      (!this.min || iso >= this.min) && (!this.max || iso <= this.max);
    return html`
      <div class="mdy-datepicker__weekdays" role="row">
        ${this.weekdayNames().map(
          (name) => html`<span class="mdy-datepicker__weekday" role="columnheader">${name}</span>`,
        )}
      </div>
      ${this.rows().map(
        (row) => html`<div class="mdy-datepicker__row" role="row">
          ${row.map((cell) => {
            const disabled = !inRange(cell.iso);
            const classes = [
              "mdy-datepicker__cell",
              cell.inMonth ? "" : "mdy-datepicker__cell--outside",
              cell.iso === todayIso ? "mdy-datepicker__cell--today" : "",
              cell.iso === selectedIso ? "mdy-datepicker__cell--selected" : "",
              cell.iso === this.view.focusedDate ? "mdy-datepicker__cell--focused" : "",
              disabled ? "mdy-datepicker__cell--disabled" : "",
            ].join(" ");
            return html`<button
              type="button"
              id=${this.fieldController?.view().parts[cell.iso]?.id ?? nothing}
              class=${classes}
              role="gridcell"
              tabindex=${cell.iso === this.view.focusedDate ? "0" : "-1"}
              aria-selected=${cell.iso === selectedIso ? "true" : "false"}
              ?disabled=${disabled}
              @click=${() => this.pick(handle, cell.iso)}
            >
              ${cell.date.day}
            </button>`;
          })}
        </div>`,
      )}
    `;
  }

  private modalDisplayValue(): string {
    // The committed value: with `commit: "live"` there is no draft to show instead.
    const parsed = parseIsoDate(this.field?.value() ?? "");
    if (!parsed) return this.label || "Select date";
    try {
      return new Intl.DateTimeFormat(this.resolvedLocale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(parsed.year, parsed.month - 1, parsed.day));
    } catch {
      return (this.field?.value() ?? this.label) || "Select date";
    }
  }

  private renderPopup(handle: MdyFieldHandle<string | null>): unknown {
    const monthLabel = new Intl.DateTimeFormat(this.resolvedLocale, { month: "long" }).format(
      new Date(Date.UTC(this.view.viewYear, this.view.viewMonth - 1, 1)),
    );
    const modalHeader =
      this.overlay.state.position === "overlay"
        ? html`
            <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">${this.label || "Select date"}</span>
              <span class="mdy-datepicker__modal-value">${this.modalDisplayValue()}</span>
            </div>
          `
        : nothing;
    const actions = nothing;
    return html`
      <div
        class="mdy-datepicker__calendar"
        role="dialog"
        aria-label=${this.label || "Choose date"}
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
          ? html`<div class="mdy-datepicker__grid" role="grid" id=${overlayControlledId("datepicker", this.fieldId) ?? nothing}>
              ${this.renderCalendarGrid(handle)}
            </div>`
          : this.view.viewMode === "months"
            ? this.renderMonthPicker(handle)
            : this.renderYearPicker()}
        ${actions}
      </div>
    `;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
      <div class="mdy-datepicker">
        <input
          id=${this.fieldId}
          type="text"
          class="mdy-datepicker__input"
          placeholder=${this.placeholder}
          .value=${this.view.entryText ?? handle.value() ?? ""}
          ?disabled=${handle.disabled()}
          ?readonly=${handle.readonly()}
          role="combobox"
          aria-haspopup=${this.popupPromise}
          aria-expanded=${this._open ? "true" : "false"}
          aria-controls=${this._open ? this.controlledViewId() : nothing}
          ${mdyPart(this.controlPart(handle))}
          @change=${(e: Event) => {
            // The text goes over as text. Parsing here and writing the value back was the erasure:
            // an entry the field could not read left nothing on screen to correct.
            this.send({ type: "type", text: (e.target as HTMLInputElement).value });
          }}
          @blur=${() => handle.markAsTouched()}
          @click=${(e: Event) => { if (!this._open) this.openPopup(handle, e); }}
          @keydown=${(e: KeyboardEvent) => {
            // The keys this kind declares, read from the table rather than listed here. The contract
            // names the *control* as the opener, and a control that only opens under a pointer is
            // one a keyboard cannot reach the calendar through at all.
            if (this._open || keyBindingFor("datepicker", e.key, false)?.intent !== "open") return;
            e.preventDefault();
            this.openPopup(handle, e);
          }}
        />
        <div class="mdy-input-suffix">
          <button
            type="button"
            class="mdy-datepicker__toggle"
            ?disabled=${handle.disabled()}
            aria-label=${this.messages.datepickerToggleLabel}
            aria-expanded=${this._open ? "true" : "false"}
            @click=${(e: Event) => (this._open ? this.closePopup(handle) : this.openPopup(handle, e))}
          >
            ${mdyIcon("CALENDAR", "mdy-datepicker__icon")}
          </button>
        </div>
        ${renderOverlayPanel(
          // Wrapped in the contract's `popup` part: every overlay in the catalog is the same
          // container, and only its content differs. Without it these two pickers were the
          // only popups drawn straight into the panel, with a container of their own.
          html`<div class="${this.popupClass(this.overlay.state.position)} mdy-overlay">${this.renderPopup(handle)}</div>`,
          this._open,
          {
            position: this.overlay.state.position,
          alignment: this.overlay.state.alignment,
          modal: this.overlay.state.position === "overlay",
          panelStyle: this.overlay.state.panelStyle,
        })}
      </div>
    `;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const base = super.render();
    return html`<div style=${POPUP_ANCHOR_STYLE}>${base}</div>`;
  }
}
