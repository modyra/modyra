import { html, nothing } from "lit";
import { createBooleanFieldController, type MdyBooleanFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

export class MdyToggleFieldElement extends MdyFieldElement<boolean> {
  protected override readonly rendererClass = "mdy-renderer--toggle";
  private fieldController?: MdyBooleanFieldController;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createBooleanFieldController({
      widgetId: this.fieldId,
      handle,
      variant: "switch",
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

  /** Same structure as the Angular renderer: input + track/thumb + label. */
  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    const inputAttrs = this.fieldController?.view().parts.input.attributes;
    return html`
      <label class="mdy-toggle">
        <input
          id=${this.fieldId}
          type="checkbox"
          role="switch"
          .checked=${handle.value() === true}
          ?disabled=${handle.disabled()}
          aria-checked=${inputAttrs?.["aria-checked"] ?? (handle.value() === true ? "true" : "false")}
          aria-required=${inputAttrs?.["aria-required"] ?? (handle.required() ? "true" : "false")}
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
        <span class="mdy-toggle__track" aria-hidden="true">
          <span class="mdy-toggle__thumb"></span>
        </span>
        ${this.label
          ? html`<span class="mdy-toggle__label">
              ${this.label}
              ${handle.required()
                ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
                : nothing}
            </span>`
          : nothing}
      </label>
      ${this.renderErrors(handle)}
    `;
  }
}
