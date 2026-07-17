import { MDY_ICONS, MdyFieldHandle } from "@modyra/core";
import { html, LitElement, nothing, PropertyDeclarations } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { MdyFormController } from "./adapter.js";

/** Renders an icon from the shared library (same SVGs as every adapter). */
export function mdyIcon(name: keyof typeof MDY_ICONS, className: string): unknown {
  const icon = MDY_ICONS[name];
  return html`<svg
    class=${className}
    viewBox=${icon.viewBox}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style="display:inline-flex;flex-shrink:0;width:1.25em;height:1.25em"
  >${unsafeSVG(icon.content)}</svg>`;
}

let nextId = 0;

/**
 * Shared scaffolding for every Modyra Lit control: renders in light DOM
 * with the documented theme class structure (`mdy-renderer`,
 * `mdy-input-wrapper`, `mdy-label`, `mdy-control__errors`), tracks the
 * bound field handle through a `MdyFormController`, and wires label,
 * required marker, error list and the aria attributes.
 *
 * Subclasses implement {@link renderControl} (the widget inside the
 * wrapper) and declare their `rendererClass` modifier.
 */
export abstract class MdyFieldElement<T> extends LitElement {
  static properties: PropertyDeclarations = {
    field: { attribute: false },
    label: { type: String },
  };

  declare field: MdyFieldHandle<T> | undefined;
  declare label: string;

  protected readonly fieldId = `mdy-field-${nextId++}`;
  private _tracker: MdyFormController | null = null;

  /** Renderer modifier class, e.g. `mdy-renderer--text`. */
  protected abstract readonly rendererClass: string;

  constructor() {
    super();
    this.label = "";
  }

  /** Light DOM so the global theme stylesheets reach the markup. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("mdy-renderer", this.rendererClass);
    const handle = this.field;
    if (handle && !this._tracker) {
      this._tracker = new MdyFormController(this, [
        handle.value,
        handle.errors,
        handle.touched,
        handle.required,
        handle.disabled,
      ]);
      this._tracker.hostConnected();
    }
  }

  /** The control widget rendered inside `.mdy-input-wrapper`. */
  protected abstract renderControl(handle: MdyFieldHandle<T>): unknown;

  /** Whether the wrapper div should be rendered (radio groups skip it). */
  protected get useWrapper(): boolean {
    return true;
  }

  protected get errorsId(): string {
    return `${this.fieldId}-errors`;
  }

  protected showErrors(handle: MdyFieldHandle<T>): boolean {
    return handle.touched() && handle.errors().length > 0;
  }

  /** Whether the field currently holds a value (drives label styling). */
  protected isFilled(handle: MdyFieldHandle<T>): boolean {
    const v = handle.value();
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }

  /** Error list block (rendered only once the field was touched). */
  protected renderErrors(handle: MdyFieldHandle<T>): unknown {
    if (!this.showErrors(handle)) return nothing;
    return html`<ul class="mdy-control__errors" id=${this.errorsId} role="alert">
      ${handle.errors().map(
      (er) => html`<li class="mdy-control__error">${er.message}</li>`,
    )}
    </ul>`;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    const control = this.renderControl(handle);
    const filled = this.isFilled(handle);
    return html`
      <label
        class="mdy-label ${filled ? "mdy-label--filled" : ""} ${this.showErrors(handle) ? "mdy-label--has-error" : ""}"
        for=${this.fieldId}
      >
        ${this.label}
        ${handle.required()
        ? html`<span class="mdy-label__required ${filled ? "mdy-label__required--filled" : ""}" aria-hidden="true">*</span>`
        : nothing}
      </label>
      ${this.useWrapper
        ? html`<div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
            ${control}
          </div>`
        : control}
      ${this.renderErrors(handle)}
    `;
  }
}
