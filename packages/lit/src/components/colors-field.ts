import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { NATIVE_HIDDEN_STYLE, POPUP_ANCHOR_STYLE, POPUP_STYLE } from "./popup-styles.js";

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
