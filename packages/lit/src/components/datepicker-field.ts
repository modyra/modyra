import { mdyPart } from "../mdy-part.js";
import {
  createDatepickerFieldController,
  overlayControlledId,
  type MdyDatepickerFieldController, partClasses } from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { addMonths, buildDateLocale, calendarYearRange, type MdyDateLocale, isMonthOutOfRange, isYearOutOfRange, buildMonthGrid, type CalendarCell, type CalendarDate, daysInMonth, formatIsoDate, parseIsoDate, parseLocalizedDate, today } from "@modyra/core/datetime";
import { calendarKeyboardTarget } from "@modyra/core/ui";
import { applyOverlayIntent, bindOutsidePointer } from "../widget-runtime/overlay-host.js";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { renderMonthPicker, renderYearPicker } from "./calendar-pickers.js";
import {
  MdyLitOverlayController,
  POPUP_ANCHOR_STYLE,
  renderOverlayPanel,
} from "./popup-styles.js";

// ─── Date & time ─────────────────────────────────────────────────────────────

type CalendarView = "calendar" | "month" | "year";

/**
 * ISO `yyyy-MM-dd` value model — identical to the engine's convention.
 * Styled text input (typed dates parsed in the page locale or as ISO) with
 * a calendar toggle opening a full keyboard-navigable month grid — the
 * structure and classes the themes style.
 */
export class MdyDatepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    min: { type: String },
    max: { type: String },
    placeholder: { type: String },
    firstDayOfWeek: { type: Number, attribute: "first-day-of-week" },
    variant: { type: String },
    _open: { state: true },
    _view: { state: true },
    _viewYear: { state: true },
    _viewMonth: { state: true },
    _focusedIso: { state: true },
    _draftValue: { state: true },
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
  declare variant: "docked" | "modal";
  declare _open: boolean;
  declare _view: CalendarView;
  declare _viewYear: number;
  declare _viewMonth: number;
  declare _focusedIso: string;
  /** Temporary value used while the modal variant is open. */
  declare _draftValue: string | null;
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
    this._view = "calendar";
    const now = today();
    this._viewYear = now.year;
    this._viewMonth = now.month;
    this._focusedIso = formatIsoDate(now);
    this._draftValue = null;
  }

  private get locale(): string {
    return typeof navigator !== "undefined" ? navigator.language : "en-US";
  }

  /** The host's choice if it made one, the locale's otherwise. */
  private get weekStart(): number {
    return this.firstDayOfWeek ?? buildDateLocale(this.locale).firstDayOfWeek;
  }

  private parse(raw: string): string | null {
    if (!raw) return null;
    const parsed = parseLocalizedDate(raw, this.locale) ?? parseIsoDate(raw);
    return parsed ? formatIsoDate(parsed) : null;
  }

  private rows(): CalendarCell[][] {
    const cells = buildMonthGrid(this._viewYear, this._viewMonth, this.weekStart);
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7) as CalendarCell[]);
    return rows;
  }

  private openPopup(handle: MdyFieldHandle<string | null>, event?: Event): void {
    const selected = handle.value() ? parseIsoDate(handle.value() ?? "") : null;
    const base = selected ?? today();
    this._viewYear = base.year;
    this._viewMonth = base.month;
    this._focusedIso = formatIsoDate(base);
    this._view = "calendar";
    this._draftValue = handle.value() ?? null;
    applyOverlayIntent(this, { type: "open", disabled: handle.disabled(), available: true });
    this.overlay.open(event);
  }

  private closePopup(_handle: MdyFieldHandle<string | null>, refocus = true): void {
    if (!this._open) return;
    applyOverlayIntent(this, { type: "close", restoreFocus: refocus });
    this.overlay.close();
    this._view = "calendar";
    if (refocus) this.querySelector<HTMLInputElement>(".mdy-datepicker__input")?.focus();
  }

  private navigateMonths(delta: number): void {
    const moved = addMonths(
      { year: this._viewYear, month: this._viewMonth, day: 1 },
      delta,
    );
    this._viewYear = moved.year;
    this._viewMonth = moved.month;
    const focused = parseIsoDate(this._focusedIso) ?? today();
    const newFocused = addMonths(focused, delta);
    this._focusedIso = formatIsoDate(newFocused);
  }

  private pick(handle: MdyFieldHandle<string | null>, iso: string): void {
    if (this.variant === "modal") {
      this._draftValue = iso;
      this._focusedIso = iso;
      return;
    }
    this.commitDate(iso);
    this.closePopup(handle);
  }

  private confirmModal(handle: MdyFieldHandle<string | null>): void {
    if (this._draftValue !== null) {
      this.commitDate(this._draftValue);
    }
    this.closePopup(handle);
  }

  private cancelModal(handle: MdyFieldHandle<string | null>): void {
    this.closePopup(handle);
  }

  private onToggleView(): void {
    if (this._view === "calendar") {
      this._view = "year";
    } else {
      this._view = "calendar";
    }
  }

  private onMonthSelected(_handle: MdyFieldHandle<string | null>, month: number): void {
    this._viewMonth = month;
    this._view = "calendar";
    const focused = parseIsoDate(this._focusedIso) ?? today();
    const day = Math.min(focused.day, daysInMonth(focused.year, month));
    this._focusedIso = formatIsoDate({ ...focused, month, day });
  }

  private onYearSelected(year: number): void {
    this._viewYear = year;
    this._view = "month";
    const focused = parseIsoDate(this._focusedIso) ?? today();
    const day = Math.min(focused.day, daysInMonth(year, focused.month));
    this._focusedIso = formatIsoDate({ ...focused, year, day });
  }

  /**
   * The calendar's own vocabulary, from the contract: which months and years the bounds allow, the
   * years a picker offers, and the names for both. Written here it was written twice — the range
   * picker is this component copied — and the two could answer differently.
   */
  private get calendar(): MdyDateLocale {
    return buildDateLocale(this.locale, this.firstDayOfWeek);
  }

  private weekdayNames(): readonly string[] {
    const names = this.calendar.dayNamesNarrow;
    return Array.from({ length: 7 }, (_, i) => names[(this.weekStart + i) % 7] as string);
  }

  private monthNamesShort(): readonly string[] {
    return this.calendar.monthNamesShort;
  }

  private isMonthDisabled(month: number): boolean {
    return isMonthOutOfRange(this._viewYear, month, this.parseMin(), this.parseMax());
  }

  private isYearDisabled(year: number): boolean {
    return isYearOutOfRange(year, this.parseMin(), this.parseMax());
  }

  private yearRange(): readonly number[] {
    return calendarYearRange(this._viewYear, this.parseMin(), this.parseMax());
  }

  private parseMin(): CalendarDate | null {
    return this.min ? parseIsoDate(this.min) : null;
  }

  private parseMax(): CalendarDate | null {
    return this.max ? parseIsoDate(this.max) : null;
  }

  private onGridKeydown(e: KeyboardEvent, handle: MdyFieldHandle<string | null>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      if (this._view !== "calendar") {
        this._view = "calendar";
      } else {
        this.closePopup(handle);
      }
      return;
    }

    if (this._view !== "calendar") return;

    const focused = parseIsoDate(this._focusedIso) ?? today();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.pick(handle, formatIsoDate(focused));
      return;
    }
    // Grid navigation is a pure decision shared with every adapter.
    const next = calendarKeyboardTarget(e.key, focused, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    this._focusedIso = formatIsoDate(next);
    if (next.year !== this._viewYear || next.month !== this._viewMonth) {
      this._viewYear = next.year;
      this._viewMonth = next.month;
    }
  }

  protected override updated(): void {
    if (this._open) {
      if (this._view === "calendar") {
        this.querySelector<HTMLElement>(".mdy-datepicker__cell--focused")?.focus();
      } else if (this._view === "year") {
        this.querySelector<HTMLElement>(
          `.${partClasses("datepicker", "yearCell", { selected: true }).join(".")}`,
        )?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      }
    }
  }

  private fieldController?: MdyDatepickerFieldController;

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
      });
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
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
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

  private renderMonthPicker(handle: MdyFieldHandle<string | null>): unknown {
    return renderMonthPicker(this.monthNamesShort(), {
      kind: "datepicker",
      widgetId: this.fieldId,
      current: this._viewMonth,
      disabled: (month) => this.isMonthDisabled(month),
      pick: (month) => this.onMonthSelected(handle, month),
    });
  }

  private renderYearPicker(): unknown {
    return renderYearPicker(this.yearRange(), {
      kind: "datepicker",
      widgetId: this.fieldId,
      current: this._viewYear,
      disabled: (year) => this.isYearDisabled(year),
      pick: (year) => this.onYearSelected(year),
    });
  }

  private renderCalendarGrid(handle: MdyFieldHandle<string | null>): unknown {
    const selectedIso = this.variant === "modal" ? this._draftValue : handle.value();
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
              cell.iso === this._focusedIso ? "mdy-datepicker__cell--focused" : "",
              disabled ? "mdy-datepicker__cell--disabled" : "",
            ].join(" ");
            return html`<button
              type="button"
              class=${classes}
              role="gridcell"
              tabindex=${cell.iso === this._focusedIso ? "0" : "-1"}
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
    const parsed = this._draftValue ? parseIsoDate(this._draftValue) : null;
    if (!parsed) return this.label || "Select date";
    try {
      return new Intl.DateTimeFormat(this.locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(parsed.year, parsed.month - 1, parsed.day));
    } catch {
      return (this._draftValue ?? this.label) || "Select date";
    }
  }

  private renderPopup(handle: MdyFieldHandle<string | null>): unknown {
    const monthLabel = new Intl.DateTimeFormat(this.locale, { month: "long" }).format(
      new Date(Date.UTC(this._viewYear, this._viewMonth - 1, 1)),
    );
    const modalHeader =
      this.variant === "modal"
        ? html`
            <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">${this.label || "Select date"}</span>
              <span class="mdy-datepicker__modal-value">${this.modalDisplayValue()}</span>
            </div>
          `
        : nothing;
    const actions =
      this.variant === "modal"
        ? html`
            <div class="mdy-datepicker__actions">
              <button
                type="button"
                class="mdy-datepicker__action-btn"
                @click=${() => this.cancelModal(handle)}
              >
                Cancel
              </button>
              <button
                type="button"
                class="mdy-datepicker__action-btn mdy-datepicker__action-btn--primary"
                @click=${() => this.confirmModal(handle)}
              >
                OK
              </button>
            </div>
          `
        : nothing;
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
              aria-label="Change view"
              @click=${this.onToggleView}
            >
              <span class="mdy-datepicker__title">${monthLabel} ${this._viewYear}</span>
              ${mdyIcon("CHEVRON_DOWN", "mdy-datepicker__view-icon")}
            </button>
          </div>
          <div class="mdy-datepicker__header-nav">
            <button
              type="button"
              class="mdy-datepicker__nav-btn"
              aria-label="Previous month"
              ?disabled=${this._view !== "calendar"}
              @click=${() => this.navigateMonths(-1)}
            >
              ${mdyIcon("CHEVRON_LEFT", "")}
            </button>
            <button
              type="button"
              class="mdy-datepicker__nav-btn"
              aria-label="Next month"
              ?disabled=${this._view !== "calendar"}
              @click=${() => this.navigateMonths(1)}
            >
              ${mdyIcon("CHEVRON_RIGHT", "")}
            </button>
          </div>
        </div>
        ${this._view === "calendar"
          ? html`<div class="mdy-datepicker__grid" role="grid" id=${overlayControlledId("datepicker", this.fieldId) ?? nothing}>
              ${this.renderCalendarGrid(handle)}
            </div>`
          : this._view === "month"
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
          .value=${handle.value() ?? ""}
          ?disabled=${handle.disabled()}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded=${this._open ? "true" : "false"}
          aria-controls=${this._open ? overlayControlledId("datepicker", this.fieldId) ?? nothing : nothing}
          ${mdyPart(this.controlPart(handle))}
          @change=${(e: Event) => {
            const el = e.target as HTMLInputElement;
            const iso = this.parse(el.value);
            this.commitDate(iso);
            el.value = handle.value() ?? "";
          }}
          @blur=${() => handle.markAsTouched()}
        />
        <div class="mdy-input-suffix">
          <button
            type="button"
            class="mdy-datepicker__toggle"
            ?disabled=${handle.disabled()}
            aria-label="Open date picker"
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
          modal: this.overlay.state.position === "overlay" || this.variant === "modal",
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
