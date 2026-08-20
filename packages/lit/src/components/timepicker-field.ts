import { mdyPart } from "../mdy-part.js";
import { keyBindingFor, overlayControlledId, createPointerDrag, dragPointOf } from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { observerFor, type MdyFieldHandle } from "@modyra/core";
import { angleToHour, angleToMinute, buildTimeString, formatTimeAs, hourToAngle, minuteToAngle, parseAnyTime, parseTime, pointerAngle, to24Hour, type MdyTimeFormat } from "@modyra/core/datetime";
import {
  acceptTimeField,
  createTimepickerFieldController,
  stepTimeField,
  subscribeController,
  timeFieldBounds,
  timepickerDialNumbers,
  timepickerSelectedDialValue,
  type MdyTimepickerFieldController,
  type MdyTimepickerFieldIntent,
  type MdyTimepickerFieldState,
} from "@modyra/widgets";
import { applyWidgetCommands, bindOutsidePointer, closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";
import { MdyFieldElement, mdyIcon } from "../base.js";
import {
  MdyLitOverlayController,
  POPUP_ANCHOR_STYLE,
  renderOverlayPanel,
} from "./popup-styles.js";
// ─── Time picker ─────────────────────────────────────────────────────────────

type TimepickerViewMode = "input" | "dial";
type TimeField = "hour" | "minute";

/**
 * Time picker renderer — M3-style input with clock overlay.
 * Supports 12h/24h formats, a dial clock face with drag/click selection,
 * and a keyboard-input mode toggle.
 */
/** What the component shows before a handle reaches it — a clock on the hour, nothing confirmed. */
const RESTING: MdyTimepickerFieldState = Object.freeze({
  value: null,
  draft: { hour: 12, minute: 0, period: "AM" as const },
  open: false,
  focusedField: "hour",
  viewMode: "dial",
  format: "12h",
  invalid: false,
  disabled: false,
  interactivity: "enabled",
  readonly: false,
  required: false,
  touched: false,
  dirty: false,
  pending: false,
  entryText: null,
  entryUnreadable: false,
  display: "",
});

export class MdyTimepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    format: { type: String },
    compact: { type: Boolean },
    _open: { state: true },
    _isDragging: { state: true },
    _dragAngle: { state: true },
  };
  declare placeholder: string;
  /** `"12h"` or `"24h"`. */
  declare format: MdyTimeFormat;
  /** Compact period-toggle layout. */
  declare compact: boolean;
  declare _open: boolean;
  declare _isDragging: boolean;
  declare _dragAngle: number | null;
  private unbindOutside?: () => void;
  protected override readonly widgetKind = "timepicker" as const;

  private fieldController?: MdyTimepickerFieldController;
  private unsubscribe?: () => void;

  /** What the controller is holding, or the resting shape before a handle exists. */
  private get view(): MdyTimepickerFieldState {
    return this.fieldController?.state() ?? RESTING;
  }

  /** Carries out what the controller asks of the DOM, which is the only half this renderer owns. */
  private send(intent: MdyTimepickerFieldIntent): void {
    const handle = this.field;
    if (!this.fieldController || !handle) return;
    applyWidgetCommands(this, this.fieldController.dispatch(intent), {
      open: () => this.overlay.open(),
      close: () => this.overlay.close(),
      disabled: handle.disabled(),
      control: ".mdy-timepicker__input",
    });
    // Said to the form rather than kept here: an entry this control could not read leaves the form
    // holding nothing while the person looks at text they believe was taken, and a message the
    // element painted on its own escaped every rule the form applies to its errors — it was still
    // announced after the field went out of play, and never marked the control as invalid.
    handle.reportEntry(this.view.entryUnreadable ? this.messages.entryUnreadable : null);
  }

  private dragField: TimeField = "hour";
  private switchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly overlay = new MdyLitOverlayController(
    this,
    // The control, not the whole field: anchoring on the host measures the label and the
    // supporting text too, which opened the popup a row low and a couple of hundred pixels off.
    () => this.querySelector<HTMLElement>(".mdy-input-wrapper") ?? this,
    {
    widthMode: "auto-content",
  });
  constructor() {
    super();
    this.placeholder = "";
    this.format = "12h";
    this.compact = false;
    this._open = false;
    this._isDragging = false;
    this._dragAngle = null;
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (handle && !this.fieldController) {
      this.fieldController = createTimepickerFieldController({
        widgetId: this.fieldId,
        handle,
        format: this.format,
        // The reading is this element's; the judgement is the controller's, so a typed entry means
        // the same thing here as in every other renderer.
        parseEntry: (text) => {
          const parsed = parseAnyTime(text.trim().toUpperCase(), this.format);
          // Canonical, as the dial commits: a time is `HH:mm` wherever it is held, and the notation
          // on screen is this control's own.
          return parsed ? formatTimeAs(parsed, "24h") : null;
        },
      });
      this.unsubscribe = subscribeController(
        this.fieldController as never,
        observerFor(handle),
        () => this.requestUpdate(),
      );
    }
    this.unbindOutside = bindOutsidePointer(this, () => {
      const handle = this.field;
      if (handle) this.closePopup(handle);
    });
  }

  override disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.fieldController = undefined;
    this.unbindOutside?.();
    this.overlay.close();
    super.disconnectedCallback();
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    this.drag.stop();
  }

  private get effectivePlaceholder(): string {
    return this.placeholder || (this.format === "24h" ? "HH:mm" : "hh:mm AM/PM");
  }

  private openPopup(_handle: MdyTimepickerFieldElement["field"], event?: Event): void {
    void event;
    this.send({ type: "open" });
  }

  private closePopup(_handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    this.send({ type: "close", restoreFocus: true });
  }

  /** Confirming is the contract's: this kind's value contract says `confirm`, and it owns the draft. */
  private confirm(_handle: MdyFieldHandle<string | null>): void {
    this.send({ type: "confirm" });
  }

  /**
   * A time chosen on the dial, sent as the parts the controller takes.
   *
   * The dial builds a string because that is what a clock face reads back; the draft it edits is the
   * controller's, and it holds hours, minutes and the period separately so the two never disagree
   * about what "half past" means at noon.
   */
  private onTimePicked(time: string): void {
    const parsed = parseTime(time);
    if (!parsed) return;
    this.send({ type: "set-hour", hour: parsed.hour });
    this.send({ type: "set-minute", minute: parsed.minute });
    if (this.format === "12h") this.send({ type: "set-period", period: parsed.period });
  }

  /** The draft the controller is editing, which is what the dial draws. */
  private parsed(): import("@modyra/core/datetime").ParsedTime | null {
    return this.fieldController?.state().draft ?? null;
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
    return this.view.focusedField === "minute" ? minuteToAngle(p.minute) : hourToAngle(p.hour);
  }

  private scheduleMinuteSwitch(delayMs: number): void {
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => {
      this.switchTimer = null;
      this.send({ type: "focus-field", field: "minute" });
    }, delayMs);
  }

  /**
   * Arrow keys step the segment, wrapping at the range's ends.
   *
   * The bounds come from `timeFieldBounds`, not from literals beside each input — the hour's two
   * variants are easy to keep straight and the minute's 0–59 is the one that gets lost. A step also
   * pulls an out-of-range segment back inside, because stepping is how a user leaves a bad value.
   */
  private stepSegment(event: KeyboardEvent, field: "hour" | "minute"): boolean {
    const delta = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (delta === 0) return false;
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const entry = acceptTimeField(field, this.format, input.value);
    const from = entry.type === "accepted" ? entry.value : timeFieldBounds(field, this.format).min;
    input.value = String(stepTimeField(field, this.format, from, delta));
    input.removeAttribute("aria-invalid");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  /** Mark a segment whose contents are outside the range it advertises. */
  private markSegment(input: HTMLInputElement, field: "hour" | "minute"): void {
    const bounds = timeFieldBounds(field, this.format);
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    // An empty box is being cleared, not asserted.
    const bad = input.value.trim().length > 0
      && acceptTimeField(field, this.format, input.value).type === "rejected";
    if (bad) {
      input.setAttribute("aria-invalid", "true");
      input.title = `${bounds.min}–${bounds.max}`;
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("title");
    }
  }

  private onHourInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.markSegment(target, "hour");
    const raw = target.value;
    const h = parseInt(raw, 10);
    const p = this.parsed();

    if (this.format === "24h") {
      if (isNaN(h) || h < 0 || h > 23) {
        target.value = this.hourDisplay();
        return;
      }
      this.send({ type: "focus-field", field: "hour" });
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      this.onTimePicked(buildTimeString(hour12, p?.minute ?? 0, h >= 12 ? "PM" : "AM"));
      return;
    }

    if (isNaN(h) || h < 1 || h > 12) {
      target.value = this.hourDisplay();
      return;
    }
    this.send({ type: "focus-field", field: "hour" });
    this.onTimePicked(buildTimeString(h, p?.minute ?? 0, p?.period ?? "AM"));
  }

  private onMinuteInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.markSegment(target, "minute");
    const raw = target.value;
    const m = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(m) || m < 0 || m > 59) {
      target.value = this.minuteDisplay();
      return;
    }
    this.send({ type: "focus-field", field: "minute" });
    const p = this.parsed();
    this.onTimePicked(buildTimeString(p?.hour ?? 12, m, p?.period ?? "AM"));
  }

  private togglePeriod(period: "AM" | "PM"): void {
    if (this.format !== "12h") return;
    const p = this.parsed();
    this.onTimePicked(buildTimeString(p?.hour ?? 12, p?.minute ?? 0, period));
  }

  private setViewMode(mode: TimepickerViewMode): void {
    this.send({ type: "set-view-mode", mode });
  }

  // ── Drag interaction ────────────────────────────────────────────────────────

  /**
   * The gesture's plumbing, which is not this renderer's to write.
   *
   * A drag cannot be tracked on the element it starts on — the pointer leaves the dial at once — so
   * it belongs to the document, and every renderer that binds it there binds the same four
   * listeners. What the angle *becomes* stays here.
   */
  private readonly drag = createPointerDrag({
    onMove: (_point: unknown, event: MouseEvent | TouchEvent) => this.onDragMove(event),
    onEnd: () => this.onDragEnd(),
  });

  private onDragStart(event: MouseEvent | TouchEvent): void {
    if (this.view.viewMode !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.dragField = this.view.focusedField;
    this._isDragging = true;
    this.drag.start();
    this.updateAngle(event);
  }

  private onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this._isDragging || this.view.viewMode !== "dial") return;
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
    this.drag.stop();
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
    const coords = dragPointOf(event);
    if (!coords) return;
    this._dragAngle = pointerAngle(el.getBoundingClientRect(), coords.clientX, coords.clientY);
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private renderHeader(): unknown {
    const hourActive = this.view.focusedField === "hour";
    const minuteActive = this.view.focusedField === "minute";
    return html`
      <div class="mdy-timepicker-header">
        <div class="mdy-timepicker-fields">
          <div class="${this.partClass("hour")} ${hourActive ? "mdy-timepicker-segment--active" : ""}">
            <input
              type="number"
              class="mdy-timepicker-segment-input ${this.view.viewMode === "dial" ? "mdy-timepicker-segment-input--readonly" : ""}"
              .value=${this.hourDisplay()}
              ?readonly=${this.view.viewMode === "dial"}
              aria-label=${this.messages.timepickerHourLabel}
              @input=${this.onHourInput}
              @focus=${() => this.send({ type: "focus-field", field: "hour" })}
              @click=${() => {
                if (this.view.viewMode === "dial") this.send({ type: "focus-field", field: "hour" });
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (this.stepSegment(e, "hour")) return;
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
          <div class="${this.partClass("minute")} ${minuteActive ? "mdy-timepicker-segment--active" : ""}">
            <input
              type="number"
              class="mdy-timepicker-segment-input ${this.view.viewMode === "dial" ? "mdy-timepicker-segment-input--readonly" : ""}"
              .value=${this.minuteDisplay()}
              ?readonly=${this.view.viewMode === "dial"}
              aria-label=${this.messages.timepickerMinuteLabel}
              @input=${this.onMinuteInput}
              @focus=${() => this.send({ type: "focus-field", field: "minute" })}
              @click=${() => {
                if (this.view.viewMode === "dial") this.send({ type: "focus-field", field: "minute" });
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (this.stepSegment(e, "minute")) return;
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
              <div
                class="mdy-timepicker-period-toggle ${this.compact
                  ? "mdy-timepicker-period-toggle--compact"
                  : ""}"
              >
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
    const field = this.view.focusedField;
    // Which numbers the face carries, where each one sits and which is selected are the contract's:
    // minute 0 belongs at the top of the face and a draft of 07 marks the 05 nearest it, and those
    // are exactly the details three renderers would each get slightly differently.
    // The face the format has: 1–12 with a period beside them, or 0–23 with none.
    const numbers = timepickerDialNumbers(field, this.format);
    const parsed = this.parsed() ?? { hour: this.numericHour(), minute: this.numericMinute(), period: this.periodDisplay() };
    // In the units the face shows: on a 24-hour face this marks 14, not the 2 the draft holds.
    const selected = timepickerSelectedDialValue(field, parsed, this.format);
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
              (number) => html`
                <div
                  class="mdy-timepicker-dial__number ${number.value === selected
                    ? "mdy-timepicker-dial__number--selected"
                    : ""} ${number.ring === "inner" ? "mdy-timepicker-dial__number--inner" : ""}"
                  style="--index: ${number.index}"
                >
                  ${number.label}
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
        class="mdy-timepicker-container ${this.view.viewMode === "dial" ? "mdy-timepicker--dial" : ""}"
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
          ${this.view.viewMode === "dial" ? this.renderDial() : nothing}
        </div>
        <div class="mdy-timepicker-actions">
          <button
            type="button"
            class="mdy-timepicker-mode-toggle"
            aria-label=${this.view.viewMode === "input" ? "Switch to dial" : "Switch to input"}
            @click=${() => this.setViewMode(this.view.viewMode === "input" ? "dial" : "input")}
          >
            ${this.view.viewMode === "input"
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
      <div
        class="mdy-timepicker"
        @keydown=${(e: KeyboardEvent) => {
          // The popup handles Escape inside itself, but it does not take focus when it opens — so
          // from the control, which is where the keyboard actually is, the picker could be opened
          // and not dismissed.
          if (e.key === "Escape" && this._open) {
            e.preventDefault();
            this.closePopup(handle);
          }
          // And the way in, from the table the contract already publishes rather than from a key
          // written here. The control is this kind's declared opener and the toggle beside it is
          // not a tab stop, so a control that answers no key is a picker no keyboard can open —
          // the value can still be typed, by someone who knows the format the field wants.
          if (!this._open && keyBindingFor("timepicker", e.key, false)?.intent === "open") {
            e.preventDefault();
            this.openPopup(handle, e);
          }
        }}
      >
        <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
          <input
            id=${this.fieldId}
            type="text"
            class="mdy-timepicker__input"
            placeholder=${this.effectivePlaceholder}
            .value=${this.view.display}
            ?disabled=${handle.disabled()}
            ?readonly=${handle.readonly()}
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded=${this._open ? "true" : "false"}
            aria-controls=${this._open ? overlayControlledId("timepicker", this.fieldId) ?? nothing : nothing}
            ${mdyPart(this.controlPart(handle))}
            autocomplete="off"
            @change=${(e: Event) => {
              // The text goes over as text. Parsing here and writing the value back was the erasure:
              // `14:30` in a 12-hour control left nothing on screen to correct.
              this.send({ type: "type", text: (e.target as HTMLInputElement).value });
            }}
            @blur=${() => handle.markAsTouched()}
          />
          <div class="mdy-input-suffix">
            <button
              type="button"
              class="mdy-timepicker__toggle"
              ?disabled=${handle.disabled()}
              aria-label=${this.messages.timepickerOpenLabel}
              aria-expanded=${this._open ? "true" : "false"}
              tabindex="-1"
              @click=${(e: Event) => (this._open ? this.closePopup(handle) : this.openPopup(handle, e))}
            >
              ${mdyIcon("CLOCK", "mdy-timepicker__icon")}
            </button>
          </div>
        </div>
        ${renderOverlayPanel(
          // Wrapped in the contract's `popup` part: every overlay in the catalog is the same
          // container, and only its content differs. Without it these two pickers were the
          // only popups drawn straight into the panel, with a container of their own.
          html`<div
            class="${this.popupClass(this.overlay.state.position)} mdy-overlay"
            id=${overlayControlledId("timepicker", this.fieldId) ?? nothing}
          >${this.renderPopup(handle)}</div>`,
          this._open,
          {
            position: this.overlay.state.position,
          alignment: this.overlay.state.alignment,
          modal: this.overlay.state.position === "overlay",
          panelStyle: this.overlay.state.panelStyle,
        })}
      </div>
    `;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    return html`<div style=${POPUP_ANCHOR_STYLE}>${super.render()}</div>`;
  }
}
