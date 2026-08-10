import { type MdyFieldHandle, type MdySelectOption } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/core/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValueMap } from "lit";
import { MdyFieldElement, mdyIcon } from "../base.js";
import { createTypeahead, isTypeaheadCharacter, optionsWithUnrecognizedValue } from "@modyra/widgets";
import { MdyLitSelectAdapter } from "../widget-runtime/index.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";
import {
  MdyLitOverlayController,
  renderOverlayPanel,
} from "./popup-styles.js";

export class MdySelectFieldElement extends MdyDropdownFieldElement<unknown | null> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    loading: { type: Boolean },
    allowCreate: { type: Boolean, attribute: "allow-create" },
  };
  declare searchable: boolean;
  /**
   * The typeahead, held per element rather than per keystroke.
   *
   * A buffer that is rebuilt each key is not a buffer: this is what accumulates `mar` from three
   * events, and what its idle timeout expires when the user stops.
   */
  private readonly typeahead = createTypeahead();
  declare loading: boolean;
  /** When true, searchable selects show a "Create …" row for unknown queries. */
  declare allowCreate: boolean;

  protected override readonly widgetKind = "select" as const;
  private selectAdapter?: MdyLitSelectAdapter<unknown>;
  private readonly overlay = new MdyLitOverlayController(this);

  constructor() {
    super();
    this.searchable = false;
    this.loading = false;
    this.allowCreate = false;
  }

  private showCreateOption(
    query: string,
    filtered: ReadonlyArray<{ label: string }>,
  ): boolean {
    if (!this.allowCreate || !this.searchable) return false;
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return !filtered.some((o) => o.label.trim().toLowerCase() === q);
  }

  private onCreateOption(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    this.dispatchEvent(new CustomEvent("option-created", { detail: trimmed }));
    this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
  }

  /**
   * What this element renders: its options, plus the value the field holds when the list does not
   * contain it. The widget does not erase such a value to make itself consistent, so it has to be
   * visible — a control that looks empty while the form holds something tells the user nothing.
   */
  protected renderedOptions(value: unknown): ReadonlyArray<MdySelectOption<unknown>> {
    return optionsWithUnrecognizedValue(this.options, value);
  }

  protected override get listOptions(): ReadonlyArray<MdySelectOption<unknown>> {
    return this.renderedOptions(this.field?.value());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.selectAdapter) return;

    this.selectAdapter = new MdyLitSelectAdapter(
      this,
      {
        widgetId: this.fieldId,
        options: this.renderedOptions(handle.value()),
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
      (part: string, key: string | undefined) => {
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
        if (open) {
          this.overlay.open();
        } else {
          // Closing is not a validation event: the adapter reports a real touch through
          // `onTouched`, and a user who opened the list and dismissed it decided nothing.
          this.overlay.close();
        }
        this.requestUpdate();
      },
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  override disconnectedCallback(): void {
    this.overlay.close();
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
    return this.renderedOptions(handle.value()).find((o) => o.value === handle.value())?.label ?? "";
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
          this.overlay.open();
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
        // Only the combobox reaches here: a select that does not filter renders the native chooser,
        // which brings the platform's own typeahead and never builds this keyboard path.
        if (!isTypeaheadCharacter(e.key, e)) break;
        // The query is the whole buffer rather than the last key. The controller *replaces* what it
        // is given, so dispatching one character searched for one character and a typeahead could
        // never match a word — typing `mar` searched `m`, then `a`, then `r`.
        this.selectAdapter?.dispatch({ type: "search", query: this.typeahead.push(e.key) });
        break;
    }
  }

  private onSearchInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.selectAdapter?.dispatch({ type: "search", query: value });
  }

  /**
   * The native chooser, for a select that is not searchable.
   *
   * A custom combobox with no search field gives a keyboard user arrows and nothing else: no way to
   * type towards an option, which the authoring practices call typeahead and which a list of fifty
   * options needs. Building an incremental-search buffer is one answer; using the control that
   * already has one — along with the platform's keyboard model and the mobile picker — is the other,
   * and it is what the framework adapter with the same choice already does.
   *
   * `searchable` is the switch, and it defaults to false, so this is also the default path.
   */
  protected override renderControl(handle: MdyFieldHandle<unknown | null>): unknown {
    const options = this.renderedOptions(handle.value());
    const selected = options.findIndex((option) => option.value === handle.value());
    return html`<select
      id=${this.fieldId}
      .selectedIndex=${selected}
      ?disabled=${handle.disabled()}
      aria-invalid=${this.showErrors(handle) ? "true" : "false"}
      @change=${(event: Event) => {
        const index = (event.target as HTMLSelectElement).selectedIndex;
        const option = options[index];
        if (!option) return;
        handle.set(option.value);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
      @blur=${() => handle.markAsTouched()}
    >
      ${this.renderedOptions(handle.value()).map((option) => html`<option .value=${String(option.value)}>${option.label}</option>`)}
    </select>`;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle || !this.selectAdapter) return super.render();
    // Not searchable: the base shell wraps `renderControl`, which is the native chooser above. None
    // of the overlay machinery below is reachable in that mode, and none of it should run.
    if (!this.searchable) return MdyFieldElement.prototype.render.call(this);
    // Which description is on screen is this element's decision — it renders one or the other — so
    // it has to tell the projection before reading the trigger back out of it. `aria-describedby`
    // must name an element that exists.
    const blockErrors = !this.inlineErrors && this.showErrors(handle);
    this.selectAdapter.setDescribedBy({
      errorsVisible: blockErrors,
      descriptionVisible: !blockErrors,
    });
    // The same rule for the other reference the trigger carries: this element builds its listbox on
    // open, so while closed there is nothing for `aria-controls` to name.
    this.selectAdapter.setPopupRendered(this._open);
    const state = this.selectAdapter.state;
    const view = this.selectAdapter.view;
    const trigger = view.parts.trigger;
    const listbox = view.parts.listbox;
    const text = this.triggerText(handle);
    const filtered = filterOptionsByQuery(this.renderedOptions(handle.value()), state.query);
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);

    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);

    const position = this.overlay.state.position;
    const alignment = this.overlay.state.alignment;

    const dropdown = html`
      <div
        class="${this.popupClass(position, alignment)} mdy-overlay mdy-glass-effect"
      >
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
          const selected = state.selectedKey === key;
          const active = state.activeKey === key;
          return html`<li
              class="mdy-select__option ${selected ? "mdy-select__option--selected" : ""} ${active
              ? "mdy-select__option--active"
              : ""}"
              id=${part.id}
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
          ${this.showCreateOption(state.query, filtered)
        ? html`<li
                class="mdy-select__option mdy-select__option--create"
                role="option"
                @click=${() => this.onCreateOption(state.query)}
              >
                Create “${state.query.trim()}”
              </li>`
        : nothing}
          ${filtered.length === 0 && !this.showCreateOption(state.query, filtered)
        ? html`<li class="mdy-select__no-results" role="presentation">
                ${state.loading
            ? html`<div class="mdy-select__loading-content">
                      ${mdyIcon("LOADER", "mdy-select__loader")}
                      <span>Loading…</span>
                    </div>`
            : html`No results`}
              </li>`
        : nothing}
        </ul>
      </div>
    `;

    return html`
      ${this.renderLabel(handle, trigger.id)}
      <div class="mdy-select">
        <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
          <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
          <button
            type="button"
            class="mdy-select__trigger ${trigger.classes.slice(1).join(" ")}"
            id=${trigger.id}
            aria-haspopup=${trigger.attributes["aria-haspopup"]}
            aria-expanded=${trigger.attributes["aria-expanded"] === "true" ? "true" : "false"}
            role=${trigger.role ?? nothing}
            aria-controls=${trigger.attributes["aria-controls"]}
            aria-describedby=${trigger.attributes["aria-describedby"] ?? nothing}
            aria-activedescendant=${trigger.attributes["aria-activedescendant"] ?? nothing}
            aria-disabled=${trigger.attributes["aria-disabled"] === "true" ? "true" : nothing}
            aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
            aria-required=${handle.required() ? "true" : "false"}
            aria-label=${this.label || nothing}
            ?disabled=${handle.disabled()}
            @click=${(e: Event) => {
        if (!this._open) this.overlay.open(e);
        this.toggleOpen(handle);
      }}
            @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          >
            ${text
        ? html`<span class="mdy-select__value">${text}</span>`
        : html`<span class="mdy-select__placeholder">${this.placeholder || "\u00A0"}</span>`}
          </button>
          <div class="mdy-input-suffix">
            ${state.loading
        ? mdyIcon("LOADER", "mdy-select__loader")
        : mdyIcon("CHEVRON_DOWN", `mdy-select__arrow ${this._open ? "mdy-select__arrow--open" : ""}`)}
            <slot name="suffix"></slot>
          </div>
        </div>
        ${renderOverlayPanel(dropdown, this._open, {
          modal: position === "overlay",
          alignment,
          position,
          panelDisplayContents: true,
        })}
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
