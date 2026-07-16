/**
 * The Modyra control catalog for Lit — one element per field kind, all
 * bound to typed field handles and styled by the shipped theme CSS.
 *
 * Value models match the engine's conventions: dates are ISO
 * `yyyy-MM-dd` strings, times are `HH:mm`, colors are hex strings, files
 * are `File | File[] | null`. Composite pickers use the platform-native
 * inputs; keyboard-navigated custom overlays can replace them without
 * touching the field contract.
 */
import { html, nothing, PropertyDeclarations } from "lit";
import { MdyDateRange, MdyFieldHandle, MdySelectOption } from "@modyra/core";
import { MdyFieldElement } from "./base.js";

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
  static override properties: PropertyDeclarations = { rows: { type: Number }, placeholder: { type: String } };
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

  protected override renderControl(handle: MdyFieldHandle<boolean>): unknown {
    return html`<input
      id=${this.fieldId}
      type="checkbox"
      class="mdy-checkbox"
      .checked=${handle.value() === true}
      ?disabled=${handle.disabled()}
      aria-required=${handle.required() ? "true" : "false"}
      @change=${(e: Event) => {
        handle.set((e.target as HTMLInputElement).checked);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
    />`;
  }
}

export class MdyToggleFieldElement extends MdyFieldElement<boolean> {
  protected override readonly rendererClass = "mdy-renderer--toggle";

  protected override renderControl(handle: MdyFieldHandle<boolean>): unknown {
    return html`<input
      id=${this.fieldId}
      type="checkbox"
      class="mdy-toggle"
      role="switch"
      .checked=${handle.value() === true}
      ?disabled=${handle.disabled()}
      aria-checked=${handle.value() === true ? "true" : "false"}
      @change=${(e: Event) => {
        handle.set((e.target as HTMLInputElement).checked);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
    />`;
  }
}

// ─── Option-based ────────────────────────────────────────────────────────────

abstract class MdyOptionsFieldElement<T> extends MdyFieldElement<T> {
  static override properties: PropertyDeclarations = { options: { attribute: false } };
  declare options: ReadonlyArray<MdySelectOption<unknown>>;

  constructor() {
    super();
    this.options = [];
  }
}

export class MdyRadioGroupFieldElement extends MdyOptionsFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--radio-group";
  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<unknown | null>): unknown {
    return html`<div class="mdy-radio-group" role="radiogroup" aria-required=${handle.required() ? "true" : "false"}>
      ${this.options.map(
        (option, index) => html`<label class="mdy-radio-item">
          <input
            type="radio"
            class="mdy-radio-circle"
            name=${this.fieldId}
            id=${index === 0 ? this.fieldId : nothing}
            .checked=${handle.value() === option.value}
            ?disabled=${handle.disabled() || option.disabled === true}
            @change=${() => {
              handle.set(option.value);
              handle.markAsDirty();
              handle.markAsTouched();
            }}
          />
          <span class="mdy-radio-label">${option.label}</span>
        </label>`,
      )}
    </div>`;
  }
}

export class MdySegmentedFieldElement extends MdyOptionsFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--segmented";
  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<unknown | null>): unknown {
    return html`<div class="mdy-segmented" role="radiogroup">
      ${this.options.map(
        (option) => html`<button
          type="button"
          class="mdy-segment ${handle.value() === option.value ? "mdy-segment--selected" : ""}"
          role="radio"
          aria-checked=${handle.value() === option.value ? "true" : "false"}
          ?disabled=${handle.disabled() || option.disabled === true}
          @click=${() => {
            handle.set(option.value);
            handle.markAsDirty();
            handle.markAsTouched();
          }}
        >
          ${option.label}
        </button>`,
      )}
    </div>`;
  }
}

export class MdySelectFieldElement extends MdyOptionsFieldElement<unknown | null> {
  static override properties: PropertyDeclarations = { placeholder: { type: String } };
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--select";

  constructor() {
    super();
    this.placeholder = "";
  }

  protected override renderControl(handle: MdyFieldHandle<unknown | null>): unknown {
    const current = handle.value();
    const selectedIndex = this.options.findIndex((o) => o.value === current);
    return html`<select
      id=${this.fieldId}
      ?disabled=${handle.disabled()}
      aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
      aria-required=${handle.required() ? "true" : "false"}
      @change=${(e: Event) => {
        const index = (e.target as HTMLSelectElement).selectedIndex - 1;
        handle.set(index >= 0 ? (this.options[index]?.value ?? null) : null);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
    >
      <option value="" ?selected=${selectedIndex === -1}>${this.placeholder}</option>
      ${this.options.map(
        (option, index) => html`<option
          ?selected=${index === selectedIndex}
          ?disabled=${option.disabled === true}
        >
          ${option.label}
        </option>`,
      )}
    </select>`;
  }
}

export class MdyMultiselectFieldElement extends MdyOptionsFieldElement<readonly unknown[]> {
  static override properties: PropertyDeclarations = { size: { type: Number } };
  declare size: number;
  protected override readonly rendererClass = "mdy-renderer--multiselect";

  constructor() {
    super();
    this.size = 4;
  }

  protected override renderControl(handle: MdyFieldHandle<readonly unknown[]>): unknown {
    const current = handle.value() ?? [];
    return html`<select
      id=${this.fieldId}
      multiple
      size=${this.size}
      ?disabled=${handle.disabled()}
      aria-required=${handle.required() ? "true" : "false"}
      @change=${(e: Event) => {
        const picked = Array.from((e.target as HTMLSelectElement).selectedOptions)
          .map((o) => this.options[Number(o.dataset["index"])]?.value)
          .filter((v) => v !== undefined);
        handle.set(picked);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
    >
      ${this.options.map(
        (option, index) => html`<option
          data-index=${index}
          ?selected=${current.includes(option.value)}
          ?disabled=${option.disabled === true}
        >
          ${option.label}
        </option>`,
      )}
    </select>`;
  }
}

// ─── Range / slider ──────────────────────────────────────────────────────────

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
    return html`<div class="mdy-slider-container">
      <input
        id=${this.fieldId}
        type="range"
        class="mdy-slider"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(handle.value() ?? this.min)}
        ?disabled=${handle.disabled()}
        @input=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).valueAsNumber);
          handle.markAsDirty();
        }}
        @change=${() => handle.markAsTouched()}
      />
      <output class="mdy-slider-value" for=${this.fieldId}>${handle.value()}</output>
    </div>`;
  }
}

// ─── Date & time ─────────────────────────────────────────────────────────────

/** ISO `yyyy-MM-dd` value model — identical to the engine's convention. */
export class MdyDatepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = { min: { type: String }, max: { type: String } };
  declare min?: string;
  declare max?: string;
  protected override readonly rendererClass = "mdy-renderer--datepicker";

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`<input
      id=${this.fieldId}
      type="date"
      min=${this.min ?? nothing}
      max=${this.max ?? nothing}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
      aria-required=${handle.required() ? "true" : "false"}
      @change=${(e: Event) => {
        handle.set((e.target as HTMLInputElement).value || null);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
    />`;
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
        .value=${range.start ?? ""}
        max=${range.end ?? nothing}
        ?disabled=${handle.disabled()}
        @change=${(e: Event) => patch({ start: (e.target as HTMLInputElement).value || null })}
      />
      <span aria-hidden="true">–</span>
      <input
        type="date"
        .value=${range.end ?? ""}
        min=${range.start ?? nothing}
        ?disabled=${handle.disabled()}
        aria-label=${`${this.label} (end)`}
        @change=${(e: Event) => patch({ end: (e.target as HTMLInputElement).value || null })}
      />
    `;
  }
}

/** `HH:mm` (24h) value model. */
export class MdyTimepickerFieldElement extends MdyFieldElement<string | null> {
  protected override readonly rendererClass = "mdy-renderer--timepicker";

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`<input
      id=${this.fieldId}
      type="time"
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
      aria-required=${handle.required() ? "true" : "false"}
      @change=${(e: Event) => {
        handle.set((e.target as HTMLInputElement).value || null);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
    />`;
  }
}

// ─── Color & file ────────────────────────────────────────────────────────────

/** Hex string value model (`#rrggbb`). */
export class MdyColorsFieldElement extends MdyFieldElement<string | null> {
  protected override readonly rendererClass = "mdy-renderer--colors";

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    const set = (value: string): void => {
      handle.set(value || null);
      handle.markAsDirty();
      handle.markAsTouched();
    };
    return html`
      <input
        id=${this.fieldId}
        type="color"
        .value=${handle.value() ?? "#000000"}
        ?disabled=${handle.disabled()}
        @input=${(e: Event) => set((e.target as HTMLInputElement).value)}
      />
      <input
        type="text"
        class="mdy-color-hex"
        .value=${handle.value() ?? ""}
        placeholder="#000000"
        aria-label=${`${this.label} (hex)`}
        ?disabled=${handle.disabled()}
        @change=${(e: Event) => set((e.target as HTMLInputElement).value)}
      />
    `;
  }
}

export class MdyFileFieldElement extends MdyFieldElement<File | File[] | null> {
  static override properties: PropertyDeclarations = { multiple: { type: Boolean }, accept: { type: String } };
  declare multiple: boolean;
  declare accept: string;
  protected override readonly rendererClass = "mdy-renderer--file";

  constructor() {
    super();
    this.multiple = false;
    this.accept = "";
  }

  protected override renderControl(handle: MdyFieldHandle<File | File[] | null>): unknown {
    const current = handle.value();
    const files = current === null ? [] : Array.isArray(current) ? current : [current];
    return html`
      <input
        id=${this.fieldId}
        type="file"
        class="mdy-file-input"
        ?multiple=${this.multiple}
        accept=${this.accept || nothing}
        ?disabled=${handle.disabled()}
        aria-required=${handle.required() ? "true" : "false"}
        @change=${(e: Event) => {
          const picked = Array.from((e.target as HTMLInputElement).files ?? []);
          handle.set(this.multiple ? picked : (picked[0] ?? null));
          handle.markAsDirty();
          handle.markAsTouched();
        }}
      />
      ${files.length > 0
        ? html`<ul class="mdy-file-list">
            ${files.map((f) => html`<li class="mdy-file-item">${f.name} (${f.size} B)</li>`)}
          </ul>`
        : nothing}
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
