import { html, LitElement, nothing } from "lit";
import { MdyFieldHandle } from "@modyra/core";
import { MdyFormController } from "./index.js";

let nextId = 0;

/**
 * `<mdy-text-field>` — Lit text control bound to a Modyra field handle.
 *
 * Renders in light DOM with the same class structure as the Angular
 * renderers (`mdy-renderer`, `mdy-input-wrapper`, `mdy-label`,
 * `mdy-control__errors`), so the shipped themes
 * (`@modyra/angular/styles/*.css` — plain framework-agnostic CSS) apply
 * unchanged. Validation, touched/dirty and aria wiring come from the
 * shared engine:
 *
 * ```ts
 * const form = createLitForm({ email: field("", [required(), email()]) });
 * html`<mdy-text-field label="Email" .field=${form.f.email}></mdy-text-field>`
 * ```
 */
export class MdyTextFieldElement extends LitElement {
  static properties = {
    field: { attribute: false },
    label: { type: String },
    type: { type: String },
    placeholder: { type: String },
  };

  declare field: MdyFieldHandle<string | null> | undefined;
  declare label: string;
  declare type: string;
  declare placeholder: string;

  private readonly _fieldId = `mdy-lit-text-${nextId++}`;
  private _tracker: MdyFormController | null = null;

  constructor() {
    super();
    this.label = "";
    this.type = "text";
    this.placeholder = "";
  }

  /** Light DOM so the global Modyra theme CSS reaches the markup. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("mdy-renderer", "mdy-renderer--text");
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

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const touched = handle.touched();
    const errors = handle.errors();
    const showErrors = touched && errors.length > 0;
    this.classList.toggle("mdy-renderer--touched", touched);
    return html`
      <label class="mdy-label" for=${this._fieldId}>
        ${this.label}
        ${handle.required()
          ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
          : nothing}
      </label>
      <div class="mdy-input-wrapper ${handle.disabled() ? "mdy-input-wrapper--disabled" : ""}">
        <input
          id=${this._fieldId}
          type=${this.type}
          placeholder=${this.placeholder}
          .value=${handle.value() ?? ""}
          ?disabled=${handle.disabled()}
          aria-invalid=${errors.length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          aria-describedby=${showErrors ? `${this._fieldId}-errors` : nothing}
          @input=${(e: Event) => {
            handle.set((e.target as HTMLInputElement).value);
            handle.markAsDirty();
          }}
          @blur=${() => handle.markAsTouched()}
        />
      </div>
      ${showErrors
        ? html`<ul class="mdy-control__errors" id="${this._fieldId}-errors" role="alert">
            ${errors.map((er) => html`<li class="mdy-control__error">${er.message}</li>`)}
          </ul>`
        : nothing}
    `;
  }
}

/** Registers `<mdy-text-field>` (idempotent). */
export function defineMdyTextField(): void {
  if (!customElements.get("mdy-text-field")) {
    customElements.define("mdy-text-field", MdyTextFieldElement);
  }
}
