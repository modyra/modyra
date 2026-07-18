import { html, nothing, type PropertyDeclarations } from "lit";
import {
  addMonths,
  buildMonthGrid,
  type CalendarCell,
  type CalendarDate,
  calendarKeyboardTarget,
  compareDates,
  daysInMonth,
  formatIsoDate,
  isDateBetween,
  isDateInRange,
  type MdyDateRange,
  type MdyFieldHandle,
  orderDates,
  parseIsoDate,
  today,
} from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { POPUP_ANCHOR_STYLE, renderOverlayPanel } from "./popup-styles.js";

// ─── Date range ──────────────────────────────────────────────────────────────

type CalendarView = "calendar" | "month" | "year";
type RangePhase = "pick-start" | "pick-end";

/**
 * Date range picker renderer — compact two-input calendar picker for selecting
 * a start and end date. Matches the structure, classes and interaction of the
 * Angular `MdyDateRangePickerComponent`.
 */
export class MdyDaterangeFieldElement extends MdyFieldElement<MdyDateRange | null> {
  static override properties: PropertyDeclarations = {
    min: { type: String },
    max: { type: String },
    startPlaceholder: { type: String, attribute: "start-placeholder" },
    endPlaceholder: { type: String, attribute: "end-placeholder" },
    firstDayOfWeek: { type: Number, attribute: "first-day-of-week" },
    dateFilter: { attribute: false },
    _open: { state: true },
    _view: { state: true },
    _viewYear: { state: true },
    _viewMonth: { state: true },
    _focusedIso: { state: true },
    _phase: { state: true },
    _pendingStartIso: { state: true },
    _pendingEndIso: { state: true },
    _hoverIso: { state: true },
  };
  declare min?: string;
  declare max?: string;
  declare startPlaceholder: string;
  declare endPlaceholder: string;
  declare firstDayOfWeek: number;
  declare dateFilter?: (date: string) => boolean;
  declare _open: boolean;
  declare _view: CalendarView;
  declare _viewYear: number;
  declare _viewMonth: number;
  declare _focusedIso: string;
  declare _phase: RangePhase;
  declare _pendingStartIso: string | null;
  declare _pendingEndIso: string | null;
  declare _hoverIso: string | null;
  protected override readonly rendererClass = "mdy-renderer--daterange";

  constructor() {
    super();
    this.startPlaceholder = "Start";
    this.endPlaceholder = "End";
    this.firstDayOfWeek = 1;
    this._open = false;
    this._view = "calendar";
    const now = today();
    this._viewYear = now.year;
    this._viewMonth = now.month;
    this._focusedIso = formatIsoDate(now);
    this._phase = "pick-start";
    this._pendingStartIso = null;
    this._pendingEndIso = null;
    this._hoverIso = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("mdy-renderer--datepicker");
  }

  private get locale(): string {
    return typeof navigator !== "undefined" ? navigator.language : "en-US";
  }

  private get startInputId(): string {
    return `${this.fieldId}-start`;
  }

  protected override get labelForId(): string {
    return this.startInputId;
  }

  /** Date-range inputs always look filled because the two inputs are present. */
  protected override isFilled(_handle: MdyFieldHandle<MdyDateRange | null>): boolean {
    return true;
  }

  private parseMin(): CalendarDate | null {
    return this.min ? parseIsoDate(this.min) : null;
  }

  private parseMax(): CalendarDate | null {
    return this.max ? parseIsoDate(this.max) : null;
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

  private weekdayNames(): string[] {
    const format = new Intl.DateTimeFormat(this.locale, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, i) => {
      const day = ((this.firstDayOfWeek + i + 6) % 7) + 1;
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

  private openPopup(handle: MdyFieldHandle<MdyDateRange | null>): void {
    const value = handle.value();
    const start = value?.start ? parseIsoDate(value.start) : null;
    const end = value?.end ? parseIsoDate(value.end) : null;
    const base = start ?? today();
    this._viewYear = base.year;
    this._viewMonth = base.month;
    this._focusedIso = formatIsoDate(base);
    this._pendingStartIso = value?.start ?? null;
    this._pendingEndIso = value?.end ?? null;
    this._phase = start && !end ? "pick-end" : "pick-start";
    this._hoverIso = null;
    this._view = "calendar";
    this._open = true;
  }

  private closePopup(handle: MdyFieldHandle<MdyDateRange | null>, refocus = true): void {
    if (!this._open) return;
    this._open = false;
    this._view = "calendar";
    handle.markAsTouched();
    if (refocus) {
      this.querySelector<HTMLInputElement>(".mdy-daterange__input")?.focus();
    }
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

  private onDatePicked(handle: MdyFieldHandle<MdyDateRange | null>, date: CalendarDate): void {
    const iso = formatIsoDate(date);
    this._focusedIso = iso;

    if (this._phase === "pick-start") {
      this._pendingStartIso = iso;
      this._pendingEndIso = null;
      this._phase = "pick-end";
      this._hoverIso = null;
      return;
    }

    const start = this._pendingStartIso ? parseIsoDate(this._pendingStartIso) : null;
    if (!start) {
      this._pendingStartIso = iso;
      this._phase = "pick-end";
      this._hoverIso = null;
      return;
    }

    const [s, e] = compareDates(start, date) <= 0 ? [start, date] : [date, start];
    this._pendingStartIso = formatIsoDate(s);
    this._pendingEndIso = formatIsoDate(e);
    this.commitRange(handle, this._pendingStartIso, this._pendingEndIso);
    this.closePopup(handle);
  }

  private onDateHovered(date: CalendarDate): void {
    if (this._phase === "pick-end") {
      this._hoverIso = formatIsoDate(date);
    }
  }

  private onToggleView(): void {
    if (this._view === "calendar") {
      this._view = "year";
    } else {
      this._view = "calendar";
    }
  }

  private onMonthSelected(month: number): void {
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

  private onGridKeydown(e: KeyboardEvent, handle: MdyFieldHandle<MdyDateRange | null>): void {
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

    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        if (!isDateInRange(focused, this.parseMin(), this.parseMax())) return;
        const iso = formatIsoDate(focused);
        if (!this.isDateFilterAllowed(iso)) return;
        this.onDatePicked(handle, focused);
        return;
      }
    }

    const next = calendarKeyboardTarget(e.key, focused, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    this._focusedIso = formatIsoDate(next);
    if (this._phase === "pick-end") {
      this._hoverIso = formatIsoDate(next);
    }
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

  private effectiveRange(): readonly [CalendarDate | null, CalendarDate | null] {
    const start = this._pendingStartIso ? parseIsoDate(this._pendingStartIso) : null;
    const end = this._pendingEndIso ? parseIsoDate(this._pendingEndIso) : this._hoverIso ? parseIsoDate(this._hoverIso) : null;
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
    const focused = parseIsoDate(this._focusedIso);
    return focused !== null && isSameDay(cell.date, focused);
  }

  private isCellToday(cell: CalendarCell): boolean {
    return isSameDay(cell.date, today());
  }

  private renderMonthPicker(): unknown {
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
              @click=${() => this.onMonthSelected(i + 1)}
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
              class=${classes}
              tabindex=${this.isCellFocused(cell) ? "0" : "-1"}
              aria-selected=${rangeEndpoint ? "true" : "false"}
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

  private renderPopup(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    const monthLabel = new Intl.DateTimeFormat(this.locale, { month: "long" }).format(
      new Date(Date.UTC(this._viewYear, this._viewMonth - 1, 1)),
    );
    const hint = this._phase === "pick-start" ? "Select start date" : "Select end date";
    return html`
      <div
        class="mdy-datepicker__calendar"
        role="dialog"
        aria-label=${this.label || "Choose date range"}
        @keydown=${(e: KeyboardEvent) => this.onGridKeydown(e, handle)}
      >
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
            </div>
            <div class="mdy-daterange__hint" aria-live="polite">${hint}</div>`
          : this._view === "month"
            ? this.renderMonthPicker()
            : this.renderYearPicker()}
      </div>
    `;
  }

  protected override renderControl(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    const range = handle.value() ?? { start: null, end: null };
    const baseLabel = this.label ? `${this.label} — ` : "";
    return html`
      <div class="mdy-datepicker">
        <div class="mdy-input-wrapper mdy-daterange__group">
          <span
            class="mdy-daterange__input-sizer"
            data-value=${range.start ?? this.startPlaceholder}
          >
            <input
              id=${this.startInputId}
              type="text"
              class="mdy-datepicker__input mdy-daterange__input"
              placeholder=${this.startPlaceholder}
              .value=${range.start ?? ""}
              ?disabled=${handle.disabled()}
              aria-haspopup="dialog"
              aria-expanded=${this._open ? "true" : "false"}
              aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
              aria-required=${handle.required() ? "true" : "false"}
              aria-describedby=${this.showErrors(handle) ? this.errorsId : nothing}
              aria-label=${`${baseLabel}Start date`}
              autocomplete="off"
              @change=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const current = handle.value() ?? { start: null, end: null };
                const parsed = raw ? parseIsoDate(raw) : null;
                const iso = parsed ? formatIsoDate(parsed) : null;
                this.commitRange(handle, iso, current.end);
                (e.target as HTMLInputElement).value = iso ?? "";
              }}
              @blur=${() => handle.markAsTouched()}
            />
          </span>
          <span class="mdy-daterange__sep" aria-hidden="true">–</span>
          <span
            class="mdy-daterange__input-sizer"
            data-value=${range.end ?? this.endPlaceholder}
          >
            <input
              type="text"
              class="mdy-datepicker__input mdy-daterange__input"
              placeholder=${this.endPlaceholder}
              .value=${range.end ?? ""}
              ?disabled=${handle.disabled()}
              aria-haspopup="dialog"
              aria-expanded=${this._open ? "true" : "false"}
              aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
              aria-required=${handle.required() ? "true" : "false"}
              aria-describedby=${this.showErrors(handle) ? this.errorsId : nothing}
              aria-label=${`${baseLabel}End date`}
              autocomplete="off"
              @change=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const current = handle.value() ?? { start: null, end: null };
                const parsed = raw ? parseIsoDate(raw) : null;
                const iso = parsed ? formatIsoDate(parsed) : null;
                this.commitRange(handle, current.start, iso);
                (e.target as HTMLInputElement).value = iso ?? "";
              }}
              @blur=${() => handle.markAsTouched()}
            />
          </span>
          <div class="mdy-input-suffix">
            <button
              type="button"
              class="mdy-datepicker__toggle"
              ?disabled=${handle.disabled()}
              aria-label="Open date range picker"
              aria-expanded=${this._open ? "true" : "false"}
              tabindex="-1"
              @click=${() => (this._open ? this.closePopup(handle) : this.openPopup(handle))}
            >
              ${mdyIcon("CALENDAR", "mdy-datepicker__icon")}
            </button>
          </div>
        </div>
        ${renderOverlayPanel(this.renderPopup(handle), this._open, this)}
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

function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
