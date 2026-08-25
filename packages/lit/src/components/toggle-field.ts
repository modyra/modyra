import { mdyPart } from "../mdy-part.js";
import { html, nothing } from "lit";
import { submitFalsePart, createBooleanFieldController, type MdyBooleanFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

export class MdyToggleFieldElement extends MdyFieldElement<boolean> {
  protected override readonly widgetKind = "toggle" as const;
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

  /** The contract's toggle anatomy: input + track/thumb + label. */
  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    const inputAttrs = this.fieldController?.view().parts.input.attributes;
    return html`
      <div class="${this.partClass("inputWrapper")}">
        <!--
          The false half of the value, ahead of the switch. HTML leaves an unchecked box out of the
          payload altogether, so without this a person who said no and a form that never carried the
          question arrive identical at the other end.
        -->
        <input ${mdyPart(submitFalsePart(handle.path, handle.disabled()))} />
        <input
          id=${this.fieldId}
          class="${this.partClass("control")}"
          type="checkbox"
          role="switch"
          .checked=${handle.value() === true}
          ?disabled=${handle.disabled()}
          aria-checked=${inputAttrs?.["aria-checked"] ?? (handle.value() === true ? "true" : "false")}
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
        <!-- The track is anatomy and renders whether or not the field was given a label. It sits
             inside the label because the native input is hidden and the label forwards a press to
             it: a track outside one draws a switch nothing can operate. -->
        <label class="${this.partClass("label")}" for=${this.fieldId}>
          <span class="${this.partClass("track")}" aria-hidden="true">
            <span class="${this.partClass("thumb")}"></span>
          </span>
          ${this.label ?? nothing}
          ${this.label && handle.required()
            ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
            : nothing}
        </label>
      </div>
      ${this.renderErrors(handle)}
      ${this.renderSupportingText()}
    `;
  }
}
