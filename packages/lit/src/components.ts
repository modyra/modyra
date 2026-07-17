/**
 * The Modyra control catalog for Lit — one element per field kind, with
 * the same DOM structure and class contract as the Angular renderers, so
 * the shipped themes style both identically.
 *
 * Value models match the engine's conventions: dates are ISO
 * `yyyy-MM-dd` strings, times are `HH:mm`, colors are hex strings, files
 * are `File | File[] | null`.
 */
import { html, nothing, PropertyDeclarations } from "lit";
import {
  buildMonthGrid,
  CalendarCell,
  calendarKeyboardTarget,
  formatIsoDate,
  formatTimeAs,
  listboxNextIndex,
  MdyDateRange,
  MdyFieldHandle,
  MdySelectOption,
  parse24Time,
  parseIsoDate,
  parseLocalizedDate,
  parseTime,
  today,
} from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "./base.js";

/** Visually hidden native input used as the platform picker behind a styled control. */
const POPUP_ANCHOR_STYLE = "position:relative";
const POPUP_STYLE = "position:absolute;top:calc(100% + 4px);left:0;z-index:1000";

const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";

// ─── Text-like ────────────────────────────────────────────────────────────────

export class MdyTextFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    type: { type: String },
    placeholder: { type: String },
    autocomplete: { type: String },
  };
  declare type: string;
  declare placeholder: string;
  declare autocomplete: string;
  protected override readonly rendererClass = "mdy-renderer--text";

  constructor() {
    super();
    this.type = "text";
    this.placeholder = "";
    this.autocomplete = "";
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`<input
      id=${this.fieldId}
      type=${this.type}
      placeholder=${this.placeholder}
      autocomplete=${this.autocomplete || nothing}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
      aria-required=${handle.required() ? "true" : "false"}
      aria-describedby=${this.showErrors(handle) ? this.errorsId : nothing}
      @input=${(e: Event) => {
        handle.set((e.target as HTMLInputElement).value);
        handle.markAsDirty();
      }}
      @blur=${() => handle.markAsTouched()}
    />`;
  }
}

export class MdyTextareaFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    rows: { type: Number },
    placeholder: { type: String },
  };
  declare rows: number;
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--textarea";

  constructor() {
    super();
    this.rows = 3;
    this.placeholder = "";
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`<textarea
      id=${this.fieldId}
      rows=${this.rows}
      placeholder=${this.placeholder}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
      aria-required=${handle.required() ? "true" : "false"}
      @input=${(e: Event) => {
        handle.set((e.target as HTMLTextAreaElement).value);
        handle.markAsDirty();
      }}
      @blur=${() => handle.markAsTouched()}
    ></textarea>`;
  }
}

export class MdyNumberFieldElement extends MdyFieldElement<number | null> {
  static override properties: PropertyDeclarations = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };
  declare min?: number;
  declare max?: number;
  declare step?: number;
  protected override readonly rendererClass = "mdy-renderer--number";

  protected override renderControl(handle: MdyFieldHandle<number | null>): unknown {
    return html`<input
      id=${this.fieldId}
      type="number"
      min=${this.min ?? nothing}
      max=${this.max ?? nothing}
      step=${this.step ?? nothing}
      .value=${handle.value() === null ? "" : String(handle.value())}
      ?disabled=${handle.disabled()}
      aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
      aria-required=${handle.required() ? "true" : "false"}
      @input=${(e: Event) => {
        const n = (e.target as HTMLInputElement).valueAsNumber;
        handle.set(Number.isNaN(n) ? null : n);
        handle.markAsDirty();
      }}
      @blur=${() => handle.markAsTouched()}
    />`;
  }
}

// ─── Boolean ─────────────────────────────────────────────────────────────────

export class MdyCheckboxFieldElement extends MdyFieldElement<boolean> {
  protected override readonly rendererClass = "mdy-renderer--checkbox";

  protected override renderControl(): unknown {
    return nothing;
  }

  /** Same structure as the Angular renderer: label wraps input + text. */
  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    return html`
      <label class="mdy-checkbox">
        <input
          id=${this.fieldId}
          type="checkbox"
          .checked=${handle.value() === true}
          ?disabled=${handle.disabled()}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          aria-describedby=${this.showErrors(handle) ? this.errorsId : nothing}
          @change=${(e: Event) => {
            handle.set((e.target as HTMLInputElement).checked);
            handle.markAsDirty();
          }}
          @blur=${() => handle.markAsTouched()}
        />
        <span class="mdy-label">
          ${this.label}
          ${this.label && handle.required()
            ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
            : nothing}
        </span>
      </label>
      ${this.renderErrors(handle)}
    `;
  }
}

export class MdyToggleFieldElement extends MdyFieldElement<boolean> {
  protected override readonly rendererClass = "mdy-renderer--toggle";

  protected override renderControl(): unknown {
    return nothing;
  }

  /** Same structure as the Angular renderer: input + track/thumb + label. */
  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    return html`
      <label class="mdy-toggle">
        <input
          id=${this.fieldId}
          type="checkbox"
          role="switch"
          .checked=${handle.value() === true}
          ?disabled=${handle.disabled()}
          aria-checked=${handle.value() === true ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          @change=${(e: Event) => {
            handle.set((e.target as HTMLInputElement).checked);
            handle.markAsDirty();
          }}
          @blur=${() => handle.markAsTouched()}
        />
        <span class="mdy-toggle__track" aria-hidden="true">
          <span class="mdy-toggle__thumb"></span>
        </span>
        ${this.label
          ? html`<span class="mdy-toggle__label">
              ${this.label}
              ${handle.required()
                ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
                : nothing}
            </span>`
          : nothing}
      </label>
      ${this.renderErrors(handle)}
    `;
  }
}

// ─── Option-based ────────────────────────────────────────────────────────────

abstract class MdyOptionsFieldElement<T> extends MdyFieldElement<T> {
  static override properties: PropertyDeclarations = {
    options: { attribute: false },
  };
  declare options: ReadonlyArray<MdySelectOption<unknown>>;

  constructor() {
    super();
    this.options = [];
  }

  protected get labelId(): string {
    return `${this.fieldId}-label`;
  }

  /** Group label: real id, no `for` (there is no single input to point to). */
  protected renderGroupLabel(handle: MdyFieldHandle<T>): unknown {
    return html`<label class="mdy-label" id=${this.labelId}>
      ${this.label}
      ${handle.required()
        ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
        : nothing}
    </label>`;
  }
}

export class MdyRadioGroupFieldElement extends MdyOptionsFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--radio-group";

  protected override renderControl(): unknown {
    return nothing;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    return html`
      ${this.renderGroupLabel(handle)}
      <div
        class="mdy-radio-group"
        role="radiogroup"
        aria-labelledby=${this.label ? this.labelId : nothing}
      >
        ${this.options.map(
          (option) => html`<label
            class="mdy-radio-item ${handle.disabled() ? "mdy-radio-item--disabled" : ""}"
          >
            <input
              type="radio"
              name=${this.fieldId}
              .checked=${handle.value() === option.value}
              ?disabled=${handle.disabled() || option.disabled === true}
              aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
              aria-required=${handle.required() ? "true" : "false"}
              @change=${() => {
                handle.set(option.value);
                handle.markAsDirty();
              }}
              @blur=${() => handle.markAsTouched()}
            />
            <span class="mdy-radio-circle"></span>
            <span class="mdy-radio-label">${option.label}</span>
          </label>`,
        )}
      </div>
      ${this.renderErrors(handle)}
    `;
  }
}

export class MdySegmentedFieldElement extends MdyOptionsFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--segmented";

  protected override renderControl(): unknown {
    return nothing;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    const last = this.options.length - 1;
    return html`
      ${this.renderGroupLabel(handle)}
      <div
        class="mdy-segmented"
        role="radiogroup"
        aria-labelledby=${this.label ? this.labelId : nothing}
      >
        ${this.options.map((option, index) => {
          const selected = handle.value() === option.value;
          const classes = [
            "mdy-segmented__button",
            index === 0 ? "mdy-segmented__button--first" : "",
            index === last ? "mdy-segmented__button--last" : "",
            selected ? "mdy-segmented__button--selected" : "",
          ].join(" ");
          return html`<button
            type="button"
            class=${classes}
            role="radio"
            aria-checked=${selected ? "true" : "false"}
            ?disabled=${handle.disabled() || option.disabled === true}
            @click=${() => {
              handle.set(option.value);
              handle.markAsDirty();
              handle.markAsTouched();
            }}
          >
            ${option.label}
          </button>`;
        })}
      </div>
      ${this.renderErrors(handle)}
    `;
  }
}

// ─── Dropdown select / multiselect ───────────────────────────────────────────

abstract class MdyDropdownFieldElement<T> extends MdyOptionsFieldElement<T> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    _open: { state: true },
    _activeIndex: { state: true },
  };
  declare placeholder: string;
  declare _open: boolean;
  declare _activeIndex: number;

  constructor() {
    super();
    this.placeholder = "";
    this._open = false;
    this._activeIndex = -1;
  }

  protected abstract isSelected(handle: MdyFieldHandle<T>, value: unknown): boolean;
  protected abstract pick(handle: MdyFieldHandle<T>, value: unknown): void;
  protected abstract triggerText(handle: MdyFieldHandle<T>): string;
  protected get multiselectable(): boolean {
    return false;
  }

  protected toggleOpen(handle: MdyFieldHandle<T>): void {
    if (handle.disabled()) return;
    this._open = !this._open;
    if (!this._open) handle.markAsTouched();
  }

  protected close(handle: MdyFieldHandle<T>): void {
    if (!this._open) return;
    this._open = false;
    handle.markAsTouched();
  }

  protected onKeydown(e: KeyboardEvent, handle: MdyFieldHandle<T>): void {
    if (!this._open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._open = true;
      }
      return;
    }
    // Navigation is a pure decision shared with every adapter.
    const next = listboxNextIndex(e.key, this._activeIndex, this.options.length);
    if (next !== null) {
      e.preventDefault();
      this._activeIndex = next;
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = this.options[this._activeIndex];
      if (option) this.pick(handle, option.value);
      if (!this.multiselectable) this.close(handle);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.close(handle);
    }
  }

  protected override renderControl(): unknown {
    return nothing;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    this.classList.toggle("mdy-renderer--open", this._open);
    const text = this.triggerText(handle);
    return html`
      <label class="mdy-label" id=${this.labelId} for=${this.fieldId}>
        ${this.label}
        ${handle.required()
          ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
          : nothing}
      </label>
      <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
        <button
          type="button"
          class="mdy-select__trigger"
          id=${this.fieldId}
          aria-haspopup="listbox"
          aria-expanded=${this._open ? "true" : "false"}
          aria-labelledby=${this.labelId}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          ?disabled=${handle.disabled()}
          @click=${() => this.toggleOpen(handle)}
          @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          @blur=${() => setTimeout(() => this.close(handle), 120)}
        >
          ${text
            ? html`<span class="mdy-select__value">${text}</span>`
            : html`<span class="mdy-select__placeholder">${this.placeholder}</span>`}
          ${mdyIcon("CHEVRON_DOWN", "mdy-select__arrow")}
        </button>
        ${this._open
          ? html`<div class="mdy-select__dropdown">
              <ul
                class="mdy-select__list"
                role="listbox"
                aria-multiselectable=${this.multiselectable ? "true" : nothing}
              >
                ${this.options.map((option, index) => {
                  const selected = this.isSelected(handle, option.value);
                  const classes = [
                    "mdy-select__option",
                    selected ? "mdy-select__option--selected" : "",
                    index === this._activeIndex ? "mdy-select__option--active" : "",
                  ].join(" ");
                  return html`<li
                    class=${classes}
                    role="option"
                    aria-selected=${selected ? "true" : "false"}
                    @pointerdown=${(e: Event) => e.preventDefault()}
                    @click=${() => {
                      this.pick(handle, option.value);
                      if (!this.multiselectable) this.close(handle);
                    }}
                  >
                    <span class="mdy-select__option-label">${option.label}</span>
                  </li>`;
                })}
              </ul>
            </div>`
          : nothing}
      </div>
      ${this.renderErrors(handle)}
    `;
  }
}

export class MdySelectFieldElement extends MdyDropdownFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--select";

  protected override isSelected(handle: MdyFieldHandle<unknown | null>, value: unknown): boolean {
    return handle.value() === value;
  }

  protected override pick(handle: MdyFieldHandle<unknown | null>, value: unknown): void {
    handle.set(value);
    handle.markAsDirty();
  }

  protected override triggerText(handle: MdyFieldHandle<unknown | null>): string {
    return this.options.find((o) => o.value === handle.value())?.label ?? "";
  }
}

export class MdyMultiselectFieldElement extends MdyDropdownFieldElement<readonly unknown[]> {
  protected override readonly rendererClass = "mdy-renderer--multiselect";

  protected override get multiselectable(): boolean {
    return true;
  }

  protected override isSelected(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): boolean {
    return (handle.value() ?? []).includes(value);
  }

  protected override pick(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    const current = handle.value() ?? [];
    handle.set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
    handle.markAsDirty();
  }

  protected override triggerText(handle: MdyFieldHandle<readonly unknown[]>): string {
    const current = handle.value() ?? [];
    if (current.length === 0) return "";
    return this.options
      .filter((o) => current.includes(o.value))
      .map((o) => o.label)
      .join(", ");
  }
}

// ─── Slider ──────────────────────────────────────────────────────────────────

export class MdySliderFieldElement extends MdyFieldElement<number> {
  static override properties: PropertyDeclarations = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };
  declare min: number;
  declare max: number;
  declare step: number;
  protected override readonly rendererClass = "mdy-renderer--slider";

  constructor() {
    super();
    this.min = 0;
    this.max = 100;
    this.step = 1;
  }

  protected override renderControl(handle: MdyFieldHandle<number>): unknown {
    const value = handle.value() ?? this.min;
    const pct = ((value - this.min) / (this.max - this.min || 1)) * 100;
    return html`<div class="mdy-slider-container">
      <input
        id=${this.fieldId}
        type="range"
        class="mdy-slider"
        style="--mdy-slider-fill-pct: ${pct}%"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(value)}
        ?disabled=${handle.disabled()}
        aria-required=${handle.required() ? "true" : "false"}
        @input=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).valueAsNumber);
          handle.markAsDirty();
        }}
        @change=${() => handle.markAsTouched()}
      />
      <span class="mdy-slider-value">${handle.value()}</span>
    </div>`;
  }
}

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

export class MdyDaterangeFieldElement extends MdyFieldElement<MdyDateRange | null> {
  protected override readonly rendererClass = "mdy-renderer--daterange";

  protected override renderControl(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    const range = handle.value() ?? { start: null, end: null };
    const patch = (part: Partial<MdyDateRange>): void => {
      handle.set({ ...range, ...part });
      handle.markAsDirty();
      handle.markAsTouched();
    };
    return html`
      <input
        id=${this.fieldId}
        type="date"
        class="mdy-datepicker__input"
        .value=${range.start ?? ""}
        max=${range.end ?? nothing}
        ?disabled=${handle.disabled()}
        @change=${(e: Event) => patch({ start: (e.target as HTMLInputElement).value || null })}
      />
      <span aria-hidden="true">–</span>
      <input
        type="date"
        class="mdy-datepicker__input"
        .value=${range.end ?? ""}
        min=${range.start ?? nothing}
        ?disabled=${handle.disabled()}
        aria-label=${`${this.label} (end)`}
        @change=${(e: Event) => patch({ end: (e.target as HTMLInputElement).value || null })}
      />
    `;
  }
}

/**
 * `HH:mm` (24h) value model. Styled text input (accepts `14:30`, `2:30 pm`,
 * `1430`…) with a clock toggle opening the hour/minute segment editor —
 * the same field structure the themes style for the Angular renderer.
 */
export class MdyTimepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    _open: { state: true },
    _hour: { state: true },
    _minute: { state: true },
  };
  declare placeholder: string;
  declare _open: boolean;
  declare _hour: number;
  declare _minute: number;
  protected override readonly rendererClass = "mdy-renderer--timepicker";

  constructor() {
    super();
    this.placeholder = "";
    this._open = false;
    this._hour = 12;
    this._minute = 0;
  }

  private openPopup(handle: MdyFieldHandle<string | null>): void {
    const parsed = parse24Time(handle.value());
    if (parsed) {
      this._hour = parsed.period === "PM" ? (parsed.hour % 12) + 12 : parsed.hour % 12;
      this._minute = parsed.minute;
    }
    this._open = true;
  }

  private closePopup(handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    this._open = false;
    handle.markAsTouched();
    this.querySelector<HTMLInputElement>(".mdy-timepicker__input")?.focus();
  }

  private confirm(handle: MdyFieldHandle<string | null>): void {
    const hh = String(this._hour).padStart(2, "0");
    const mm = String(this._minute).padStart(2, "0");
    handle.set(`${hh}:${mm}`);
    handle.markAsDirty();
    this.closePopup(handle);
  }

  private renderSegment(
    label: string,
    value: number,
    max: number,
    apply: (next: number) => void,
  ): unknown {
    const clamp = (n: number): number => ((n % (max + 1)) + max + 1) % (max + 1);
    return html`<div class="mdy-timepicker-segment">
      <input
        type="number"
        class="mdy-timepicker-segment-input"
        .value=${String(value).padStart(2, "0")}
        min="0"
        max=${max}
        aria-label=${label}
        @input=${(e: Event) => {
          const n = (e.target as HTMLInputElement).valueAsNumber;
          if (!Number.isNaN(n)) apply(clamp(n));
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            apply(clamp(value + 1));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            apply(clamp(value - 1));
          }
        }}
      />
      <span class="mdy-timepicker-segment-label">${label}</span>
    </div>`;
  }

  private renderPopup(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <div
        class="mdy-timepicker-content"
        role="dialog"
        aria-label=${this.label || "Choose time"}
        style=${POPUP_STYLE}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            this.closePopup(handle);
          }
        }}
      >
        <div class="mdy-timepicker-fields">
          ${this.renderSegment("Hours", this._hour, 23, (n) => (this._hour = n))}
          <span class="mdy-timepicker-separator" aria-hidden="true">:</span>
          ${this.renderSegment("Minutes", this._minute, 59, (n) => (this._minute = n))}
        </div>
        <div class="mdy-timepicker-actions">
          <button
            type="button"
            class="mdy-timepicker-action-btn"
            @click=${() => this.closePopup(handle)}
          >
            Cancel
          </button>
          <button
            type="button"
            class="mdy-timepicker-action-btn mdy-timepicker-action-btn--confirm"
            @click=${() => this.confirm(handle)}
          >
            OK
          </button>
        </div>
      </div>
    `;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
      <input
        id=${this.fieldId}
        type="text"
        class="mdy-timepicker__input"
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
          const parsed = parse24Time(el.value) ?? parseTime(el.value);
          const value = parsed ? formatTimeAs(parsed, "24h") : null;
          handle.set(value);
          el.value = value ?? "";
          handle.markAsDirty();
        }}
        @blur=${() => handle.markAsTouched()}
      />
      <div class="mdy-input-suffix">
        <button
          type="button"
          class="mdy-timepicker__toggle"
          ?disabled=${handle.disabled()}
          aria-label="Open time picker"
          aria-expanded=${this._open ? "true" : "false"}
          @click=${() => (this._open ? this.closePopup(handle) : this.openPopup(handle))}
        >
          ${mdyIcon("CLOCK", "mdy-timepicker__icon")}
        </button>
      </div>
      ${this._open ? this.renderPopup(handle) : nothing}
    `;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    return html`<div style=${POPUP_ANCHOR_STYLE}>${super.render()}</div>`;
  }
}

// ─── Color & file ────────────────────────────────────────────────────────────

/**
 * Hex string value model (`#rrggbb`). Preview swatch opening the platform
 * color picker, plus the accessible hex text input — the same closed-state
 * structure the themes style for the Angular renderer.
 */
export class MdyColorsFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    presets: { attribute: false },
    _open: { state: true },
  };
  /** Preset swatches shown in the dropdown. */
  declare presets: readonly string[];
  declare _open: boolean;
  protected override readonly rendererClass = "mdy-renderer--colors";

  constructor() {
    super();
    this.presets = [
      "#4361ee", "#3a0ca3", "#7209b7", "#f72585", "#e63946",
      "#f77f00", "#fcbf49", "#2a9d8f", "#43aa8b", "#264653",
      "#1d3557", "#000000", "#6c757d", "#ffffff",
    ];
    this._open = false;
  }

  private set(handle: MdyFieldHandle<string | null>, value: string): void {
    const v = value.trim();
    handle.set(/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : v === "" ? null : handle.value());
    handle.markAsDirty();
  }

  private close(handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    this._open = false;
    handle.markAsTouched();
  }

  private renderDropdown(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <div
        class="mdy-colors__dropdown"
        role="listbox"
        aria-label="Color presets"
        style=${POPUP_STYLE}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            this.close(handle);
          }
        }}
      >
        <div class="mdy-colors__dropdown-header">Presets</div>
        <div class="mdy-colors__presets">
          ${this.presets.map(
            (preset) => html`<button
              type="button"
              class="mdy-color-swatch ${handle.value() === preset ? "mdy-color-swatch--active" : ""}"
              role="option"
              aria-selected=${handle.value() === preset ? "true" : "false"}
              aria-label=${preset}
              style="background-color:${preset}"
              @click=${() => {
                this.set(handle, preset);
                this.close(handle);
              }}
            ></button>`,
          )}
        </div>
        <button
          type="button"
          class="mdy-colors__primary-picker"
          @click=${() => {
            this.querySelector<HTMLInputElement>("input[type=color]")?.showPicker?.();
          }}
        >
          Custom…
        </button>
      </div>
    `;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
      <button
        type="button"
        class="mdy-colors__toggle-area"
        ?disabled=${handle.disabled()}
        aria-haspopup="listbox"
        aria-expanded=${this._open ? "true" : "false"}
        aria-label=${`${this.label} — open color presets`}
        @click=${() => (this._open ? this.close(handle) : (this._open = true))}
      >
        <div
          class="mdy-colors__preview-swatch"
          style="background-color:${handle.value() ?? "#4361ee"}"
        ></div>
        ${mdyIcon("CHEVRON_DOWN", "mdy-select__arrow")}
      </button>
      <input
        type="color"
        class="mdy-colors__native-hidden"
        tabindex="-1"
        style=${NATIVE_HIDDEN_STYLE}
        .value=${handle.value() ?? "#000000"}
        @input=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).value);
          handle.markAsDirty();
          handle.markAsTouched();
        }}
      />
      <input
        id=${this.fieldId}
        type="text"
        class="mdy-colors__hex-input"
        spellcheck="false"
        .value=${handle.value() ?? ""}
        placeholder="#000000"
        aria-label=${`${this.label} (hex)`}
        aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
        aria-required=${handle.required() ? "true" : "false"}
        ?disabled=${handle.disabled()}
        @change=${(e: Event) => this.set(handle, (e.target as HTMLInputElement).value)}
        @blur=${() => handle.markAsTouched()}
      />
      ${this._open ? this.renderDropdown(handle) : nothing}
    `;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    return html`<div style=${POPUP_ANCHOR_STYLE}>${super.render()}</div>`;
  }
}

export class MdyFileFieldElement extends MdyFieldElement<File | File[] | null> {
  static override properties: PropertyDeclarations = {
    multiple: { type: Boolean },
    accept: { type: String },
    placeholder: { type: String },
  };
  declare multiple: boolean;
  declare accept: string;
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--file";

  constructor() {
    super();
    this.multiple = false;
    this.accept = "";
    this.placeholder = "";
  }

  private _dragOver = false;

  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<File | File[] | null>): unknown {
    const current = handle.value();
    const files = current === null ? [] : Array.isArray(current) ? current : [current];
    const pick = (picked: File[]): void => {
      handle.set(this.multiple ? picked : (picked[0] ?? null));
      handle.markAsDirty();
      handle.markAsTouched();
    };
    return html`
      <div
        class="mdy-file-container ${this._dragOver ? "mdy-file-container--dragover" : ""}"
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          this._dragOver = true;
          this.requestUpdate();
        }}
        @dragleave=${() => {
          this._dragOver = false;
          this.requestUpdate();
        }}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          this._dragOver = false;
          pick(Array.from(e.dataTransfer?.files ?? []));
        }}
      >
        <input
          id=${this.fieldId}
          type="file"
          class="mdy-file-input"
          ?multiple=${this.multiple}
          accept=${this.accept || nothing}
          ?disabled=${handle.disabled()}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          @change=${(e: Event) => pick(Array.from((e.target as HTMLInputElement).files ?? []))}
          @blur=${() => handle.markAsTouched()}
        />
        <div class="mdy-file-content">
          ${mdyIcon("PLUS", "mdy-file-icon")}
          <div class="mdy-file-info">
            ${files.length === 0
              ? html`<span class="mdy-file-placeholder">${this.placeholder || "Choose a file or drop it here"}</span>`
              : html`<ul class="mdy-file-list">
                  ${files.map(
                    (f, i) => html`<li class="mdy-file-item">
                      <span class="mdy-file-name">${f.name}</span>
                      <button
                        type="button"
                        class="mdy-file-clear"
                        aria-label=${`Remove ${f.name}`}
                        @click=${(e: Event) => {
                          e.preventDefault();
                          const rest = files.filter((_, j) => j !== i);
                          handle.set(this.multiple ? rest : null);
                          handle.markAsDirty();
                        }}
                      >
                        ✕
                      </button>
                    </li>`,
                  )}
                </ul>`}
          </div>
        </div>
      </div>
    `;
  }
}

// ─── Registration ────────────────────────────────────────────────────────────

const CATALOG: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  ["mdy-text-field", MdyTextFieldElement],
  ["mdy-textarea-field", MdyTextareaFieldElement],
  ["mdy-number-field", MdyNumberFieldElement],
  ["mdy-checkbox-field", MdyCheckboxFieldElement],
  ["mdy-toggle-field", MdyToggleFieldElement],
  ["mdy-radio-group-field", MdyRadioGroupFieldElement],
  ["mdy-segmented-field", MdySegmentedFieldElement],
  ["mdy-select-field", MdySelectFieldElement],
  ["mdy-multiselect-field", MdyMultiselectFieldElement],
  ["mdy-slider-field", MdySliderFieldElement],
  ["mdy-datepicker-field", MdyDatepickerFieldElement],
  ["mdy-daterange-field", MdyDaterangeFieldElement],
  ["mdy-timepicker-field", MdyTimepickerFieldElement],
  ["mdy-colors-field", MdyColorsFieldElement],
  ["mdy-file-field", MdyFileFieldElement],
];

/** Registers the whole control catalog (idempotent). */
export function defineMdyElements(): void {
  for (const [tag, ctor] of CATALOG) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
}

/** Registers `<mdy-text-field>` only (idempotent). */
export function defineMdyTextField(): void {
  if (!customElements.get("mdy-text-field")) {
    customElements.define("mdy-text-field", MdyTextFieldElement);
  }
}
