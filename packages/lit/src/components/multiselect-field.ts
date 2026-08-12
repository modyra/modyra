import { mdyPart } from "../mdy-part.js";
import {
  overlayControlledId,
  shownErrorsOf,
} from "@modyra/widgets";
import { type MdyFieldHandle, type MdyMultiselectMode, type MdySelectOption } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/core/ui";
import { MDY_CHIP_CLASSES, multiselectChipClasses, optionsWithUnrecognizedValues } from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { mdyIcon } from "../base.js";
import {
  MdyLitOverlayController,
  renderOverlayPanel,
} from "./popup-styles.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";

export class MdyMultiselectFieldElement extends MdyDropdownFieldElement<readonly unknown[]> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    loading: { type: Boolean },
    mode: { type: String },
    filterFn: { attribute: false },
    optionTemplate: { attribute: false },
    _query: { state: true },
  };
  declare searchable: boolean;
  declare loading: boolean;
  declare mode: MdyMultiselectMode;
  declare filterFn?: (value: unknown) => boolean;
  declare optionTemplate?: unknown;
  declare _query: string;

  protected override readonly widgetKind = "multiselect" as const;
  private readonly overlay = new MdyLitOverlayController(this);

  constructor() {
    super();
    this.searchable = false;
    this.loading = false;
    this.mode = "single";
    this._query = "";
  }

  protected override get multiselectable(): boolean {
    return true;
  }

  private selectedSet(handle: MdyFieldHandle<readonly unknown[]>): Set<string> {
    return new Set((handle.value() ?? []).map((v) => String(v)));
  }

  private counts(handle: MdyFieldHandle<readonly unknown[]>): Map<string, number> {
    const map = new Map<string, number>();
    for (const v of handle.value() ?? []) {
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

  protected override pick(
    handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
  ): void {
    if (this.mode === "multi") {
      this.increment(handle, value);
      return;
    }
    const current = handle.value() ?? [];
    const key = String(value);
    const next = current.some((v) => String(v) === key)
      ? current.filter((v) => String(v) !== key)
      : [...current, value];
    handle.set(next);
    handle.markAsDirty();
  }

  private increment(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    handle.set([...(handle.value() ?? []), value]);
    handle.markAsDirty();
  }

  private decrement(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    const arr = [...(handle.value() ?? [])];
    const idx = arr.findIndex((v) => String(v) === String(value));
    if (idx >= 0) {
      arr.splice(idx, 1);
      handle.set(arr);
      handle.markAsDirty();
    }
  }

  protected override triggerText(handle: MdyFieldHandle<readonly unknown[]>): string {
    return (handle.value() ?? []).map((v) => this.labelFor(v)).join(", ");
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
    this.querySelector<HTMLElement>(".mdy-multiselect__search-btn")?.focus();
  }

  protected override close(_handle: MdyFieldHandle<readonly unknown[]>): void {
    if (!this._open) return;
    this._open = false;
    this.overlay.close();
  }

  override disconnectedCallback(): void {
    this.overlay.close();
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
      >
      <input
        type="text"
        class="mdy-multiselect-overlay__input"
        .value=${this._query}
        @input=${this.onSearchInput}
        placeholder="Search..."
      />
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
              : html`No results`}
          </div>`
        : this.renderOptionsGrid(handle, this.searchResults(handle), "mdy-multiselect-overlay__grid")}
      </div>
    `;

    return html`
      ${this.renderLabel(handle, triggerId)}
      <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
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
          ${mdyPart(this.controlPart(handle))}
        >
          ${(handle.value() ?? []).length === 0
            ? html`<span class="${this.partClass("placeholder")}">${this.label ? `Select ${this.label.toLowerCase()}…` : "Select…"}</span>`
            : nothing}
          <div class="mdy-multiselect__header">
            <button
              type="button"
              id=${triggerId}
              class="mdy-multiselect__search-btn"
              ?disabled=${handle.disabled()}
              @click=${(e: Event) => {
                if (!this._open) this.overlay.open(e);
                this.toggleOpen(handle);
              }}
              aria-label="Show options"
              aria-haspopup="listbox"
              aria-expanded=${this._open ? "true" : "false"}
              aria-controls=${this._open ? overlayControlledId("multiselect", this.fieldId) ?? nothing : nothing}
              aria-describedby=${this.showErrors(handle) && !this.inlineErrors ? this.errorsId : this.descriptionId}
              aria-invalid=${String(shownErrorsOf(handle).length > 0)}
              aria-disabled=${String(handle.disabled())}
            >
              ${this.loading
        ? mdyIcon("LOADER", "mdy-select__loader")
        : mdyIcon("SEARCH", "")}
            </button>
          </div>
        </div>
        <div class="mdy-input-suffix"><slot name="suffix"></slot></div>
      </div>
      ${this.renderOptionsGrid(handle, this.filteredOptions(handle), "")}
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
