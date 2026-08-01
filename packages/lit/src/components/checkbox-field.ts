import { mdyPart } from "../mdy-part.js";
import { html, nothing } from "lit";
import { createBooleanFieldController, type MdyBooleanFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

// ─── Boolean ─────────────────────────────────────────────────────────────────

export class MdyCheckboxFieldElement extends MdyFieldElement<boolean> {
  protected override readonly widgetKind = "checkbox" as const;
  private fieldController?: MdyBooleanFieldController;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createBooleanFieldController({
      widgetId: this.fieldId,
      handle,
      variant: "checkbox",
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(): unknown {
    return nothing;
  }

  /** Same structure as the Angular renderer: label wraps input + text. */
  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    return html`
      <label class="${this.partClass("inputWrapper")}">
        <input
          id=${this.fieldId}
          class="${this.partClass("control")}"
          type="checkbox"
          .checked=${handle.value() === true}
          ?disabled=${handle.disabled()}
          ${mdyPart(this.controlPart(handle))}
          @change=${(e: Event) => {
            if (this.fieldController) {
              this.fieldController.dispatch({ type: "toggle" });
            } else {
              handle.set((e.target as HTMLInputElement).checked);
              handle.markAsDirty();
            }
          }}
          @blur=${() =>
            this.fieldController
              ? this.fieldController.dispatch({ type: "blur" })
              : handle.markAsTouched()}
        />
        <span class="${this.partClass("indicator")}" aria-hidden="true"></span>
        <span class="mdy-label">
          ${this.label}
          ${this.label && handle.required()
            ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
            : nothing}
        </span>
      </label>
      ${this.renderErrors(handle)}
      ${this.renderSupportingText()}
    `;
  }
}
