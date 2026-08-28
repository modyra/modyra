import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { capabilityOf,
  createLightDismiss,
  listboxNextIndex,
  overlayLifecycleTransition,
  shownErrorsOf,
} from "@modyra/widgets";
import { mdyIcon } from "../base.js";
import { MdyOptionsFieldElement } from "./options-field.js";
import { outsideDismissDeclared } from "../widget-runtime/overlay-host.js";

// ─── Dropdown select / multiselect ───────────────────────────────────────────

export abstract class MdyDropdownFieldElement<T> extends MdyOptionsFieldElement<T> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    _open: { state: true },
    _activeIndex: { state: true },
  };
  declare placeholder: string;
  declare _open: boolean;
  declare _activeIndex: number;

  constructor() {
    super();
    this.placeholder = "";
    this._open = false;
    this._activeIndex = -1;
  }

  protected abstract isSelected(handle: MdyFieldHandle<T>, value: unknown): boolean;
  protected abstract pick(handle: MdyFieldHandle<T>, value: unknown): void;
  protected abstract triggerText(handle: MdyFieldHandle<T>): string;
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style -- subclasses override this accessor (multiselect returns true)
  protected get multiselectable(): boolean {
    return false;
  }

  /** Opening and closing is one policy for every adapter: `overlayLifecycleTransition`. */
  private applyLifecycle(
    _handle: MdyFieldHandle<T>,
    intent: Parameters<typeof overlayLifecycleTransition>[1],
  ): void {
    const transition = overlayLifecycleTransition({ open: this._open }, intent);
    if (transition.state.open === this._open) return;
    this._open = transition.state.open;
    if (transition.state.open) this.onOpened();
  }

  /**
   * What a subclass does once the list is showing.
   *
   * Nothing by default: a list that opens is enough for a chooser whose keys the trigger answers.
   */
  protected onOpened(): void {}

  protected toggleOpen(handle: MdyFieldHandle<T>): void {
    this.applyLifecycle(handle, { type: "toggle", disabled: handle.disabled(), available: true });
  }

  protected close(handle: MdyFieldHandle<T>): void {
    this.applyLifecycle(handle, { type: "close" });
  }

  /**
   * An interaction completing outside the element dismisses it —
   * `capabilities.dismissOnOutsidePointer`, whose rule `createLightDismiss` holds, so this is not a
   * second choice made here.
   */
  private readonly dismissal = createLightDismiss({
    isOpen: () => this._open,
    branch: () => ({ root: this }),
    dismiss: () => {
      const handle = this.field;
      if (!handle) return;
      // The policy decides whether this interaction dismisses; the closing itself goes through
      // `close()`, which a subclass overrides to close its controller too. Flipping `_open` here
      // directly leaves the select's controller open, and the next update reads the flag back
      // from it.
      const transition = overlayLifecycleTransition({ open: this._open }, { type: "outside", outside: true });
      if (transition.effect === "teardown") this.close(handle);
    },
  });

  /**
   * Focus leaving the element closes it — `capabilities.dismissOnFocusOutside`.
   *
   * `relatedTarget` containment rather than a timer: a delay is a guess about how long a click takes
   * to land, and it races whatever the pointer does meanwhile. It also never outranks a pointer — a
   * drag begun inside the popup moves focus out on the way, and closing there would reinstate the
   * dismissal `dismissOnOutsidePointer` refuses.
   */
  protected onFocusOut(event: FocusEvent, handle: MdyFieldHandle<T>): void {
    const next = event.relatedTarget as Node | null;
    if (next !== null && typeof next === "object"
      && typeof (next as { nodeType?: unknown }).nodeType === "number" && this.contains(next)) return;
    if (!capabilityOf("select", "dismissOnFocusOutside")) return;
    if (this.dismissal.interactionFromInside()) {
      handle.markAsTouched();
      return;
    }
    this.close(handle);
  }

  private readonly onOutsideDown = (event: Event): void => {
    const e = event as PointerEvent;
    this.dismissal.pointerdown(e.target, { pointerId: e.pointerId ?? 0, isPrimary: e.isPrimary ?? true, button: e.button ?? 0 });
  };
  private readonly onOutsideUp = (event: Event): void => {
    const e = event as PointerEvent;
    this.dismissal.pointerup(e.target, e.pointerId ?? undefined);
  };
  private readonly onOutsideClick = (event: Event): void => this.dismissal.click(event.target);
  private readonly onOutsideCancel = (event: Event): void =>
    this.dismissal.pointercancel((event as PointerEvent).pointerId ?? 0);
  private readonly onOutsideAbandon = (): void => this.dismissal.reset();

  override connectedCallback(): void {
    super.connectedCallback();
    if (!outsideDismissDeclared()) return;
    document.addEventListener("pointerdown", this.onOutsideDown, true);
    document.addEventListener("pointerup", this.onOutsideUp, true);
    document.addEventListener("click", this.onOutsideClick, true);
    document.addEventListener("pointercancel", this.onOutsideCancel, true);
    window.addEventListener("blur", this.onOutsideAbandon);
    document.addEventListener("visibilitychange", this.onOutsideAbandon);
  }

  override disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.onOutsideDown, true);
    document.removeEventListener("pointerup", this.onOutsideUp, true);
    document.removeEventListener("click", this.onOutsideClick, true);
    document.removeEventListener("pointercancel", this.onOutsideCancel, true);
    window.removeEventListener("blur", this.onOutsideAbandon);
    document.removeEventListener("visibilitychange", this.onOutsideAbandon);
    this.dismissal.reset();
    super.disconnectedCallback();
  }

  protected onKeydown(e: KeyboardEvent, handle: MdyFieldHandle<T>): void {
    if (!this._open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.applyLifecycle(handle, { type: "open", disabled: handle.disabled(), available: true });
      }
      return;
    }
    // Navigation is a pure decision the contract owns — a listbox clamps, it does not wrap.
    const next = listboxNextIndex(e.key, this._activeIndex, this.listOptions.length);
    if (next !== null) {
      e.preventDefault();
      this._activeIndex = next;
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = this.listOptions[this._activeIndex];
      if (option) this.pick(handle, option.value);
      if (!this.multiselectable) this.close(handle);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.applyLifecycle(handle, { type: "escape" });
    }
  }

  protected override renderControl(_handle: MdyFieldHandle<T>): unknown {
    return nothing;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);
    const text = this.triggerText(handle);
    return html`
      <label class="mdy-label" id=${this.labelId} for=${this.fieldId}>
        ${this.label}
        ${handle.required()
          ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
          : nothing}
      </label>
      <div class="${this.wrapperClass(handle)}">
        <button
          type="button"
          class="mdy-select__trigger"
          id=${this.fieldId}
          aria-haspopup=${this.popupPromise}
          aria-expanded=${this._open ? "true" : "false"}
          aria-labelledby=${this.labelId}
          aria-invalid=${shownErrorsOf(handle).length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          ?disabled=${handle.disabled()}
          @click=${() => this.toggleOpen(handle)}
          @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          @focusout=${(e: FocusEvent) => this.onFocusOut(e, handle)}
        >
          ${text
            ? html`<span class="mdy-select__value">${text}</span>`
            : html`<span class="mdy-select__placeholder">${this.placeholder}</span>`}
          ${mdyIcon("CHEVRON_DOWN", "mdy-select__arrow")}
        </button>
        ${this._open
          ? html`<div class="${this.partClass("popup")} mdy-overlay">
              <ul
                class="mdy-select__list"
                role="listbox"
                aria-multiselectable=${this.multiselectable ? "true" : nothing}
              >
                ${this.listOptions.map((option, index) => {
                  const selected = this.isSelected(handle, option.value);
                  const classes = [
                    "mdy-select__option",
                    selected ? "mdy-select__option--selected" : "",
                    index === this._activeIndex ? "mdy-select__option--active" : "",
                  ].join(" ");
                  return html`<li
                    class=${classes}
                    role="option"
                    aria-selected=${selected ? "true" : "false"}
                    @pointerdown=${(e: Event) => e.preventDefault()}
                    @click=${() => {
                      this.pick(handle, option.value);
                      if (!this.multiselectable) this.close(handle);
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
