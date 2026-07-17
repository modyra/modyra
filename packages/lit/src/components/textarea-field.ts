import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { createFieldController, type MdyFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

export class MdyTextareaFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    rows: { type: Number },
    placeholder: { type: String },
  };
  declare rows: number;
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--textarea";
  private fieldController?: MdyFieldController<string | null>;

  constructor() {
    super();
    this.rows = 3;
    this.placeholder = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createFieldController({
      widgetId: this.fieldId,
      handle,
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    const inputAttrs = this.fieldController?.view().parts.input.attributes;
    return html`<textarea
      id=${this.fieldId}
      rows=${this.rows}
      placeholder=${this.placeholder}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      aria-invalid=${inputAttrs?.["aria-invalid"] ?? (handle.errors().length > 0 ? "true" : "false")}
      aria-required=${inputAttrs?.["aria-required"] ?? (handle.required() ? "true" : "false")}
      aria-describedby=${inputAttrs?.["aria-describedby"] ?? (this.showErrors(handle) ? this.errorsId : nothing)}
      @input=${(e: Event) => {
        const value = (e.target as HTMLTextAreaElement).value;
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
    ></textarea>`;
  }
}
