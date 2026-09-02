import { mdyPart } from "../mdy-part.js";
import { html, nothing } from "lit";
import { submitFalsePart, createBooleanFieldController, type MdyBooleanFieldController,
  partClasses,
} from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

/**
 * The class every part and box wears, asked of the contract once. A second copy of a name the
 * catalogue holds is where the two come to disagree without either moving.
 */
const CLASS = {
  requiredMarker: partClasses("toggle", "requiredMarker").join(" "),
} as const;


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
            ? html`<span class="${CLASS.requiredMarker}" aria-hidden="true">*</span>`
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
      ${this.renderSupportingText()}
      ${this.renderErrors(handle)}
    `;
  }
}
