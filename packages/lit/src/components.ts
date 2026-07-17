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
  formatTimeAs,
  listboxNextIndex,
  MdyDateRange,
  MdyFieldHandle,
  MdySelectOption,
  parse24Time,
  parseIsoDate,
  parseLocalizedDate,
  parseTime,
} from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "./base.js";

/** Visually hidden native input used as the platform picker behind a styled control. */
const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";

function toIso(date: { year: number; month: number; day: number }): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

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
 * Styled text input (typed dates parsed in the page locale or as ISO) plus
 * a calendar toggle that opens the platform date picker.
 */
export class MdyDatepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    min: { type: String },
    max: { type: String },
    placeholder: { type: String },
  };
  declare min?: string;
  declare max?: string;
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--datepicker";

  constructor() {
    super();
    this.placeholder = "";
  }

  private parse(raw: string): string | null {
    if (!raw) return null;
    const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
    const parsed = parseLocalizedDate(raw, locale) ?? parseIsoDate(raw);
    return parsed ? toIso(parsed) : null;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <input
        id=${this.fieldId}
        type="text"
        class="mdy-datepicker__input"
        placeholder=${this.placeholder}
        .value=${handle.value() ?? ""}
        ?disabled=${handle.disabled()}
        aria-haspopup="dialog"
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
          @click=${() => {
            const native = this.querySelector<HTMLInputElement>("input[type=date]");
            native?.showPicker?.();
          }}
        >
          ${mdyIcon("CALENDAR", "mdy-datepicker__icon")}
        </button>
      </div>
      <input
        type="date"
        tabindex="-1"
        style=${NATIVE_HIDDEN_STYLE}
        min=${this.min ?? nothing}
        max=${this.max ?? nothing}
        .value=${handle.value() ?? ""}
        @change=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).value || null);
          handle.markAsDirty();
          handle.markAsTouched();
        }}
      />
    `;
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
 * `1430`…) plus a clock toggle that opens the platform time picker.
 */
export class MdyTimepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
  };
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--timepicker";

  constructor() {
    super();
    this.placeholder = "";
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <input
        id=${this.fieldId}
        type="text"
        class="mdy-timepicker__input"
        placeholder=${this.placeholder}
        .value=${handle.value() ?? ""}
        ?disabled=${handle.disabled()}
        aria-haspopup="dialog"
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
          @click=${() => {
            const native = this.querySelector<HTMLInputElement>("input[type=time]");
            native?.showPicker?.();
          }}
        >
          ${mdyIcon("CLOCK", "mdy-timepicker__icon")}
        </button>
      </div>
      <input
        type="time"
        tabindex="-1"
        style=${NATIVE_HIDDEN_STYLE}
        .value=${handle.value() ?? ""}
        @change=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).value || null);
          handle.markAsDirty();
          handle.markAsTouched();
        }}
      />
    `;
  }
}

// ─── Color & file ────────────────────────────────────────────────────────────

/**
 * Hex string value model (`#rrggbb`). Preview swatch opening the platform
 * color picker, plus the accessible hex text input — the same closed-state
 * structure the themes style for the Angular renderer.
 */
export class MdyColorsFieldElement extends MdyFieldElement<string | null> {
  protected override readonly rendererClass = "mdy-renderer--colors";

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    const set = (value: string): void => {
      const v = value.trim();
      handle.set(/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : v === "" ? null : handle.value());
      handle.markAsDirty();
    };
    return html`
      <button
        type="button"
        class="mdy-colors__toggle-area"
        ?disabled=${handle.disabled()}
        aria-label=${`${this.label} — open color picker`}
        @click=${() => {
          this.querySelector<HTMLInputElement>("input[type=color]")?.showPicker?.();
        }}
      >
        <div
          class="mdy-colors__preview-swatch"
          style="background-color:${handle.value() ?? "#4361ee"}"
        ></div>
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
        @change=${(e: Event) => set((e.target as HTMLInputElement).value)}
        @blur=${() => handle.markAsTouched()}
      />
    `;
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
