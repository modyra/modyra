import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { createFieldController, type MdyFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

export class MdyNumberFieldElement extends MdyFieldElement<number | null> {
  static override properties: PropertyDeclarations = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };
  declare min?: number;
  declare max?: number;
  declare step?: number;
  protected override readonly rendererClass = "mdy-renderer--number";
  private fieldController?: MdyFieldController<number | null>;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createFieldController({
      widgetId: this.fieldId,
      handle,
      inputType: "number",
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(handle: MdyFieldHandle<number | null>): unknown {
    const inputAttrs = this.fieldController?.view().parts.input.attributes;
    return html`<input
      id=${this.fieldId}
      type="number"
      min=${this.min ?? nothing}
      max=${this.max ?? nothing}
      step=${this.step ?? nothing}
      .value=${handle.value() === null ? "" : String(handle.value())}
      ?disabled=${handle.disabled()}
      aria-invalid=${inputAttrs?.["aria-invalid"] ?? (handle.errors().length > 0 ? "true" : "false")}
      aria-required=${inputAttrs?.["aria-required"] ?? (handle.required() ? "true" : "false")}
      aria-describedby=${inputAttrs?.["aria-describedby"] ?? (this.showErrors(handle) ? this.errorsId : nothing)}
      @input=${(e: Event) => {
        const n = (e.target as HTMLInputElement).valueAsNumber;
        const value = Number.isNaN(n) ? null : n;
        if (this.fieldController) {
          this.fieldController.dispatch({ type: "input", value });
        } else {
          handle.set(value);
          handle.markAsDirty();
        }
      }}
      @blur=${() =>
        this.fieldController
          ? this.fieldController.dispatch({ type: "blur" })
          : handle.markAsTouched()}
    />`;
  }
}
