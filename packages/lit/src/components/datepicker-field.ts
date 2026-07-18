import { html, nothing, type PropertyDeclarations } from "lit";
import {
  addMonths,
  buildMonthGrid,
  type CalendarCell,
  type CalendarDate,
  calendarKeyboardTarget,
  daysInMonth,
  formatIsoDate,
  type MdyFieldHandle,
  parseIsoDate,
  parseLocalizedDate,
  today,
} from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";
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
 * same structure and classes the themes style for the Angular renderer.
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
  /** 0 = Sunday, 1 = Monday (default). */
  declare firstDayOfWeek: number;
  /** `"docked"` (default) opens inline; `"modal"` shows a header and Cancel/OK actions. */
  declare variant: "docked" | "modal";
  declare _open: boolean;
  declare _view: CalendarView;
  declare _viewYear: number;
  declare _viewMonth: number;
  declare _focusedIso: string;
  /** Temporary value used while the modal variant is open. */
  declare _draftValue: string | null;
  protected override readonly rendererClass = "mdy-renderer--datepicker";
  private readonly overlay = new MdyLitOverlayController(this, () => this, {
    widthMode: "auto-content",
  });

  constructor() {
    super();
    this.placeholder = "";
    this.firstDayOfWeek = 1;
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

  private parse(raw: string): string | null {
    if (!raw) return null;
    const parsed = parseLocalizedDate(raw, this.locale) ?? parseIsoDate(raw);
    return parsed ? formatIsoDate(parsed) : null;
  }

  private weekdayNames(): string[] {
    const format = new Intl.DateTimeFormat(this.locale, { weekday: "narrow" });
    // 2024-01-01 is a Monday; build the week from the configured first day.
    return Array.from({ length: 7 }, (_, i) => {
      const day = ((this.firstDayOfWeek + i + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
      return format.format(new Date(Date.UTC(2024, 0, day)));
    });
  }

  private monthNamesShort(): string[] {
    const format = new Intl.DateTimeFormat(this.locale, { month: "short" });
    return Array.from({ length: 12 }, (_, i) =>
      format.format(new Date(Date.UTC(2024, i, 1))),
    );
  }

  private rows(): CalendarCell[][] {
    const cells = buildMonthGrid(this._viewYear, this._viewMonth, this.firstDayOfWeek);
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
    this._open = true;
    this.overlay.open(event);
  }

  private closePopup(handle: MdyFieldHandle<string | null>, refocus = true): void {
    if (!this._open) return;
    this._open = false;
    this.overlay.close();
    this._view = "calendar";
    handle.markAsTouched();
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
    handle.set(iso);
    handle.markAsDirty();
    this.closePopup(handle);
  }

  private confirmModal(handle: MdyFieldHandle<string | null>): void {
    if (this._draftValue !== null) {
      handle.set(this._draftValue);
      handle.markAsDirty();
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

  private parseMin(): CalendarDate | null {
    return this.min ? parseIsoDate(this.min) : null;
  }

  private parseMax(): CalendarDate | null {
    return this.max ? parseIsoDate(this.max) : null;
  }

  private isMonthDisabled(month: number): boolean {
    const min = this.parseMin();
    const max = this.parseMax();
    const year = this._viewYear;
    if (min) {
      if (year < min.year) return true;
      if (year === min.year && month < min.month) return true;
    }
    if (max) {
      if (year > max.year) return true;
      if (year === max.year && month > max.month) return true;
    }
    return false;
  }

  private isYearDisabled(year: number): boolean {
    const min = this.parseMin();
    const max = this.parseMax();
    if (min && year < min.year) return true;
    if (max && year > max.year) return true;
    return false;
  }

  private yearRange(): number[] {
    const min = this.parseMin();
    const max = this.parseMax();
    const minYear = min?.year ?? 1920;
    const maxYear = max?.year ?? 2120;
    const startYear = Math.min(minYear, this._viewYear - 100, 1920);
    const endYear = Math.max(maxYear, this._viewYear + 100, 2120);
    const result: number[] = [];
    for (let y = startYear; y <= endYear; y++) result.push(y);
    return result;
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
        this.querySelector<HTMLElement>(".mdy-datepicker__year-cell--selected")?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      }
    }
  }

  override disconnectedCallback(): void {
    this.overlay.close();
    super.disconnectedCallback();
  }

  private renderMonthPicker(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <div class="mdy-datepicker__month-picker">
        ${this.monthNamesShort().map(
          (name, i) => html`
            <button
              type="button"
              class="mdy-datepicker__month-cell ${i + 1 === this._viewMonth
                ? "mdy-datepicker__month-cell--selected"
                : ""}"
              ?disabled=${this.isMonthDisabled(i + 1)}
              @click=${() => this.onMonthSelected(handle, i + 1)}
            >
              ${name}
            </button>
          `,
        )}
      </div>
    `;
  }

  private renderYearPicker(): unknown {
    const years = this.yearRange();
    return html`
      <div class="mdy-datepicker__year-picker">
        <div class="mdy-datepicker__year-grid">
          ${years.map(
            (year) => html`
              <button
                type="button"
                class="mdy-datepicker__year-cell ${year === this._viewYear
                  ? "mdy-datepicker__year-cell--selected"
                  : ""}"
                ?disabled=${this.isYearDisabled(year)}
                @click=${() => this.onYearSelected(year)}
              >
                ${year}
              </button>
            `,
          )}
        </div>
      </div>
    `;
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
          ? html`<div class="mdy-datepicker__grid">
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
          aria-haspopup="dialog"
          aria-expanded=${this._open ? "true" : "false"}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          aria-describedby=${this.showErrors(handle) ? this.errorsId : nothing}
          @change=${(e: Event) => {
            const el = e.target as HTMLInputElement;
            const iso = this.parse(el.value);
            handle.set(iso);
            el.value = iso ?? "";
            handle.markAsDirty();
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
        ${renderOverlayPanel(this.renderPopup(handle), this._open, {
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
