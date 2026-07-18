import { html, nothing, type PropertyDeclarations } from "lit";
import {
  angleToHour,
  angleToMinute,
  buildTimeString,
  formatTime,
  formatTimeAs,
  getCurrentTime,
  getPointerCoords,
  hourToAngle,
  type MdyFieldHandle,
  minuteToAngle,
  parseAnyTime,
  parseTime,
  pointerAngle,
  to24Hour,
  type MdyTimeFormat,
} from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { POPUP_ANCHOR_STYLE, renderOverlayPanel } from "./popup-styles.js";

// ─── Time picker ─────────────────────────────────────────────────────────────

type TimepickerViewMode = "input" | "dial";
type TimeField = "hour" | "minute";

/**
 * Time picker renderer — M3-style input with clock overlay.
 * Supports 12h/24h formats, a dial clock face with drag/click selection,
 * and a keyboard-input mode toggle.
 */
export class MdyTimepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    format: { type: String },
    _open: { state: true },
    _viewMode: { state: true },
    _focusedField: { state: true },
    _draftValue: { state: true },
    _isDragging: { state: true },
    _dragAngle: { state: true },
  };
  declare placeholder: string;
  /** `"12h"` or `"24h"`. */
  declare format: MdyTimeFormat;
  declare _open: boolean;
  declare _viewMode: TimepickerViewMode;
  declare _focusedField: TimeField;
  declare _draftValue: string | null;
  declare _isDragging: boolean;
  declare _dragAngle: number | null;
  protected override readonly rendererClass = "mdy-renderer--timepicker";

  private dragField: TimeField = "hour";
  private switchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.placeholder = "";
    this.format = "12h";
    this._open = false;
    this._viewMode = "input";
    this._focusedField = "hour";
    this._draftValue = null;
    this._isDragging = false;
    this._dragAngle = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    this.teardownDragListeners();
  }

  private get effectivePlaceholder(): string {
    return this.placeholder || (this.format === "24h" ? "HH:mm" : "hh:mm AM/PM");
  }

  private openPopup(handle: MdyTimepickerFieldElement["field"]): void {
    const parsed = parseAnyTime(handle?.value() ?? null, this.format);
    this._draftValue = parsed ? formatTime(parsed) : getCurrentTime();
    this._viewMode = "input";
    this._focusedField = "hour";
    this._open = true;
  }

  private closePopup(handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    this._open = false;
    handle.markAsTouched();
    this.querySelector<HTMLInputElement>(".mdy-timepicker__input")?.focus();
  }

  private confirm(handle: MdyFieldHandle<string | null>): void {
    const draft = parseTime(this._draftValue);
    const next = draft ? formatTimeAs(draft, this.format) : null;
    if (next !== null && next !== handle.value()) {
      handle.set(next);
      handle.markAsDirty();
    }
    this.closePopup(handle);
  }

  private onTimePicked(time: string): void {
    this._draftValue = time;
  }

  private parsed(): import("@modyra/core").ParsedTime | null {
    return parseTime(this._draftValue);
  }

  private numericHour(): number {
    return this.parsed()?.hour ?? 12;
  }

  private numericMinute(): number {
    return this.parsed()?.minute ?? 0;
  }

  private hourDisplay(): string {
    if (this.format === "24h") {
      const p = this.parsed();
      return String(p ? to24Hour(p) : 0).padStart(2, "0");
    }
    return String(this.numericHour()).padStart(2, "0");
  }

  private minuteDisplay(): string {
    return String(this.numericMinute()).padStart(2, "0");
  }

  private periodDisplay(): "AM" | "PM" {
    return this.parsed()?.period ?? "AM";
  }

  private handRotation(): number {
    if (this._isDragging && this._dragAngle !== null) return this._dragAngle;
    const p = this.parsed();
    if (!p) return 0;
    return this._focusedField === "minute" ? minuteToAngle(p.minute) : hourToAngle(p.hour);
  }

  private scheduleMinuteSwitch(delayMs: number): void {
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => {
      this.switchTimer = null;
      this._focusedField = "minute";
    }, delayMs);
  }

  private onHourInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const raw = target.value;
    const h = parseInt(raw, 10);
    const p = this.parsed();

    if (this.format === "24h") {
      if (isNaN(h) || h < 0 || h > 23) {
        target.value = this.hourDisplay();
        return;
      }
      this._focusedField = "hour";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      this.onTimePicked(buildTimeString(hour12, p?.minute ?? 0, h >= 12 ? "PM" : "AM"));
      return;
    }

    if (isNaN(h) || h < 1 || h > 12) {
      target.value = this.hourDisplay();
      return;
    }
    this._focusedField = "hour";
    this.onTimePicked(buildTimeString(h, p?.minute ?? 0, p?.period ?? "AM"));
  }

  private onMinuteInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const raw = target.value;
    const m = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(m) || m < 0 || m > 59) {
      target.value = this.minuteDisplay();
      return;
    }
    this._focusedField = "minute";
    const p = this.parsed();
    this.onTimePicked(buildTimeString(p?.hour ?? 12, m, p?.period ?? "AM"));
  }

  private togglePeriod(period: "AM" | "PM"): void {
    if (this.format !== "12h") return;
    const p = this.parsed();
    this.onTimePicked(buildTimeString(p?.hour ?? 12, p?.minute ?? 0, period));
  }

  private setViewMode(mode: TimepickerViewMode): void {
    this._viewMode = mode;
  }

  // ── Drag interaction ────────────────────────────────────────────────────────

  private readonly handleDocMove = (event: MouseEvent | TouchEvent): void =>
    this.onDragMove(event);
  private readonly handleDocEnd = (): void => this.onDragEnd();

  private setupDragListeners(): void {
    document.addEventListener("mousemove", this.handleDocMove);
    document.addEventListener("touchmove", this.handleDocMove, { passive: false });
    document.addEventListener("mouseup", this.handleDocEnd);
    document.addEventListener("touchend", this.handleDocEnd);
  }

  private teardownDragListeners(): void {
    if (typeof document === "undefined") return;
    document.removeEventListener("mousemove", this.handleDocMove);
    document.removeEventListener("touchmove", this.handleDocMove);
    document.removeEventListener("mouseup", this.handleDocEnd);
    document.removeEventListener("touchend", this.handleDocEnd);
  }

  private onDragStart(event: MouseEvent | TouchEvent): void {
    if (this._viewMode !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.dragField = this._focusedField;
    this._isDragging = true;
    this.setupDragListeners();
    this.updateAngle(event);
  }

  private onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this._isDragging || this._viewMode !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.updateAngle(event);
    const angle = this._dragAngle;
    if (angle === null) return;
    const p = this.parsed();
    let newTime: string;
    if (this.dragField === "minute") {
      newTime = buildTimeString(p?.hour ?? 12, angleToMinute(angle), p?.period ?? "AM");
    } else {
      newTime = buildTimeString(angleToHour(angle), p?.minute ?? 0, p?.period ?? "AM");
    }
    this.onTimePicked(newTime);
  }

  private onDragEnd(): void {
    if (!this._isDragging) return;
    this.teardownDragListeners();
    const angle = this._dragAngle;
    if (angle !== null) {
      const p = this.parsed();
      let finalTime: string;
      if (this.dragField === "minute") {
        finalTime = buildTimeString(p?.hour ?? 12, angleToMinute(angle), p?.period ?? "AM");
      } else {
        finalTime = buildTimeString(angleToHour(angle), p?.minute ?? 0, p?.period ?? "AM");
        this.scheduleMinuteSwitch(300);
      }
      this.onTimePicked(finalTime);
    }
    this._isDragging = false;
    this._dragAngle = null;
  }

  private updateAngle(event: MouseEvent | TouchEvent): void {
    const el = this.querySelector<HTMLElement>(".mdy-timepicker-dial__face");
    if (!el) return;
    const coords = getPointerCoords(event);
    if (!coords) return;
    this._dragAngle = pointerAngle(el.getBoundingClientRect(), coords.clientX, coords.clientY);
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private renderHeader(): unknown {
    const hourActive = this._focusedField === "hour";
    const minuteActive = this._focusedField === "minute";
    return html`
      <div class="mdy-timepicker-header">
        <div class="mdy-timepicker-fields">
          <div class="mdy-timepicker-segment ${hourActive ? "mdy-timepicker-segment--active" : ""}">
            <input
              type="number"
              class="mdy-timepicker-segment-input ${this._viewMode === "dial" ? "mdy-timepicker-segment-input--readonly" : ""}"
              .value=${this.hourDisplay()}
              ?readonly=${this._viewMode === "dial"}
              aria-label="Hour"
              @input=${this.onHourInput}
              @focus=${() => (this._focusedField = "hour")}
              @click=${() => {
                if (this._viewMode === "dial") this._focusedField = "hour";
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
              }}
              @paste=${(e: ClipboardEvent) => {
                const text = e.clipboardData?.getData("text") ?? "";
                if (!/^\d+$/.test(text)) e.preventDefault();
              }}
            />
            <span class="mdy-timepicker-segment-label">Hour</span>
          </div>
          <span class="mdy-timepicker-separator">:</span>
          <div class="mdy-timepicker-segment ${minuteActive ? "mdy-timepicker-segment--active" : ""}">
            <input
              type="number"
              class="mdy-timepicker-segment-input ${this._viewMode === "dial" ? "mdy-timepicker-segment-input--readonly" : ""}"
              .value=${this.minuteDisplay()}
              ?readonly=${this._viewMode === "dial"}
              aria-label="Minute"
              @input=${this.onMinuteInput}
              @focus=${() => (this._focusedField = "minute")}
              @click=${() => {
                if (this._viewMode === "dial") this._focusedField = "minute";
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
              }}
              @paste=${(e: ClipboardEvent) => {
                const text = e.clipboardData?.getData("text") ?? "";
                if (!/^\d+$/.test(text)) e.preventDefault();
              }}
            />
            <span class="mdy-timepicker-segment-label">Minute</span>
          </div>
        </div>
        ${this.format === "12h"
          ? html`
              <div class="mdy-timepicker-period-toggle">
                <button
                  type="button"
                  class="mdy-timepicker-period-btn ${this.periodDisplay() === "AM" ? "mdy-timepicker-period-btn--selected" : ""}"
                  @click=${() => this.togglePeriod("AM")}
                >
                  AM
                </button>
                <button
                  type="button"
                  class="mdy-timepicker-period-btn ${this.periodDisplay() === "PM" ? "mdy-timepicker-period-btn--selected" : ""}"
                  @click=${() => this.togglePeriod("PM")}
                >
                  PM
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderDial(): unknown {
    const isHour = this._focusedField === "hour";
    const numbers = isHour
      ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const selectedIndex = isHour
      ? numbers.indexOf(this.numericHour())
      : numbers.indexOf((Math.round(this.numericMinute() / 5) * 5) % 60);
    return html`
      <div class="mdy-timepicker-dial-variant">
        <div class="mdy-timepicker-dial">
          <div
            class="mdy-timepicker-dial__face"
            @mousedown=${this.onDragStart}
            @touchstart=${this.onDragStart}
          >
            <div
              class="mdy-timepicker-dial__hand"
              style="transform: rotate(${this.handRotation()}deg)"
            ></div>
            ${numbers.map(
              (value, i) => html`
                <div
                  class="mdy-timepicker-dial__number ${i === selectedIndex
                    ? "mdy-timepicker-dial__number--selected"
                    : ""}"
                  style="--index: ${isHour ? value : i === 0 ? 12 : i}"
                >
                  ${String(value).padStart(2, "0")}
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  private renderPopup(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <div
        class="mdy-timepicker-container ${this._viewMode === "dial" ? "mdy-timepicker--dial" : ""}"
        role="dialog"
        aria-label=${this.label || "Choose time"}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            this.closePopup(handle);
          }
        }}
      >
        <div class="mdy-timepicker-content">
          ${this.renderHeader()}
          ${this._viewMode === "dial" ? this.renderDial() : nothing}
        </div>
        <div class="mdy-timepicker-actions">
          <button
            type="button"
            class="mdy-timepicker-mode-toggle"
            aria-label=${this._viewMode === "input" ? "Switch to dial" : "Switch to input"}
            @click=${() => this.setViewMode(this._viewMode === "input" ? "dial" : "input")}
          >
            ${this._viewMode === "input"
              ? html`<svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"
                    fill="currentColor"
                  />
                </svg>`
              : html`<svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 5H5v-2h2v2zm10 0H7v-2h10v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2zm3 6h-2v-2h2v2z"
                    fill="currentColor"
                  />
                </svg>`}
          </button>
          <div class="mdy-timepicker-spacer"></div>
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

  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
      <div class="mdy-timepicker">
        <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
          <input
            id=${this.fieldId}
            type="text"
            class="mdy-timepicker__input"
            placeholder=${this.effectivePlaceholder}
            .value=${handle.value() ?? ""}
            ?disabled=${handle.disabled()}
            aria-haspopup="dialog"
            aria-expanded=${this._open ? "true" : "false"}
            aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
            aria-required=${handle.required() ? "true" : "false"}
            aria-describedby=${this.showErrors(handle) ? this.errorsId : nothing}
            autocomplete="off"
            @change=${(e: Event) => {
              const input = e.target as HTMLInputElement;
              const raw = input.value.trim().toUpperCase();
              if (!raw) {
                handle.set(null);
                handle.markAsDirty();
                return;
              }
              const parsed = parseAnyTime(raw, this.format);
              if (parsed) {
                const formatted = formatTimeAs(parsed, this.format);
                if (handle.value() !== formatted) {
                  handle.set(formatted);
                  handle.markAsDirty();
                }
              }
              input.value = handle.value() ?? "";
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
              tabindex="-1"
              @click=${() => (this._open ? this.closePopup(handle) : this.openPopup(handle))}
            >
              ${mdyIcon("CLOCK", "mdy-timepicker__icon")}
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
    return html`<div style=${POPUP_ANCHOR_STYLE}>${super.render()}</div>`;
  }
}
