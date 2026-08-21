import {
  MDY_POPUP_OPENERS,
  overlayControlledId,
  shownErrorsOf,
  keyBindingFor,
  chipFocusAfterRemoval,
} from "@modyra/widgets";
import { type MdyFieldHandle, type MdyMultiselectMode, type MdySelectOption } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/widgets";
import {
  createMultiselectFieldController,
  MDY_CHIP_CLASSES,
  multiselectChipClasses,
  optionsWithUnrecognizedValues,
  type MdyMultiselectFieldController,
} from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { mdyIcon } from "../base.js";
import {
  MdyLitOverlayController,
  renderOverlayPanel,
} from "./popup-styles.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";
import { closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";

export class MdyMultiselectFieldElement extends MdyDropdownFieldElement<readonly unknown[]> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    reorderable: { type: Boolean },
    loading: { type: Boolean },
    mode: { type: String },
    filterFn: { attribute: false },
    optionTemplate: { attribute: false },
    _query: { state: true },
  };
  declare searchable: boolean;
  /** Whether a person may rearrange what they chose. Off by default. */
  declare reorderable: boolean;
  declare loading: boolean;
  declare mode: MdyMultiselectMode;
  declare filterFn?: (value: unknown) => boolean;
  declare optionTemplate?: unknown;
  declare _query: string;

  protected override readonly widgetKind = "multiselect" as const;
  private readonly overlay = new MdyLitOverlayController(this);
  private fieldController?: MdyMultiselectFieldController<unknown>;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createMultiselectFieldController<unknown>({
      widgetId: this.fieldId,
      handle: handle as never,
      options: this.options,
      mode: this.mode,
    });
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
    // The option list is a property and can be replaced; the controller is told rather than
    // rebuilt, so the query it is holding survives a list that changes beneath it.
    if (changed.has("options")) this.fieldController?.setOptions(this.options);
  }

  constructor() {
    super();
    this.searchable = false;
    this.reorderable = false;
    this.loading = false;
    this.mode = "single";
    this._query = "";
  }

  protected override get multiselectable(): boolean {
    return true;
  }

  /**
   * What the field holds, as a list.
   *
   * A value that is not one is one value. `patchValue` is public and a draft is data, so a string, a
   * number or an object reaches this element; read with `.map` it threw from inside the render, and
   * an element whose render throws keeps what it was showing with nothing on the page to correct.
   * Held as one value, the form's own shape gate is what objects to it — visibly.
   */
  private held(handle: MdyFieldHandle<readonly unknown[]>): readonly unknown[] {
    const value = handle.value() as unknown;
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  private selectedSet(handle: MdyFieldHandle<readonly unknown[]>): Set<string> {
    return new Set(this.held(handle).map((v) => String(v)));
  }

  private counts(handle: MdyFieldHandle<readonly unknown[]>): Map<string, number> {
    const map = new Map<string, number>();
    for (const v of this.held(handle)) {
      const key = String(v);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  protected override isSelected(
    handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
  ): boolean {
    return this.selectedSet(handle).has(String(value));
  }

  private labelFor(value: unknown): string {
    return this.options.find((o) => o.value === value)?.label ?? String(value);
  }

  /**
   * What this element paints: the declared options, plus every held value they do not contain.
   *
   * A widget does not erase a value to make itself consistent, and what it will not erase it has to
   * show — otherwise the form holds something nobody can see, and nobody can take off.
   */
  private paintedOptions(handle: MdyFieldHandle<readonly unknown[]>): ReadonlyArray<MdySelectOption<unknown>> {
    return optionsWithUnrecognizedValues(this.options, handle.value());
  }

  private filteredOptions(handle: MdyFieldHandle<readonly unknown[]>): ReadonlyArray<MdySelectOption<unknown>> {
    const opts = this.paintedOptions(handle);
    return this.filterFn ? opts.filter((o) => this.filterFn!(o.value)) : opts;
  }

  private searchResults(
    handle: MdyFieldHandle<readonly unknown[]>,
  ): ReadonlyArray<MdySelectOption<unknown>> {
    let opts = this.filteredOptions(handle);
    if (this.mode === "single") {
      const selected = this.selectedSet(handle);
      opts = opts.filter((o) => !selected.has(String(o.value)));
    }
    return filterOptionsByQuery(opts, this._query);
  }

  /**
   * One selection change, decided by the controller for this kind.
   *
   * Toggling, counting and what a readonly field refuses were written here, in a third form that
   * matched neither of the other renderers — which is the divergence a shared contract exists to
   * make impossible rather than to catch afterwards.
   */
  protected override pick(
    _handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
  ): void {
    const optionKey = String(value);
    this.fieldController?.dispatch(
      this.mode === "multi" ? { type: "increment", optionKey } : { type: "toggle", optionKey },
    );
  }

  private increment(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "increment", optionKey: String(value) });
  }

  private decrement(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "decrement", optionKey: String(value) });
  }

  /**
   * Takes a value off and puts focus where the contract says it goes.
   *
   * Left to the browser, focus lands on whatever now occupies that position — the next chip while
   * one exists, and the document at the end of the strip. So removing from the middle looks
   * deliberate and removing the last drops focus off the control entirely.
   */
  private removeAndPlaceFocus(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    const order = [...new Set(this.held(handle).map((v) => String(v)))];
    const next = chipFocusAfterRemoval(order, String(value));
    this.removeValue(handle, value);
    // Twice: the first `updateComplete` can settle for a render that was already scheduled when the
    // value changed, so the strip is still the old one and focus lands on whatever sat at that
    // index before. The second waits for the render the removal caused.
    void this.updateComplete.then(() => this.updateComplete).then(() => {
      const landing = next === null
        ? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`)
        : this.querySelector<HTMLElement>(`[data-key="${next}"] .${MDY_CHIP_CLASSES.remove}`);
      (landing ?? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`))?.focus();
    });
  }

  /** Takes a chosen value off entirely, whatever its count — the chip's own control. */
  private removeValue(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "toggle", optionKey: String(value) });
  }

  protected override triggerText(handle: MdyFieldHandle<readonly unknown[]>): string {
    return this.held(handle).map((v) => this.labelFor(v)).join(", ");
  }

  protected override toggleOpen(handle: MdyFieldHandle<readonly unknown[]>): void {
    if (handle.disabled()) return;
    this._open = !this._open;
    if (this._open) {
      this.overlay.open();
    } else {
      this.overlay.close();
    }
  }

  /**
   * Put focus back on the button that opened the list.
   *
   * Only on keyboard dismissal. Closing because the user clicked somewhere else must leave focus
   * where they clicked, so this is not folded into `close`.
   */
  private restoreFocus(): void {
    this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`)?.focus();
  }

  protected override close(_handle: MdyFieldHandle<readonly unknown[]>): void {
    if (!this._open) return;
    this._open = false;
    this.overlay.close();
  }

  override disconnectedCallback(): void {
    this.overlay.close();
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  private onSearchInput(e: Event): void {
    this._query = (e.target as HTMLInputElement).value;
  }

  protected override onKeydown(
    e: KeyboardEvent,
    handle: MdyFieldHandle<readonly unknown[]>,
  ): void {
    if (e.key === "Escape") {
      if (this._open) {
        e.preventDefault();
        this.close(handle);
        this.restoreFocus();
      }
      return;
    }
    if (!this._open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      this.overlay.open();
      this._open = true;
    }
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);

    const triggerId = `${this.fieldId}-trigger`;
    const position = this.overlay.state.position;
    const alignment = this.overlay.state.alignment;

    // The contract's `popup` part, not bare content: an overlay rendered straight into a
    // `display: contents` panel takes part in layout and shifts the page open.
    const overlay = html`
      <div
        class="${this.popupClass(position)} mdy-overlay"
        id=${overlayControlledId("multiselect", this.fieldId) ?? nothing}
        role=${this.partRole("popup")}
      >
      ${this.searchable
        ? html`<input
            type="text"
            class="mdy-multiselect-overlay__input"
            .value=${this._query}
            @input=${this.onSearchInput}
            placeholder=${this.messages.searchPlaceholder}
          />`
        : nothing}
      ${this.optionTemplate
        ? html`<button type="button" class=${MDY_CHIP_CLASSES.wrapper}>Custom option</button>`
        : nothing}
      ${this.searchResults(handle).length === 0
        ? html`<div class="mdy-multiselect-overlay__empty">
            ${this.loading
              ? html`<div class="mdy-select__loading-content">
                  ${mdyIcon("LOADER", "mdy-select__loader")}
                  <span>Loading…</span>
                </div>`
              : html`${this.messages.noResults}`}
          </div>`
        : this.renderOptionsGrid(handle, this.searchResults(handle), "mdy-multiselect-overlay__grid")}
      </div>
    `;

    return html`
      ${this.renderLabel(handle, triggerId)}
      <div class="${this.wrapperClass(handle)}">
        <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
        <div
          class="mdy-multiselect ${this._open ? "mdy-multiselect--open" : ""}"
          @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          @click=${(e: Event) => {
            // The whole trigger opens the popup, not only the search affordance: every other widget
            // in the catalog opens from its trigger. Clicks that landed on a control inside it —
            // a chip, a step button, the search button — are that control's, not the trigger's.
            const path = e.composedPath();
            const own = path.slice(0, path.indexOf(e.currentTarget as EventTarget));
            if (own.some((node) => (node as Element).localName === "button")) return;
            if (!this._open) this.overlay.open(e);
            this.toggleOpen(handle);
          }}
          role="group"
          aria-label=${this.label || nothing}
          aria-describedby=${this.showErrors(handle) && !this.inlineErrors ? this.errorsId : this.descriptionId}
        >
          <button
            type="button"
            id=${triggerId}
            class="${this.partClass("trigger")}"
            ?disabled=${handle.disabled()}
            @click=${(e: Event) => {
              // On the control itself. The box around it deliberately ignores clicks that land on a
              // button inside it — a chip, a stepper — and the control is a button, so a handler
              // only on the box never heard the one press that matters.
              if (!this._open) this.overlay.open(e);
              this.toggleOpen(handle);
            }}
            aria-label=${this.label || nothing}
            role=${MDY_POPUP_OPENERS.multiselect?.role ?? nothing}
            aria-haspopup=${this.popupPromise}
            aria-expanded=${this._open ? "true" : "false"}
            aria-required=${String(handle.required())}
            aria-readonly=${handle.readonly() ? "true" : nothing}
            aria-controls=${this._open ? overlayControlledId("multiselect", this.fieldId) ?? nothing : nothing}
            aria-describedby=${this.showErrors(handle) && !this.inlineErrors ? this.errorsId : this.descriptionId}
            aria-invalid=${String(shownErrorsOf(handle).length > 0)}
            aria-disabled=${String(handle.disabled())}
          >
            <span class="${this.partClass("chips")}">${this.renderValueChips(handle)}</span>
            ${this.held(handle).length === 0
              ? html`<span class="${this.partClass("placeholder")}">${this.label ? `Select ${this.label.toLowerCase()}…` : "Select…"}</span>`
              : nothing}
            ${this.loading ? mdyIcon("LOADER", "mdy-select__loader") : nothing}
            <span class="${this.partClass("arrow")}" aria-hidden="true"></span>
          </button>
          <!-- Said rather than shown: a choice lands and the strip is the only confirmation, which
               is the one a person using a screen reader does not get. -->
          <div
            class="${this.partClass("announcement")}"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >${this.announcementText(handle)}</div>
        </div>
        <div class="mdy-input-suffix"><slot name="suffix"></slot></div>
      </div>
      ${renderOverlayPanel(overlay, this._open, {
        modal: position === "overlay",
        alignment,
        position,
      })}
      ${showBlockErrors ? this.renderErrors(handle) : nothing}
      ${this.renderSupportingText()}
    `;
  }

  /**
   * A grid of option chips: the one in the field, and the one in the popup.
   *
   * Both carry `mdy-multiselect__options`, so one rule lays out both; the popup's adds the overlay
   * class on top. Each chip sits in the contract's wrapper, which is what the grid arranges.
   */
  /**
   * What was chosen, drawn in the closed control: one chip per distinct value, with how many.
   *
   * A repeated value is a **quantity**, not a duplicate — `increment` takes `["a"]` to
   * `["a","a","a"]` — so the count sits on the chip and the steppers with it. One chip per entry
   * would make undoing one decision three separate removals; a chip with no count answers the same
   * for one of something as for three.
   */
  /**
   * Rearranging what was chosen, from the chip a person is looking at.
   *
   * The keys are the contract's, and so is the direction: the strip runs in the writing direction,
   * so `ArrowLeft` moves a chip *later* in a right-to-left document and a renderer reading the key
   * rather than the binding would have to know that.
   */
  private onChipKeydown(event: KeyboardEvent, handle: MdyFieldHandle<readonly unknown[]>, optionKey: string): void {
    if (!this.reorderable) return;
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this._open);
    if (binding?.intent !== "reorder") return;
    event.preventDefault();
    // The order the value has, not the order the options are in.
    const order = [...new Set(this.held(handle).map((v) => String(v)))];
    this.fieldController?.dispatch({ type: "move-selected", optionKey, to: order.indexOf(optionKey) + (binding.by ?? 1) });
    this.updateComplete.then(() => {
      this.querySelector<HTMLElement>(`.${MDY_CHIP_CLASSES.value}[data-key="${optionKey}"]`)?.focus();
    });
  }

  /** The whole selection, so two announcements differ whenever the selection does. */
  private announcementText(handle: MdyFieldHandle<readonly unknown[]>): string {
    const held = this.held(handle);
    if (held.length === 0) return "";
    const names = [...new Set(held.map((value) => String(value)))].map((key) => this.labelFor(key));
    return `${held.length} selected: ${names.join(", ")}`;
  }

  private renderValueChips(handle: MdyFieldHandle<readonly unknown[]>): unknown {
    const tally = new Map<string, { readonly value: unknown; readonly label: string; count: number }>();
    for (const value of this.held(handle)) {
      const key = String(value);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { value, label: this.labelFor(value), count: 1 });
    }
    return [...tally.values()].map(({ value, label, count }) => html`<span
      class=${multiselectChipClasses({ mode: this.mode, selected: true }).join(" ")}
      tabindex="0"
      role="group"
      @keydown=${(e: KeyboardEvent) => this.onChipKeydown(e, handle, String(value))}
      aria-label=${count > 1 ? `${label}, ${count}` : label}
      title=${label}
      data-key=${String(value)}
    >
      ${this.mode === "multi"
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.step}
            aria-label=${this.messages.chipDecrementLabel}
            @click=${(e: Event) => { e.stopPropagation(); this.decrement(handle, value); }}
          ></button>`
        : nothing}
      <span class=${MDY_CHIP_CLASSES.label}>${label}</span>
      <span class=${MDY_CHIP_CLASSES.count} ?hidden=${count <= 1}>${count > 1 ? String(count) : ""}</span>
      ${this.mode === "multi"
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.step}
            aria-label=${this.messages.chipIncrementLabel}
            @click=${(e: Event) => { e.stopPropagation(); this.increment(handle, value); }}
          ></button>`
        : nothing}
      <button
        type="button"
        class=${MDY_CHIP_CLASSES.remove}
        aria-label=${this.messages.chipRemoveLabel}
        @click=${(e: Event) => { e.stopPropagation(); this.removeAndPlaceFocus(handle, value); }}
      ></button>
    </span>`);
  }

  private renderOptionsGrid(
    handle: MdyFieldHandle<readonly unknown[]>,
    options: ReadonlyArray<MdySelectOption<unknown>>,
    extraClass: string,
  ): unknown {
    return html`<div class="${this.partClass("options")} ${extraClass}" role="group">
      ${options.map(
        (option) => html`<div class=${MDY_CHIP_CLASSES.wrapper}>${this.renderOptionChip(handle, option)}</div>`,
      )}
    </div>`;
  }

  private renderOptionChip(
    handle: MdyFieldHandle<readonly unknown[]>,
    option: MdySelectOption<unknown>,
  ): unknown {
    if (this.mode === "multi") {
      const count = this.counts(handle).get(String(option.value)) ?? 0;
      return html`<div
        class=${multiselectChipClasses({ mode: "multi", selected: count > 0 }).join(" ")}
      >
        <button
          type="button"
          class=${MDY_CHIP_CLASSES.step}
          ?disabled=${count === 0}
          aria-label=${`Decrease ${option.label}`}
          @click=${() => this.decrement(handle, option.value)}
        >
          ${mdyIcon("MINUS", "")}
        </button>
        <span class=${MDY_CHIP_CLASSES.label}>${option.label}</span>
        <span class=${MDY_CHIP_CLASSES.count}>×${count}</span>
        <button
          type="button"
          class=${MDY_CHIP_CLASSES.step}
          aria-label=${`Increase ${option.label}`}
          @click=${() => this.increment(handle, option.value)}
        >
          ${mdyIcon("PLUS", "")}
        </button>
      </div>`;
    }
    const selected = this.isSelected(handle, option.value);
    return html`<button
      type="button"
      class=${multiselectChipClasses({ mode: "single", selected }).join(" ")}
      ?disabled=${handle.disabled()}
      aria-pressed=${selected ? "true" : "false"}
      title=${option.label}
      @click=${() => this.pick(handle, option.value)}
    >
      ${mdyIcon("CHECKMARK", MDY_CHIP_CLASSES.check)}
      <span class=${MDY_CHIP_CLASSES.label}>${option.label}</span>
    </button>`;
  }
}
