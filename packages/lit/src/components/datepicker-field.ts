import { html, nothing, type PropertyDeclarations } from "lit";
import {
  buildMonthGrid,
  type CalendarCell,
  calendarKeyboardTarget,
  formatIsoDate,
  type MdyFieldHandle,
  parseIsoDate,
  parseLocalizedDate,
  today,
} from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { POPUP_ANCHOR_STYLE, POPUP_STYLE } from "./popup-styles.js";

// ─── Date & time ─────────────────────────────────────────────────────────────

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
    _open: { state: true },
    _viewYear: { state: true },
    _viewMonth: { state: true },
    _focusedIso: { state: true },
  };
  declare min?: string;
  declare max?: string;
  declare placeholder: string;
  /** 0 = Sunday, 1 = Monday (default). */
  declare firstDayOfWeek: number;
  declare _open: boolean;
  declare _viewYear: number;
  declare _viewMonth: number;
  declare _focusedIso: string;
  protected override readonly rendererClass = "mdy-renderer--datepicker";

  constructor() {
    super();
    this.placeholder = "";
    this.firstDayOfWeek = 1;
    this._open = false;
    const now = today();
    this._viewYear = now.year;
    this._viewMonth = now.month;
    this._focusedIso = formatIsoDate(now);
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

  private rows(): CalendarCell[][] {
    const cells = buildMonthGrid(this._viewYear, this._viewMonth, this.firstDayOfWeek);
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7) as CalendarCell[]);
    return rows;
  }

  private openPopup(handle: MdyFieldHandle<string | null>): void {
    const selected = handle.value() ? parseIsoDate(handle.value() ?? "") : null;
    const base = selected ?? today();
    this._viewYear = base.year;
    this._viewMonth = base.month;
    this._focusedIso = formatIsoDate(base);
    this._open = true;
  }

  private closePopup(handle: MdyFieldHandle<string | null>, refocus = true): void {
    if (!this._open) return;
    this._open = false;
    handle.markAsTouched();
    if (refocus) this.querySelector<HTMLInputElement>(".mdy-datepicker__input")?.focus();
  }

  private navigateMonths(delta: number): void {
    const moved = new Date(Date.UTC(this._viewYear, this._viewMonth - 1 + delta, 1));
    this._viewYear = moved.getUTCFullYear();
    this._viewMonth = moved.getUTCMonth() + 1;
  }

  private pick(handle: MdyFieldHandle<string | null>, iso: string): void {
    handle.set(iso);
    handle.markAsDirty();
    this.closePopup(handle);
  }

  private onGridKeydown(e: KeyboardEvent, handle: MdyFieldHandle<string | null>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      this.closePopup(handle);
      return;
    }
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
      this.querySelector<HTMLElement>(".mdy-datepicker__cell--focused")?.focus();
    }
  }

  private renderPopup(handle: MdyFieldHandle<string | null>): unknown {
    const monthLabel = new Intl.DateTimeFormat(this.locale, { month: "long" }).format(
      new Date(Date.UTC(this._viewYear, this._viewMonth - 1, 1)),
    );
    const selectedIso = handle.value();
    const todayIso = formatIsoDate(today());
    const inRange = (iso: string): boolean =>
      (!this.min || iso >= this.min) && (!this.max || iso <= this.max);
    return html`
      <div
        class="mdy-datepicker__calendar"
        role="dialog"
        aria-label=${this.label || "Choose date"}
        style=${POPUP_STYLE}
        @keydown=${(e: KeyboardEvent) => this.onGridKeydown(e, handle)}
      >
        <div class="mdy-datepicker__header-label">
          <span class="mdy-datepicker__title">${monthLabel} ${this._viewYear}</span>
        </div>
        <div class="mdy-datepicker__header-nav">
          <button
            type="button"
            class="mdy-datepicker__nav-btn"
            aria-label="Previous month"
            @click=${() => this.navigateMonths(-1)}
          >
            ${mdyIcon("CHEVRON_LEFT", "")}
          </button>
          <button
            type="button"
            class="mdy-datepicker__nav-btn"
            aria-label="Next month"
            @click=${() => this.navigateMonths(1)}
          >
            ${mdyIcon("CHEVRON_RIGHT", "")}
          </button>
        </div>
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
      </div>
    `;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
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
          @click=${() => (this._open ? this.closePopup(handle) : this.openPopup(handle))}
        >
          ${mdyIcon("CALENDAR", "mdy-datepicker__icon")}
        </button>
      </div>
      ${this._open ? this.renderPopup(handle) : nothing}
    `;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const base = super.render();
    return html`<div style=${POPUP_ANCHOR_STYLE}>${base}</div>`;
  }
}
