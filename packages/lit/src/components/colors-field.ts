import { mdyPart } from "../mdy-part.js";
import {
  keyBindingFor,
  MDY_COLOR_PRESETS, MDY_WIDGET_CONTRACTS, overlayControlledId } from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { applyOverlayIntent, bindOutsidePointer, closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";
import { MdyFieldElement, mdyIcon } from "../base.js";
import {
  MdyLitOverlayController,
  NATIVE_HIDDEN_STYLE,
  POPUP_ANCHOR_STYLE,
  renderOverlayPanel,
} from "./popup-styles.js";

// ─── Color & file ────────────────────────────────────────────────────────────

/**
 * Hex string value model (`#rrggbb`). Preview swatch opening the platform
 * color picker, plus the accessible hex text input — the same closed-state
 * structure the themes style.
 */
export class MdyColorsFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    presets: { attribute: false },
    _open: { state: true },
  };
  /** Preset swatches shown in the dropdown. */
  declare presets: readonly string[];
  declare _open: boolean;
  private unbindOutside?: () => void;
  protected override readonly widgetKind = "colors" as const;
  private readonly overlay = new MdyLitOverlayController(this);

  constructor() {
    super();
    this.presets = MDY_COLOR_PRESETS;
    this._open = false;
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
  }

  private set(handle: MdyFieldHandle<string | null>, value: string): void {
    const v = value.trim();
    handle.set(/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : v === "" ? null : handle.value());
    handle.markAsDirty();
  }

  /**
   * Put focus back on the area that opened the palette.
   *
   * Only on keyboard dismissal. Closing because the user clicked somewhere else must leave focus
   * where they clicked, so this is not folded into `close`.
   */
  private restoreFocus(): void {
    this.querySelector<HTMLElement>(".mdy-colors__toggle-area")?.focus();
  }

  private close(_handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    applyOverlayIntent(this, { type: "close" });
    this.overlay.close();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.unbindOutside = bindOutsidePointer(this, () => {
      const handle = this.field;
      if (handle) this.close(handle);
    });
  }

  /**
   * Tab out of an open popup closes it, which is what the keyboard table declares for this kind.
   *
   * Not `preventDefault`: Tab is already carrying the keyboard onward and pulling it back would trap
   * a person in the field they just left.
   */
  protected override tabbedAway(): void {
    if (!this._open) return;
    if (keyBindingFor("colors", "Tab", true)?.intent !== "cancel") return;
    const handle = this.field;
    if (handle) this.close(handle);
  }

  /** Closed when the keyboard moves on, which this kind's contract asks for. */
  protected override focusLeft(): void {
    if (!this._open) return;
    if (!MDY_WIDGET_CONTRACTS.colors.capabilities.dismissOnFocusOutside) return;
    const handle = this.field;
    if (handle) this.close(handle);
  }

  override disconnectedCallback(): void {
    this.unbindOutside?.();
    this.overlay.close();
    super.disconnectedCallback();
  }

  /**
   * Walking the swatches, which are a listbox and answer like one.
   *
   * The row is real buttons, so the reading position is the focus itself — one stop that moves with
   * the arrows rather than a Tab per colour. The keys are the catalogue's, and so is the direction:
   * a row runs in the writing direction, and reading `ArrowLeft` as "back" is wrong in a
   * right-to-left document.
   */
  /**
   * Into the row the palette has just shown.
   *
   * The keys the contract declares for an open colour field are the row's, and `Tab` dismisses the
   * palette — so a palette that left the keyboard on the toggle was one no keyboard could reach the
   * presets in. The swatch holding the current value is where a person is; the first one otherwise.
   */
  private focusPresets(handle: MdyFieldHandle<string | null>): void {
    void this.updateComplete.then(() => {
      if (!this._open) return;
      const order = [...this.querySelectorAll<HTMLButtonElement>(`.${this.partClass("swatch")}`)];
      if (order.length === 0) return;
      if (order.includes(document.activeElement as HTMLButtonElement)) return;
      const held = handle.value();
      (order.find((swatch) => swatch.getAttribute("aria-label") === held) ?? order[0]).focus();
    });
  }

  private moveThroughSwatches(event: KeyboardEvent): void {
    if (!this._open) return;
    const binding = keyBindingFor("colors", event.key, true);
    if (!binding || binding.intent !== "move") return;
    const order = [...this.querySelectorAll<HTMLButtonElement>(`.${this.partClass("swatch")}`)];
    if (order.length === 0) return;
    const at = order.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
    const to = event.key === "Home" ? 0
      : event.key === "End" ? order.length - 1
      : at === -1 ? (step === -1 ? order.length - 1 : 0)
      : Math.max(0, Math.min(order.length - 1, at + step));
    event.preventDefault();
    order[to]?.focus();
  }

  private renderDropdown(handle: MdyFieldHandle<string | null>): unknown {
    const position = this.overlay.state.position;
    return html`
      <div
        class="${this.popupClass(position)} mdy-overlay"
        id=${overlayControlledId("colors", this.fieldId) ?? nothing}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            this.close(handle);
            this.restoreFocus();
            return;
          }
          this.moveThroughSwatches(e);
        }}
      >
        <div class="mdy-colors__dropdown-header">${this.messages.colorPresetsHeader}</div>
        <div class="mdy-colors__presets" role="listbox" aria-label=${this.messages.colorPresetsHeader}>
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
          class="mdy-button"
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
      <div
        class="mdy-colors ${this._open ? "mdy-colors--open" : ""}"
        @keydown=${(e: KeyboardEvent) => {
          // The palette handles Escape inside itself and does not take focus when it opens, so from
          // the control the palette could be opened and not dismissed.
          if (e.key === "Escape" && this._open) {
            e.preventDefault();
            this.close(handle);
            this.restoreFocus();
          }
        }}
      >
        <div class="${this.wrapperClass(handle)}">
          <div class="mdy-input-wrapper__inliner">
            <!-- The swatch opens the same overlay the suffix does, so it carries the same reference:
                 an opener that says a popup is showing without naming it leaves a screen reader
                 nowhere to go from it. -->
            <button
              type="button"
              class="mdy-colors__primary-picker"
              ?disabled=${handle.disabled()}
              aria-expanded=${this._open ? "true" : "false"}
              aria-haspopup=${this.popupPromise}
              aria-controls=${overlayControlledId("colors", this.fieldId) ?? nothing}
              aria-label=${this.label || "Color"}
              @click=${(e: Event) => {
                if (this._open) {
                  this.close(handle);
                } else {
                  this.overlay.open(e);
                  applyOverlayIntent(this, { type: "open", disabled: this.field?.disabled() ?? false, available: true });
                  this.focusPresets(handle);
                }
              }}
            >
              <div
                class="mdy-colors__preview-swatch"
                style="background-color:${handle.value() ?? "#4361ee"}"
              ></div>
            </button>
            <!-- Beside the button, not inside it: a control nested in a control is invalid HTML and
                 reachable only by accident — the outer one swallows the press, and what a pointer
                 lands on depends on which browser is asked. -->
            <input
              type="color"
              class="mdy-colors__native-hidden"
              ${mdyPart(this.controlPart(handle))}
              tabindex="-1"
              style=${NATIVE_HIDDEN_STYLE}
              .value=${handle.value() ?? "#000000"}
              ?disabled=${handle.disabled()}
              @input=${(e: Event) => {
                handle.set((e.target as HTMLInputElement).value);
                handle.markAsDirty();
                handle.markAsTouched();
              }}
              @click=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
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
              ${mdyPart(this.controlPart(handle))}
              ?disabled=${handle.disabled()}
              ?readonly=${handle.readonly()}
              @change=${(e: Event) => this.set(handle, (e.target as HTMLInputElement).value)}
              @blur=${() => handle.markAsTouched()}
            />
            <button
              type="button"
              class="mdy-colors__toggle-area mdy-input-suffix"
              ?disabled=${handle.disabled()}
              aria-haspopup=${this.popupPromise}
              aria-expanded=${this._open ? "true" : "false"}
              aria-controls=${overlayControlledId("colors", this.fieldId) ?? nothing}
              aria-label=${`${this.label} — open color presets`}
              @click=${(e: Event) => {
                if (this._open) {
                  this.close(handle);
                } else {
                  this.overlay.open(e);
                  applyOverlayIntent(this, { type: "open", disabled: this.field?.disabled() ?? false, available: true });
                  this.focusPresets(handle);
                }
              }}
            >
              <span class="mdy-select__arrow ${this._open ? "mdy-select__arrow--open" : ""}">
                ${mdyIcon("CHEVRON_DOWN", "")}
              </span>
            </button>
          </div>
        </div>
        ${renderOverlayPanel(this.renderDropdown(handle), this._open, {
          closedId: overlayControlledId("colors", this.fieldId) ?? undefined,
          position: this.overlay.state.position,
          alignment: this.overlay.state.alignment,
          modal: this.overlay.state.position === "overlay",
          panelDisplayContents: true,
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
