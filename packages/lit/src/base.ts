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
    inlineErrors: { type: Boolean, attribute: "inline-errors" },
    floatingLabel: { type: Boolean, attribute: "floating-label" },
  };

  declare field: MdyFieldHandle<T> | undefined;
  declare label: string;
  declare inlineErrors: boolean;
  declare floatingLabel: boolean;

  protected readonly fieldId = `mdy-field-${nextId++}`;
  private _tracker: MdyFormController | null = null;

  /** Renderer modifier class, e.g. `mdy-renderer--text`. */
  protected abstract readonly rendererClass: string;

  constructor() {
    super();
    this.label = "";
    this.inlineErrors = false;
    this.floatingLabel = false;
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

  /** Error text joined for inline display. */
  protected inlineErrorText(handle: MdyFieldHandle<T>): string {
    return handle.errors()
      .map((e) => e.message)
      .filter((msg) => !!msg && msg.trim() !== "")
      .join(", ");
  }

  /** Inline error icon + tooltip rendered inside the label. */
  protected renderInlineErrorIcon(handle: MdyFieldHandle<T>): unknown {
    const text = this.inlineErrorText(handle);
    return html`<span
      class="mdy-control__inline-errors"
      role="img"
      aria-label=${text}
    >
      ${mdyIcon("ERROR", "mdy-control__inline-errors-icon")}
      <span class="mdy-control__inline-errors-tooltip">${text}</span>
    </span>`;
  }

  /** Shared label block, matching the Angular control-label component. */
  protected renderLabel(handle: MdyFieldHandle<T>, forId = this.fieldId): unknown {
    const filled = this.isFilled(handle);
    const hasError = this.showErrors(handle);
    return html`<label
      class="mdy-label ${filled ? "mdy-label--filled" : ""} ${hasError ? "mdy-label--has-error" : ""}"
      for=${forId}
    >
      ${this.label}
      ${handle.required()
        ? html`<span
          class="mdy-label__required ${filled ? "mdy-label__required--filled" : ""}"
          aria-hidden="true"
        >*</span>`
        : nothing}
      ${this.inlineErrors && hasError ? this.renderInlineErrorIcon(handle) : nothing}
    </label>`;
  }

  /** Helper text slot rendered when no block errors are shown. */
  protected renderSupportingText(): unknown {
    return html`<div class="mdy-supporting-text"><slot name="supporting-text"></slot></div>`;
  }

  /** Error list block (rendered only once the field was touched). */
  protected renderErrors(handle: MdyFieldHandle<T>): unknown {
    if (!this.showErrors(handle)) return nothing;
    return html`<ul
      class="mdy-control__errors"
      id=${this.errorsId}
      role="alert"
      aria-live="polite"
    >
      ${handle.errors().map(
        (er) => html`<li class="mdy-control__error">${er.message}</li>`,
      )}
    </ul>`;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    this.classList.toggle("mdy-floating-label", this.floatingLabel);
    this.classList.toggle("mdy-inline-errors", this.inlineErrors);
    const control = this.renderControl(handle);
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    return html`
      ${this.renderLabel(handle)}
      ${this.useWrapper
        ? html`<div
          class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}"
        >
          <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
          ${control}
          <div class="mdy-input-suffix"><slot name="suffix"></slot></div>
        </div>`
        : control}
      ${showBlockErrors
        ? this.renderErrors(handle)
        : this.renderSupportingText()}
    `;
  }
}
