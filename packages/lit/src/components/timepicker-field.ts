import { html, nothing, type PropertyDeclarations } from "lit";
import { formatTimeAs, type MdyFieldHandle, parse24Time, parseTime } from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { POPUP_ANCHOR_STYLE, POPUP_STYLE } from "./popup-styles.js";

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
