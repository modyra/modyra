import { mdyPart } from "../mdy-part.js";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { createTextFieldController, type MdyTextFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

export class MdyTextareaFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    rows: { type: Number },
    placeholder: { type: String },
  };
  declare rows: number;
  declare placeholder: string;
  protected override readonly widgetKind = "textarea" as const;
  private fieldController?: MdyTextFieldController<string | null>;

  constructor() {
    super();
    this.rows = 3;
    this.placeholder = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createTextFieldController({
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
    return html`<textarea
      id=${this.fieldId}
      rows=${this.rows}
      placeholder=${this.placeholder}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      ?readonly=${handle.readonly()}
      aria-readonly=${handle.readonly() ? "true" : nothing}
      ${mdyPart(this.controlPart(handle))}
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
