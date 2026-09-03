import { mdyPart } from "../mdy-part.js";
import {
  createColorsFieldController,
  type MdyColorsFieldController, capabilityOf, keyMeans,
  keyBindingFor,
  MDY_COLOR_PRESETS, colorPresetsOf, openPlatformChooser, overlayControlledId, rowRovingIndex,
  partClasses,
  presentationClass,
} from "@modyra/widgets";
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

/**
 * The class every part and box wears, asked of the contract once. A second copy of a name the
 * catalogue holds is where the two come to disagree without either moving.
 */
const CLASS = {
  control: partClasses("colors", "control").join(" "),
  hexInput: partClasses("colors", "hexInput").join(" "),
  nativePicker: partClasses("colors", "nativePicker").join(" "),
  presets: partClasses("colors", "presets").join(" "),
  preview: partClasses("colors", "preview").join(" "),
  swatch: partClasses("colors", "swatch").join(" "),
  toggle: partClasses("colors", "toggle").join(" "),
  arrow: presentationClass("colors", "arrow"),
  box: presentationClass("colors", "box"),
  dropdownHeader: presentationClass("colors", "dropdownHeader"),
} as const;


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

  /**
   * The colour picked by hand, kept while the field lives.
   *
   * A value the presets do not hold came from the chooser or from the hex box, and the panel keeps
   * it so that trying a preset and changing one's mind costs one press rather than the whole chooser
   * again — which is the behaviour a colour picker exists for. Two colours are then on the page, one
   * carrying the selected mark and one merely present, as eleven of twelve already are.
   */
  private _custom: string | null = null;

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    const held = this.field?.value() ?? null;
    if (typeof held === "string" && held !== "" && !this.presets.includes(held)) this._custom = held;
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
  }

  /**
   * What counts as a colour is the contract's rule, not a regular expression written here.
   *
   * The one that was here accepted `#ffff`, `#fffff`, `#ffffffff` and `#12345` — lengths no colour
   * has — and stored them as the value, while refusing `fff` and a value with spaces around it,
   * which the contract accepts and normalises. Five strings where this field disagreed with the same
   * field drawn by another renderer, in both directions.
   */
  private set(handle: MdyFieldHandle<string | null>, value: string): void {
    this.colorsController(handle).dispatch({ type: "text", value });
  }

  private _colors?: MdyColorsFieldController;

  private colorsController(handle: MdyFieldHandle<string | null>): MdyColorsFieldController {
    this._colors ??= createColorsFieldController({
      widgetId: this.fieldId,
      handle: handle as never,
      presets: colorPresetsOf(this.presets).map((entry) => entry.value),
    });
    return this._colors;
  }

  /**
   * Put focus back on the area that opened the palette.
   *
   * Only on keyboard dismissal. Closing because the user clicked somewhere else must leave focus
   * where they clicked, so this is not folded into `close`.
   */
  private restoreFocus(): void {
    // Back to what opened it. The caret beside the square is a drawing and takes no focus, so
    // handing it back there would leave focus on the document body.
    this.querySelector<HTMLElement>(".mdy-colors__primary-picker")?.focus();
  }

  private close(handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    applyOverlayIntent(this, { type: "close" });
    // Told to the controller, which is where closing-without-choosing is recorded as an act on the
    // value. Flipping the element's own flag and stopping there left this kind answering a question
    // the other five answer through the contract. ADR 0167.
    this.colorsController(handle).dispatch({ type: "close", restoreFocus: false });
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
    if (!keyMeans("colors", "Tab", "cancel", true)) return;
    const handle = this.field;
    if (handle) this.close(handle);
  }

  /** Closed when the keyboard moves on, which this kind's contract asks for. */
  protected override focusLeft(): void {
    if (!this._open) return;
    if (!capabilityOf("colors", "dismissOnFocusOutside")) return;
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
  /**
   * `Tab` walks this panel's own stops instead of leaving it.
   *
   * The contract classes this kind with the panels that keep the key, because the popup holds an
   * action of its own — the custom entry — and the arrows stay inside the swatch grid by design. A
   * `Tab` that dismissed left that button reachable with a pointer and with nothing else. ADR 0198.
   *
   * The grid is one stop rather than one per swatch, and the ring wraps: `Escape` is the way out,
   * and it still is.
   */
  private walkPanelStops(event: KeyboardEvent): boolean {
    if (!this._open || event.key !== "Tab") return false;
    if (!keyMeans("colors", event, "move", true)) return false;
    const entry = this.querySelector<HTMLElement>(`.${this.partClass("customEntry")}`);
    if (entry === null) return false;
    event.preventDefault();
    if (document.activeElement === entry) {
      const swatches = Array.from(this.querySelectorAll<HTMLButtonElement>(`.${this.partClass("swatch")}`));
      (swatches.find((swatch) => swatch.tabIndex === 0) ?? swatches[0])?.focus();
    } else {
      entry.focus();
    }
    return true;
  }

  private focusPresets(handle: MdyFieldHandle<string | null>): void {
    void this.updateComplete.then(() => {
      if (!this._open) return;
      // `Array.from` rather than a spread: a `NodeList` is iterable at runtime in every browser
      // this ships to, and typed as iterable only when the `dom.iterable` lib is on. The library
      // compiles under two TypeScript versions, and the older one refused the spread while the
      // newer accepted it — so the normal build passed and only the parity gate saw it.
      const order = Array.from(this.querySelectorAll<HTMLButtonElement>(`.${this.partClass("swatch")}`));
      if (order.length === 0) return;
      if (order.includes(document.activeElement as HTMLButtonElement)) return;
      const held = handle.value();
      (order.find((swatch) => swatch.getAttribute("aria-label") === held) ?? order[0]).focus();
    });
  }

  private moveThroughSwatches(event: KeyboardEvent): void {
    if (!this._open) return;
    const binding = keyBindingFor("colors", event, true);
    if (!binding || binding.intent !== "move") return;
    const order = Array.from(this.querySelectorAll<HTMLButtonElement>(`.${this.partClass("swatch")}`));
    const to = rowRovingIndex(event.key, order.indexOf(document.activeElement as HTMLButtonElement), order.length, binding.by);
    if (to === null) return;
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
          if (keyMeans(this.widgetKind, e, "cancel", true)) {
            e.preventDefault();
            this.close(handle);
            this.restoreFocus();
            return;
          }
          if (this.walkPanelStops(e)) return;
          this.moveThroughSwatches(e);
        }}
      >
        <div class="${CLASS.dropdownHeader}">${this.messages.colorPresetsHeader}</div>
        <div class="${CLASS.presets}" role="listbox" aria-label=${this.messages.colorPresetsHeader}>
          ${colorPresetsOf(this.presets).map(
            ({ value: preset, label }) => html`<button
              type="button"
              class="${CLASS.swatch} ${handle.value() === preset ? "mdy-color-swatch--active" : ""}"
              role="option"
              aria-selected=${handle.value() === preset ? "true" : "false"}
              aria-label=${label}
              style="background-color:${preset}"
              @click=${() => {
                this.set(handle, preset);
                this.close(handle);
              }}
            ></button>`,
          )}
        </div>
        <!-- The door, after the grid and outside it. A button and never a swatch: a set has a total
             and a position within it, so a button among the options would announce "thirteen of
             thirteen" over twelve colours and claim a place a listbox does not admit.

             It is always and only a door: pressing it opens the full chooser in every state, and it
             never takes the selected mark. The tint it shows is not a value — it previews where the
             chooser will open. Which colour the field currently holds is the filled square on the
             field itself, whose only job that is.

             The mark sits beside the tint rather than over it: over the fill it would have to be
             legible on yellow and on navy at once, which no fixed colour is. Outside, it takes the
             panel's foreground, and where a system palette is imposed it obeys that palette while
             the tint keeps its colour, because here the colour is the content. -->
        <button
          type="button"
          class="${this.partClass("customEntry")}"
          @click=${() => openPlatformChooser(this.querySelector<HTMLInputElement>(`.${this.partClass("control")}`))}
        >
          <span
            class="${this.partClass("customTint")}"
            aria-hidden="true"
            style="background-color:${this._custom ?? "transparent"}"
          ></span>
          <span aria-hidden="true">${mdyIcon("PLUS", "")}</span>
          <span>${this.messages.colorCustomEntry}</span>
        </button>
      </div>
    `;
  }

  /**
   * This kind draws its own field box.
   *
   * The base wraps a control in one, and this element renders another inside it — two elements
   * answering to `inputWrapper`, one inside the other, which is the ambiguity ADR 0143 forbids: a
   * selector returns the outer, a measurement may take either, and a reading cannot say which it
   * meant. The kind draws its own affixes too, so nothing is lost by declining the base's.
   */
  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
      <div
        class="${CLASS.box} ${this._open ? "mdy-colors--open" : ""}"
        @keydown=${(e: KeyboardEvent) => {
          // The palette handles Escape inside itself and does not take focus when it opens, so from
          // the control the palette could be opened and not dismissed.
          if (keyMeans(this.widgetKind, e, "cancel", true) && this._open) {
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
              class="${CLASS.nativePicker}"
              ?disabled=${handle.disabled()}
              aria-expanded=${this._open ? "true" : "false"}
              aria-haspopup=${this.popupPromise}
              aria-controls=${overlayControlledId("colors", this.fieldId) ?? nothing}
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
                class="${CLASS.preview}"
                style="background-color:${handle.value() ?? "#4361ee"}"
              ></div>
            </button>
            <!-- Beside the button, not inside it: a control nested in a control is invalid HTML and
                 reachable only by accident — the outer one swallows the press, and what a pointer
                 lands on depends on which browser is asked. -->
            <!-- The contract puts this element in no naming relation: the caption points at the hex
                 input, the swatch points at the popup, and nothing points here. It is the platform's
                 chooser, opened by the swatch beside it, and a person operates that. Named, it puts a
                 second colour control in the tree the contract never described; hidden, it is
                 machinery. Not tabbable, so hiding it strands nobody. -->
            <input
              type="color"
              class="${CLASS.control}"
              ${mdyPart(this.controlPart(handle))}
              aria-hidden="true"
              tabindex="-1"
              style=${NATIVE_HIDDEN_STYLE}
              .value=${handle.value() ?? "#000000"}
              ?disabled=${handle.disabled()}
              @change=${(e: Event) => {
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
              class="${CLASS.hexInput}"
              spellcheck="false"
              .value=${handle.value() ?? ""}
              placeholder="#000000"
              aria-label=${`${this.label} (hex)`}
              ${mdyPart(this.controlPart(handle))}
              ?disabled=${handle.disabled()}
              ?readonly=${handle.readonly()}
              @change=${(e: Event) => this.set(handle, (e.target as HTMLInputElement).value)}
            />
            <!-- A drawing, not a command. The square opens the same panel, and one act with two
                 commands costs two names, two keyboard stops and two things to describe. It is out of
                 the tab order and out of the tree together: removing it from one alone hides it from
                 someone navigating by keyboard and leaves it for someone reading the tree.

                 It still answers a press, because the area sits inside the field and a dead patch in
                 a live control reads as "sometimes it does not work". -->
            <span
              class="${CLASS.toggle} mdy-input-suffix"
              aria-hidden="true"
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
              <span class="${CLASS.arrow} ${this._open ? "mdy-select__arrow--open" : ""}">
                ${mdyIcon("CHEVRON_DOWN", "")}
              </span>
            </span>
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
