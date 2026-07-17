import { html, nothing } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { mdyIcon } from "../base.js";
import { MdyLitSelectAdapter } from "../widget-runtime/index.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";

export class MdySelectFieldElement extends MdyDropdownFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--select";
  private selectAdapter?: MdyLitSelectAdapter<unknown>;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.selectAdapter) return;

    this.selectAdapter = new MdyLitSelectAdapter(
      this,
      {
        widgetId: this.fieldId,
        options: this.options,
        value: handle.value(),
        disabled: handle.disabled(),
        readonly: false,
        invalid: handle.errors().length > 0,
        loading: false,
        onChange: (value) => {
          handle.set(value);
          handle.markAsDirty();
        },
      },
      (part, key) => {
        if (part === "trigger") return this.renderRoot.querySelector<HTMLElement>(`#${this.fieldId}`) ?? undefined;
        if (part === "listbox") return this.renderRoot.querySelector<HTMLElement>(`#${this.fieldId}-listbox`) ?? undefined;
        if (part === "option" && key !== undefined) {
          return this.renderRoot.querySelector<HTMLElement>(`#${this.fieldId}-opt-${key}`) ?? undefined;
        }
        return undefined;
      },
    );

    this.selectAdapter.connectHandlers({
      setOpen: (open) => {
        this._open = open;
        if (!open) handle.markAsTouched();
        this.requestUpdate();
      },
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  protected override isSelected(handle: MdyFieldHandle<unknown | null>, value: unknown): boolean {
    return handle.value() === value;
  }

  protected override pick(_handle: MdyFieldHandle<unknown | null>, value: unknown): void {
    this.selectAdapter?.dispatch({ type: "select", optionKey: String(value) });
  }

  protected override triggerText(handle: MdyFieldHandle<unknown | null>): string {
    return this.options.find((o) => o.value === handle.value())?.label ?? "";
  }

  protected override toggleOpen(handle: MdyFieldHandle<unknown | null>): void {
    if (handle.disabled()) return;
    if (this._open) {
      this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
    } else {
      this.selectAdapter?.dispatch({ type: "open", source: "pointer" });
    }
  }

  protected override close(_handle: MdyFieldHandle<unknown | null>): void {
    if (!this._open) return;
    this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
  }

  protected override onKeydown(e: KeyboardEvent, _handle: MdyFieldHandle<unknown | null>): void {
    const moveTarget = mapKeyToMoveTarget(e.key);
    if (moveTarget) {
      e.preventDefault();
      if (!this._open) {
        this.selectAdapter?.dispatch({ type: "open", source: "keyboard" });
      }
      this.selectAdapter?.dispatch({ type: "move", target: moveTarget });
      return;
    }

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (!this._open) {
          this.selectAdapter?.dispatch({ type: "open", source: "keyboard" });
          return;
        }
        if (this.selectAdapter) {
          const key = this.selectAdapter.state.activeKey;
          if (key) this.selectAdapter.dispatch({ type: "select", optionKey: key });
        }
        break;
      case "Escape":
        if (this._open) {
          e.preventDefault();
          this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
        }
        break;
    }
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle || !this.selectAdapter) return super.render();

    const state = this.selectAdapter.state;
    const activeKey = state.activeKey;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    this.classList.toggle("mdy-renderer--open", this._open);
    const text = this.triggerText(handle);

    return html`
      <label class="mdy-label" id=${this.labelId} for=${this.fieldId}>
        ${this.label}
        ${handle.required()
          ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
          : nothing}
      </label>
      <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
        <button
          type="button"
          class="mdy-select__trigger"
          id=${this.fieldId}
          aria-haspopup="listbox"
          aria-expanded=${this._open ? "true" : "false"}
          aria-labelledby=${this.labelId}
          aria-activedescendant=${activeKey ? `${this.fieldId}-opt-${activeKey}` : nothing}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          ?disabled=${handle.disabled()}
          @click=${() => this.toggleOpen(handle)}
          @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          @blur=${() => setTimeout(() => this.close(handle), 120)}
        >
          ${text
            ? html`<span class="mdy-select__value">${text}</span>`
            : html`<span class="mdy-select__placeholder">${this.placeholder}</span>`}
          ${mdyIcon("CHEVRON_DOWN", "mdy-select__arrow")}
        </button>
        ${this._open
          ? html`<div class="mdy-select__dropdown">
              <ul
                class="mdy-select__list"
                id=${`${this.fieldId}-listbox`}
                role="listbox"
              >
                ${this.options.map((option) => {
                  const selected = this.isSelected(handle, option.value);
                  const key = String(option.value);
                  const classes = [
                    "mdy-select__option",
                    selected ? "mdy-select__option--selected" : "",
                    key === activeKey ? "mdy-select__option--active" : "",
                    option.disabled ? "mdy-select__option--disabled" : "",
                  ].join(" ");
                  return html`<li
                    class=${classes}
                    id=${`${this.fieldId}-opt-${key}`}
                    role="option"
                    aria-selected=${selected ? "true" : "false"}
                    aria-disabled=${option.disabled ? "true" : nothing}
                    @pointerdown=${(e: Event) => e.preventDefault()}
                    @click=${() => {
                      if (!option.disabled) this.pick(handle, option.value);
                    }}
                  >
                    <span class="mdy-select__option-label">${option.label}</span>
                  </li>`;
                })}
              </ul>
            </div>`
          : nothing}
      </div>
      ${this.renderErrors(handle)}
    `;
  }
}

function mapKeyToMoveTarget(
  key: string,
): "next" | "previous" | "first" | "last" | null {
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}
