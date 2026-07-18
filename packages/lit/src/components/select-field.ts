import { filterOptionsByQuery, type MdyFieldHandle } from "@modyra/core";
import { html, nothing, type PropertyDeclarations, type PropertyValueMap } from "lit";
import { mdyIcon } from "../base.js";
import { MdyLitSelectAdapter } from "../widget-runtime/index.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";

export class MdySelectFieldElement extends MdyDropdownFieldElement<unknown | null> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    loading: { type: Boolean },
  };
  declare searchable: boolean;
  declare loading: boolean;

  protected override readonly rendererClass = "mdy-renderer--select";
  private selectAdapter?: MdyLitSelectAdapter<unknown>;

  constructor() {
    super();
    this.searchable = false;
    this.loading = false;
  }

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
        loading: this.loading,
        onChange: (value) => {
          handle.set(value);
          handle.markAsDirty();
        },
      },
      (part, key) => {
        const view = this.selectAdapter?.view;
        if (!view) return undefined;
        if (part === "trigger") {
          return (
            this.renderRoot.querySelector<HTMLElement>(`#${view.parts.trigger.id}`) ??
            undefined
          );
        }
        if (part === "listbox") {
          return (
            this.renderRoot.querySelector<HTMLElement>(`#${view.parts.listbox.id}`) ??
            undefined
          );
        }
        if (part === "option" && key !== undefined) {
          return (
            this.renderRoot.querySelector<HTMLElement>(`#${view.parts[key].id}`) ??
            undefined
          );
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

  override disconnectedCallback(): void {
    this.selectAdapter?.destroy();
    this.selectAdapter = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);
    const handle = this.field;
    if (!this.selectAdapter || !handle) return;
    this.selectAdapter.setDisabled(handle.disabled());
    this.selectAdapter.setReadonly(false);
    this.selectAdapter.setInvalid(handle.errors().length > 0);
    this.selectAdapter.setLoading(this.loading);
    // Keep the local open flag in sync with the controller before rendering.
    this._open = this.selectAdapter.state.open;
  }

  private optionKey(value: unknown): string {
    return String(value);
  }

  protected override isSelected(handle: MdyFieldHandle<unknown | null>, value: unknown): boolean {
    return handle.value() === value;
  }

  protected override pick(_handle: MdyFieldHandle<unknown | null>, value: unknown): void {
    this.selectAdapter?.dispatch({ type: "select", optionKey: this.optionKey(value) });
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
      default:
        if (
          this.searchable &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          this.selectAdapter?.dispatch({ type: "search", query: e.key });
        }
        break;
    }
  }

  private onSearchInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.selectAdapter?.dispatch({ type: "search", query: value });
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle || !this.selectAdapter) return super.render();
    const state = this.selectAdapter.state;
    const view = this.selectAdapter.view;
    const trigger = view.parts.trigger;
    const listbox = view.parts.listbox;
    const text = this.triggerText(handle);
    const filtered = filterOptionsByQuery(this.options, state.query);
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);

    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);

    return html`
      ${this.renderLabel(handle, trigger.id)}
      <div class="mdy-select">
        <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
          <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
          <button
            type="button"
            class=${trigger.classes.join(" ")}
            id=${trigger.id}
            aria-haspopup=${trigger.attributes["aria-haspopup"]}
            aria-expanded=${trigger.attributes["aria-expanded"] ? "true" : "false"}
            aria-controls=${trigger.attributes["aria-controls"]}
            aria-activedescendant=${trigger.attributes["aria-activedescendant"] ?? nothing}
            aria-disabled=${trigger.attributes["aria-disabled"] ? "true" : nothing}
            aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
            aria-required=${handle.required() ? "true" : "false"}
            aria-label=${this.label || nothing}
            ?disabled=${handle.disabled()}
            @click=${() => this.toggleOpen(handle)}
            @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          >
            ${text
              ? html`<span class="mdy-select__value">${text}</span>`
              : html`<span class="mdy-select__placeholder">${this.placeholder || "\u00A0"}</span>`}
          </button>
          <div class="mdy-input-suffix">
            ${state.loading
              ? mdyIcon("LOADER", "mdy-select__loader")
              : mdyIcon("CHEVRON_DOWN", "mdy-select__arrow")}
            <slot name="suffix"></slot>
          </div>
        </div>
        ${this._open
          ? html`<div class="mdy-select__dropdown mdy-glass-effect">
            ${this.searchable
              ? html`<input
                type="text"
                class="mdy-select__search"
                .value=${state.query}
                @input=${this.onSearchInput}
              />`
              : nothing}
            <ul
              class="mdy-select__list"
              id=${listbox.id}
              role="listbox"
              aria-labelledby=${trigger.id}
            >
              ${filtered.map((option) => {
                const key = this.optionKey(option.value);
                const part = view.parts[key];
                return html`<li
                  class=${part.classes.join(" ")}
                  id=${part.id}
                  role="option"
                  aria-selected=${state.selectedKey === key ? "true" : "false"}
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
      ${showBlockErrors ? this.renderErrors(handle) : this.renderSupportingText()}
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
