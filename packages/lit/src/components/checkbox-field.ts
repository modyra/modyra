import { mdyPart } from "../mdy-part.js";
import { html, nothing } from "lit";
import { createBooleanFieldController, submitFalsePart, type MdyBooleanFieldController } from "@modyra/widgets";
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

  /** The contract's boolean anatomy: label wraps input + text. */
  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    return html`
      <div class="${this.partClass("inputWrapper")}">
        <input
          id=${this.fieldId}
          class="${this.partClass("control")}"
          type="checkbox"
          role=${this.partRole("control")}
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
        <!-- The label carries the field's state the way every other kind's does: it is drawn here
             rather than through the shared renderLabel, because the control sits inside it, and the classes
             have to come from the same vocabulary either way. -->
        <label
          class="mdy-label ${this.showErrors(handle) ? "mdy-label--has-error" : ""}"
          id="${this.fieldId}__label"
          for=${this.fieldId}
        >
          <span class="${this.partClass("indicator")}" aria-hidden="true"></span>
          ${this.label}
          ${this.label && handle.required()
            ? html`<span class="mdy-label__required" aria-hidden="true">*</span>`
            : nothing}
        </label>
        <!--
          The false half of the value, after the visible control. HTML leaves an unchecked box out of
          the payload altogether, so without this a person who said no and a form that never carried
          the question arrive identical at the other end.

          After, not before: a hidden input ahead of the visible control changes what the most
          obvious selector anybody writes — the first input in the field — actually finds.
        -->
        <input ${mdyPart(submitFalsePart(handle.path, { disabled: handle.disabled(), checked: handle.value() === true }))} />
      </div>
      ${this.renderErrors(handle)}
      ${this.renderSupportingText()}
    `;
  }
}
