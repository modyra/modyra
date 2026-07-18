import {
  filterOptionsByQuery,
  type MdyFieldHandle,
  type MdySelectOption,
} from "@modyra/core";
import { html, nothing, type PropertyDeclarations } from "lit";
import { mdyIcon } from "../base.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";

export class MdyMultiselectFieldElement extends MdyDropdownFieldElement<readonly unknown[]> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    mode: { type: String },
    filterFn: { attribute: false },
    _query: { state: true },
  };
  declare searchable: boolean;
  declare mode: "single" | "multi";
  declare filterFn?: (value: unknown) => boolean;
  declare _query: string;

  protected override readonly rendererClass = "mdy-renderer--multiselect";

  constructor() {
    super();
    this.searchable = false;
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

  private filteredOptions(): ReadonlyArray<MdySelectOption<unknown>> {
    const opts = this.options;
    return this.filterFn ? opts.filter((o) => this.filterFn!(o.value)) : opts;
  }

  private searchResults(
    handle: MdyFieldHandle<readonly unknown[]>,
  ): ReadonlyArray<MdySelectOption<unknown>> {
    let opts = this.filteredOptions();
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
    if (!this._open) handle.markAsTouched();
  }

  protected override close(handle: MdyFieldHandle<readonly unknown[]>): void {
    if (!this._open) return;
    this._open = false;
    handle.markAsTouched();
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
      }
      return;
    }
    if (!this._open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      this._open = true;
    }
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    this.classList.toggle("mdy-renderer--open", this._open);
    this.classList.toggle("mdy-floating-label", this.floatingLabel);
    this.classList.toggle("mdy-inline-errors", this.inlineErrors);

    const triggerId = `${this.fieldId}-trigger`;
    return html`
      ${this.renderLabel(handle, triggerId)}
      <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
        <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
        <div
          class="mdy-multiselect"
          id=${triggerId}
          role="group"
          aria-label=${this.label || nothing}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          aria-describedby=${showBlockErrors ? this.errorsId : nothing}
        >
          ${this.mode === "multi"
            ? this.renderCounterChips(handle)
            : this.renderToggleChips(handle)}
          ${this.searchable
            ? html`<button
                type="button"
                class="mdy-multiselect__search-btn"
                ?disabled=${handle.disabled()}
                @click=${() => this.toggleOpen(handle)}
                aria-label="Search options"
              >
                ${mdyIcon("SEARCH", "mdy-select__search")}
              </button>`
            : nothing}
        </div>
        <div class="mdy-input-suffix"><slot name="suffix"></slot></div>
      </div>
      ${this._open
        ? html`<div class="mdy-select__dropdown mdy-multiselect-overlay__panel">
            <input
              type="text"
              class="mdy-multiselect-overlay__input"
              .value=${this._query}
              @input=${this.onSearchInput}
              placeholder="Search..."
            />
            <div class="mdy-multiselect__options mdy-multiselect-overlay__grid">
              ${this.searchResults(handle).map((option) =>
                this.renderOptionChip(handle, option),
              )}
            </div>
          </div>`
        : nothing}
      ${showBlockErrors ? this.renderErrors(handle) : this.renderSupportingText()}
    `;
  }

  private renderToggleChips(handle: MdyFieldHandle<readonly unknown[]>): unknown {
    const selected = handle.value() ?? [];
    return selected.map(
      (value) => html`<button
        type="button"
        class="mdy-chip mdy-chip--centered mdy-chip--selected"
        ?disabled=${handle.disabled()}
        @click=${() => this.pick(handle, value)}
      >
        ${mdyIcon("CHECKMARK", "mdy-chip__check")}
        <span class="mdy-chip__label">${this.labelFor(value)}</span>
      </button>`,
    );
  }

  private renderCounterChips(handle: MdyFieldHandle<readonly unknown[]>): unknown {
    const counts = this.counts(handle);
    return this.filteredOptions().map(
      (option) => {
        const count = counts.get(String(option.value)) ?? 0;
        return html`<div
          class="mdy-chip mdy-chip--counter ${count > 0 ? "mdy-chip--selected" : ""}"
        >
          <button
            type="button"
            class="mdy-chip__btn"
            ?disabled=${handle.disabled() || count === 0}
            @click=${() => this.decrement(handle, option.value)}
          >
            ${mdyIcon("MINUS", "mdy-chip__btn-icon")}
          </button>
          <span class="mdy-chip__label">${option.label}</span>
          <span class="mdy-chip__count">×${count}</span>
          <button
            type="button"
            class="mdy-chip__btn"
            ?disabled=${handle.disabled()}
            @click=${() => this.increment(handle, option.value)}
          >
            ${mdyIcon("PLUS", "mdy-chip__btn-icon")}
          </button>
        </div>`;
      },
    );
  }

  private renderOptionChip(
    handle: MdyFieldHandle<readonly unknown[]>,
    option: MdySelectOption<unknown>,
  ): unknown {
    if (this.mode === "multi") {
      const count = this.counts(handle).get(String(option.value)) ?? 0;
      return html`<div
        class="mdy-chip mdy-chip--counter ${count > 0 ? "mdy-chip--selected" : ""}"
      >
        <button
          type="button"
          class="mdy-chip__btn"
          ?disabled=${count === 0}
          @click=${() => this.decrement(handle, option.value)}
        >
          ${mdyIcon("MINUS", "mdy-chip__btn-icon")}
        </button>
        <span class="mdy-chip__label">${option.label}</span>
        <span class="mdy-chip__count">×${count}</span>
        <button
          type="button"
          class="mdy-chip__btn"
          @click=${() => this.increment(handle, option.value)}
        >
          ${mdyIcon("PLUS", "mdy-chip__btn-icon")}
        </button>
      </div>`;
    }
    const selected = this.isSelected(handle, option.value);
    return html`<button
      type="button"
      class="mdy-chip ${selected ? "mdy-chip--selected" : ""}"
      @click=${() => this.pick(handle, option.value)}
    >
      <span class="mdy-chip__label">${option.label}</span>
    </button>`;
  }
}
